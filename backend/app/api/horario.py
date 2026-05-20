"""
Endpoints del motor de generación de horarios.

POST   /api/horario/generar?semestre_id=X          — genera y persiste el horario
GET    /api/horario/pre-validar?semestre_id=X       — pre-valida sin generar
GET    /api/horario/semestre/{id}                   — devuelve los bloques generados
GET    /api/horario/semestre/{id}/ciclo/{ciclo}     — bloques de un ciclo
GET    /api/horario/semestre/{id}/docente/{doc_id}  — bloques de un docente
GET    /api/horario/semestre/{id}/aula/{aula_id}    — bloques de un aula
GET    /api/horario/semestre/{id}/pendientes        — componentes sin bloque asignado
POST   /api/horario/validar-movimiento              — valida mover un bloque
PATCH  /api/horario/bloques/{id}                    — aplica movimiento validado
DELETE /api/horario/bloques/{id}                    — elimina un bloque
GET    /api/horario/docentes-all                    — lista docentes (para dropdowns)
GET    /api/horario/aulas-all                       — lista aulas (para dropdowns)
"""

import logging
from datetime import time, date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.api.auth_routes import get_current_user
from app.models import (
    User, HorarioBloque, ComponenteAProgramar,
    Aula, Docente, DocenteDisponibilidad, Semestre,
)
from app.models.academico import Seccion, Curso
from app.models.enums import RoleEnum, DiaEnum, EstadoSemestreEnum
from app.motor.orquestador import ejecutar_generacion, cargar_datos_para_prevalidacion
from app.motor.pre_validador import pre_validar
from app.motor.restricciones import verificar_todas, Violacion
from app.motor.tipos import (
    ComponenteDomain, SlotAsignado, AulaDomain, DocenteDomain,
    DisponibilidadSlot, TOPES_REGIMEN, REDUCCION_POR_CARGO, hora_fin_bloque,
)

router = APIRouter(prefix="/horario", tags=["horario"])
logger = logging.getLogger(__name__)

_HOY = date_type(2026, 5, 17)  # fecha de referencia fija (igual que orquestador)


# ── Dependencias de autorización ──────────────────────────────────────────────

def _solo_director_escuela(user: User = Depends(get_current_user)) -> User:
    if user.role != RoleEnum.director_escuela:
        raise HTTPException(
            status_code=403,
            detail="Solo el Director de Escuela puede realizar esta acción",
        )
    return user


# ── Schemas de entrada/salida ─────────────────────────────────────────────────

class GenerarRequest(BaseModel):
    reiniciar: bool = True


class InfactibleOut(BaseModel):
    componente_id: int
    curso_nombre: str
    ciclo: int
    tipo_componente: str
    causa: str
    sugerencias: list[str]
    restriccion_principal: str = ""
    docente_nombre: str = ""
    seccion_letra: str = ""


class GenerarResponse(BaseModel):
    exitoso: bool
    total_componentes: int
    componentes_colocados: int
    porcentaje_colocado: float
    tiempo_segundos: float
    infactibles: list[InfactibleOut]
    advertencias: list[str] = []


class ValidarMovimientoRequest(BaseModel):
    bloque_id: int
    nuevo_dia: str
    nueva_hora_inicio: str  # "08:00"
    nueva_aula_id: int


class ViolacionOut(BaseModel):
    restriccion: str
    mensaje: str


class ValidarMovimientoResponse(BaseModel):
    valido: bool
    violaciones: list[ViolacionOut]


class MoverBloqueRequest(BaseModel):
    dia: str
    hora_inicio: str  # "08:00"
    aula_id: int


# ── Helpers internos ──────────────────────────────────────────────────────────

def _serializar_bloque(b: HorarioBloque) -> dict:
    comp = b.componente
    sec = comp.seccion
    curso = sec.curso
    docente = comp.docente

    return {
        "id": b.id,
        "dia": b.dia.value if hasattr(b.dia, "value") else b.dia,
        "hora_inicio": b.hora_inicio.strftime("%H:%M"),
        "hora_fin": b.hora_fin.strftime("%H:%M"),
        "aula": {
            "id": b.aula.id,
            "codigo": b.aula.codigo,
            "tipo": b.aula.tipo.value if hasattr(b.aula.tipo, "value") else b.aula.tipo,
            "capacidad": b.aula.capacidad,
        },
        "componente": {
            "id": comp.id,
            "tipo": comp.tipo.value if hasattr(comp.tipo, "value") else comp.tipo,
            "horas_semanales": comp.horas_semanales,
            "docente": {
                "id": docente.id,
                "nombre": docente.nombre_completo,
            } if docente else None,
            "seccion": {
                "id": sec.id,
                "letra": sec.letra,
                "num_alumnos": sec.num_alumnos,
                "curso": {
                    "id": curso.id,
                    "codigo": curso.codigo,
                    "nombre": curso.nombre,
                    "ciclo": curso.ciclo,
                },
            },
        },
    }


async def _get_bloques_db(
    db: AsyncSession,
    semestre_id: int,
    ciclo: Optional[int] = None,
    docente_id: Optional[int] = None,
    aula_id: Optional[int] = None,
) -> list[dict]:
    """Carga y serializa bloques del semestre con filtros opcionales."""
    stmt = (
        select(HorarioBloque)
        .where(HorarioBloque.semestre_id == semestre_id)
        .options(
            selectinload(HorarioBloque.aula),
            selectinload(HorarioBloque.componente).options(
                selectinload(ComponenteAProgramar.docente),
                selectinload(ComponenteAProgramar.seccion).selectinload(Seccion.curso),
            ),
        )
        .order_by(HorarioBloque.dia, HorarioBloque.hora_inicio)
    )
    res = await db.execute(stmt)
    bloques = list(res.scalars().all())

    if ciclo is not None:
        bloques = [b for b in bloques if b.componente.seccion.curso.ciclo == ciclo]
    if docente_id is not None:
        bloques = [b for b in bloques if b.componente.docente_id == docente_id]
    if aula_id is not None:
        bloques = [b for b in bloques if b.aula_id == aula_id]

    return [_serializar_bloque(b) for b in bloques]


async def _cargar_estado_para_validacion(
    db: AsyncSession,
    semestre_id: int,
    excluir_bloque_id: Optional[int] = None,
) -> tuple[list[SlotAsignado], dict[int, ComponenteDomain]]:
    """
    Carga todos los bloques del semestre (excepto el excluido) como SlotAsignado,
    y construye el mapa de ComponenteDomain necesario para verificar restricciones.
    """
    stmt = (
        select(HorarioBloque)
        .where(HorarioBloque.semestre_id == semestre_id)
        .options(
            selectinload(HorarioBloque.componente).options(
                selectinload(ComponenteAProgramar.seccion).selectinload(Seccion.curso),
            )
        )
    )
    if excluir_bloque_id is not None:
        stmt = stmt.where(HorarioBloque.id != excluir_bloque_id)

    res = await db.execute(stmt)
    bloques = res.scalars().all()

    estado: list[SlotAsignado] = []
    componentes_map: dict[int, ComponenteDomain] = {}

    for b in bloques:
        comp = b.componente
        sec = comp.seccion
        curso = sec.curso

        estado.append(SlotAsignado(
            componente_id=comp.id,
            dia=b.dia.value,
            hora_inicio=b.hora_inicio,
            hora_fin=b.hora_fin,
            aula_id=b.aula_id,
        ))

        if comp.id not in componentes_map:
            tipo_aula_req = (
                (curso.tipo_lab_requerido or "lab_computo")
                if comp.tipo.value == "L"
                else "comun"
            )
            componentes_map[comp.id] = ComponenteDomain(
                id=comp.id,
                seccion_id=comp.seccion_id,
                curso_id=curso.id,
                curso_nombre=curso.nombre,
                ciclo=curso.ciclo,
                tipo_componente=comp.tipo.value,
                docente_id=comp.docente_id,
                horas_semanales=comp.horas_semanales,
                num_alumnos=sec.num_alumnos,
                tipo_aula_requerido=tipo_aula_req,
                seccion_letra=sec.letra,
            )

    return estado, componentes_map


async def _validar_movimiento_logic(
    req: ValidarMovimientoRequest,
    db: AsyncSession,
) -> ValidarMovimientoResponse:
    """Core logic para validar un movimiento de bloque. Llamable internamente."""
    # Cargar el bloque con todas sus relaciones
    bloque_res = await db.execute(
        select(HorarioBloque)
        .where(HorarioBloque.id == req.bloque_id)
        .options(
            selectinload(HorarioBloque.componente).options(
                selectinload(ComponenteAProgramar.seccion).selectinload(Seccion.curso),
                selectinload(ComponenteAProgramar.docente).options(
                    selectinload(Docente.disponibilidades),
                    selectinload(Docente.cargos),
                ),
            )
        )
    )
    bloque = bloque_res.scalar_one_or_none()
    if not bloque:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")

    # Cargar la nueva aula
    aula_res = await db.execute(select(Aula).where(Aula.id == req.nueva_aula_id))
    nueva_aula = aula_res.scalar_one_or_none()
    if not nueva_aula:
        raise HTTPException(status_code=404, detail="Aula no encontrada")

    comp = bloque.componente
    sec = comp.seccion
    curso = sec.curso

    tipo_aula_req = (
        (curso.tipo_lab_requerido or "lab_computo") if comp.tipo.value == "L" else "comun"
    )

    comp_domain = ComponenteDomain(
        id=comp.id,
        seccion_id=comp.seccion_id,
        curso_id=curso.id,
        curso_nombre=curso.nombre,
        ciclo=curso.ciclo,
        tipo_componente=comp.tipo.value,
        docente_id=comp.docente_id,
        horas_semanales=comp.horas_semanales,
        num_alumnos=sec.num_alumnos,
        tipo_aula_requerido=tipo_aula_req,
        seccion_letra=sec.letra,
    )

    # Construir DocenteDomain si hay docente
    docente_domain: Optional[DocenteDomain] = None
    if comp.docente:
        d = comp.docente
        tope = TOPES_REGIMEN.get(d.regimen.value, 8)
        reduccion = max(
            (REDUCCION_POR_CARGO.get(c.cargo, 0) for c in d.cargos if c.fecha_fin is None),
            default=0,
        )
        docente_domain = DocenteDomain(
            id=d.id,
            nombre=d.nombre_completo,
            tipo=d.tipo.value,
            antiguedad_anios=(_HOY - d.fecha_ingreso).days / 365.25,
            disponibilidad=tuple(
                DisponibilidadSlot(
                    dia=disp.dia.value,
                    hora_inicio=disp.hora_inicio,
                    hora_fin=disp.hora_fin,
                )
                for disp in d.disponibilidades
            ),
            tope_horas=max(0, tope - reduccion),
        )

    aula_domain = AulaDomain(
        id=nueva_aula.id,
        codigo=nueva_aula.codigo,
        tipo=nueva_aula.tipo.value,
        capacidad=nueva_aula.capacidad,
    )

    # Cargar estado actual (todos los otros bloques)
    estado, componentes_map = await _cargar_estado_para_validacion(
        db, bloque.semestre_id, excluir_bloque_id=req.bloque_id
    )
    componentes_map[comp.id] = comp_domain

    # Parsear la hora de inicio
    try:
        start_h = int(req.nueva_hora_inicio.split(":")[0])
    except (ValueError, IndexError):
        raise HTTPException(status_code=422, detail="Formato de hora inválido. Use 'HH:MM'")

    nuevo_dia = req.nuevo_dia.upper()

    # Verificar todas las restricciones
    violaciones: list[Violacion] = verificar_todas(
        comp=comp_domain,
        dia=nuevo_dia,
        start_h=start_h,
        aula=aula_domain,
        estado=estado,
        docente=docente_domain,
        componentes_map=componentes_map,
    )

    return ValidarMovimientoResponse(
        valido=len(violaciones) == 0,
        violaciones=[
            ViolacionOut(restriccion=v.restriccion, mensaje=v.mensaje)
            for v in violaciones
        ],
    )


# ── POST /api/horario/generar ─────────────────────────────────────────────────

@router.post("/generar", response_model=GenerarResponse)
async def generar_horario(
    semestre_id: int = Query(..., description="ID del semestre a generar"),
    req: GenerarRequest = GenerarRequest(),
    user: User = Depends(_solo_director_escuela),
    db: AsyncSession = Depends(get_db),
):
    try:
        resultado = await ejecutar_generacion(db, semestre_id, reiniciar=req.reiniciar)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Error en generación de horario semestre %d", semestre_id)
        raise HTTPException(status_code=500, detail=f"Error interno: {e}")

    return GenerarResponse(
        exitoso=resultado.exitoso,
        total_componentes=resultado.total_componentes,
        componentes_colocados=resultado.componentes_colocados,
        porcentaje_colocado=resultado.porcentaje_colocado,
        tiempo_segundos=resultado.tiempo_segundos,
        infactibles=[
            InfactibleOut(
                componente_id=inf.componente_id,
                curso_nombre=inf.curso_nombre,
                ciclo=inf.ciclo,
                tipo_componente=inf.tipo_componente,
                causa=inf.causa,
                sugerencias=inf.sugerencias,
                restriccion_principal=inf.restriccion_principal,
                docente_nombre=inf.docente_nombre,
                seccion_letra=inf.seccion_letra,
            )
            for inf in resultado.infactibles
        ],
    )


# ── GET /api/horario/pre-validar ──────────────────────────────────────────────

@router.get("/pre-validar")
async def pre_validar_horario(
    semestre_id: int = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        componentes, docentes, aulas = await cargar_datos_para_prevalidacion(db, semestre_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    problemas = pre_validar(componentes, docentes, aulas)

    return {
        "semestre_id": semestre_id,
        "total_componentes": len(componentes),
        "con_docente": sum(1 for c in componentes if c.docente_id is not None),
        "sin_docente": sum(1 for c in componentes if c.docente_id is None),
        "errores": [
            {"categoria": p.categoria, "mensaje": p.mensaje, "sugerencias": p.sugerencias}
            for p in problemas if p.nivel == "error"
        ],
        "advertencias": [
            {"categoria": p.categoria, "mensaje": p.mensaje, "sugerencias": p.sugerencias}
            for p in problemas if p.nivel == "advertencia"
        ],
        "puede_generar": not any(p.nivel == "error" for p in problemas),
    }


# ── GET /api/horario/semestre/{semestre_id} ───────────────────────────────────

@router.get("/semestre/{semestre_id}")
async def get_horario_semestre(
    semestre_id: int,
    ciclo: Optional[int] = Query(None, description="Filtrar por ciclo"),
    docente_id: Optional[int] = Query(None, description="Filtrar por docente"),
    aula_id: Optional[int] = Query(None, description="Filtrar por aula"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bloques = await _get_bloques_db(db, semestre_id, ciclo=ciclo, docente_id=docente_id, aula_id=aula_id)
    return {"semestre_id": semestre_id, "total_bloques": len(bloques), "bloques": bloques}


# ── GET /api/horario/semestre/{semestre_id}/ciclo/{ciclo_num} ────────────────

@router.get("/semestre/{semestre_id}/ciclo/{ciclo_num}")
async def get_horario_ciclo(
    semestre_id: int,
    ciclo_num: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bloques = await _get_bloques_db(db, semestre_id, ciclo=ciclo_num)
    return {"semestre_id": semestre_id, "total_bloques": len(bloques), "bloques": bloques}


# ── GET /api/horario/semestre/{semestre_id}/docente/{docente_id} ─────────────

@router.get("/semestre/{semestre_id}/docente/{docente_id}")
async def get_horario_docente(
    semestre_id: int,
    docente_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bloques = await _get_bloques_db(db, semestre_id, docente_id=docente_id)
    return {"semestre_id": semestre_id, "total_bloques": len(bloques), "bloques": bloques}


# ── GET /api/horario/semestre/{semestre_id}/aula/{aula_id} ───────────────────

@router.get("/semestre/{semestre_id}/aula/{aula_id_path}")
async def get_horario_aula(
    semestre_id: int,
    aula_id_path: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bloques = await _get_bloques_db(db, semestre_id, aula_id=aula_id_path)
    return {"semestre_id": semestre_id, "total_bloques": len(bloques), "bloques": bloques}


# ── GET /api/horario/semestre/{semestre_id}/pendientes ───────────────────────

@router.get("/semestre/{semestre_id}/pendientes")
async def get_pendientes(
    semestre_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Devuelve los ComponenteAProgramar del semestre que NO tienen HorarioBloque asignado.
    Se usan para el banner de 'componentes pendientes'.
    """
    # IDs de componentes que YA tienen bloques en este semestre
    bloques_res = await db.execute(
        select(HorarioBloque.componente_id)
        .where(HorarioBloque.semestre_id == semestre_id)
        .distinct()
    )
    ids_colocados = {row[0] for row in bloques_res.all()}

    # Todos los componentes del semestre
    comps_res = await db.execute(
        select(ComponenteAProgramar, Seccion, Curso)
        .join(Seccion, ComponenteAProgramar.seccion_id == Seccion.id)
        .join(Curso, Seccion.curso_id == Curso.id)
        .where(Seccion.semestre_id == semestre_id)
        .order_by(Curso.ciclo, Curso.nombre, ComponenteAProgramar.tipo)
    )
    rows = comps_res.all()

    pendientes = []
    for comp, sec, curso in rows:
        if comp.id not in ids_colocados:
            docente_nombre = ""
            if comp.docente_id:
                doc_res = await db.execute(
                    select(Docente.nombre_completo).where(Docente.id == comp.docente_id)
                )
                row = doc_res.first()
                if row:
                    docente_nombre = row[0]
            pendientes.append({
                "componente_id": comp.id,
                "curso_nombre": curso.nombre,
                "ciclo": curso.ciclo,
                "tipo": comp.tipo.value,
                "seccion_letra": sec.letra,
                "docente_nombre": docente_nombre,
            })

    return {"semestre_id": semestre_id, "total": len(pendientes), "pendientes": pendientes}


# ── POST /api/horario/validar-movimiento ──────────────────────────────────────

@router.post("/validar-movimiento", response_model=ValidarMovimientoResponse)
async def validar_movimiento(
    req: ValidarMovimientoRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Valida si mover un bloque al nuevo slot (día, hora, aula) es factible.
    Reutiliza las 11 restricciones duras del motor.
    """
    return await _validar_movimiento_logic(req, db)


# ── PATCH /api/horario/bloques/{bloque_id} ────────────────────────────────────

@router.patch("/bloques/{bloque_id}")
async def mover_bloque(
    bloque_id: int,
    req: MoverBloqueRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Valida y aplica el movimiento de un bloque a un nuevo slot."""
    # Cargar bloque
    bloque_res = await db.execute(
        select(HorarioBloque)
        .where(HorarioBloque.id == bloque_id)
        .options(
            selectinload(HorarioBloque.componente).options(
                selectinload(ComponenteAProgramar.seccion).selectinload(Seccion.curso),
                selectinload(ComponenteAProgramar.docente).options(
                    selectinload(Docente.disponibilidades),
                    selectinload(Docente.cargos),
                ),
            )
        )
    )
    bloque = bloque_res.scalar_one_or_none()
    if not bloque:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")

    # Validar el movimiento
    val_res = await _validar_movimiento_logic(
        ValidarMovimientoRequest(
            bloque_id=bloque_id,
            nuevo_dia=req.dia,
            nueva_hora_inicio=req.hora_inicio,
            nueva_aula_id=req.aula_id,
        ),
        db,
    )
    if not val_res.valido:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Movimiento inválido",
                "violaciones": [
                    {"restriccion": v.restriccion, "mensaje": v.mensaje}
                    for v in val_res.violaciones
                ],
            },
        )

    # Aplicar cambio
    try:
        start_h = int(req.hora_inicio.split(":")[0])
    except (ValueError, IndexError):
        raise HTTPException(status_code=422, detail="Formato de hora inválido")

    bloque.dia = DiaEnum(req.dia.upper())
    bloque.hora_inicio = time(start_h, 0)
    bloque.hora_fin = hora_fin_bloque(start_h, bloque.componente.horas_semanales)
    bloque.aula_id = req.aula_id

    await db.commit()
    logger.info("Bloque %d movido a %s %d:00 aula %d", bloque_id, req.dia, start_h, req.aula_id)

    return {"ok": True, "bloque_id": bloque_id}


# ── DELETE /api/horario/bloques/{bloque_id} ───────────────────────────────────

@router.delete("/bloques/{bloque_id}")
async def eliminar_bloque(
    bloque_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Elimina un bloque del horario. El componente queda pendiente."""
    bloque_res = await db.execute(
        select(HorarioBloque).where(HorarioBloque.id == bloque_id)
    )
    bloque = bloque_res.scalar_one_or_none()
    if not bloque:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")

    await db.delete(bloque)
    await db.commit()
    logger.info("Bloque %d eliminado", bloque_id)

    return {"ok": True, "bloque_id": bloque_id}


# ── GET /api/horario/docentes-all ─────────────────────────────────────────────

@router.get("/docentes-all")
async def list_docentes_all(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista todos los docentes ordenados por nombre (para dropdowns del horario)."""
    res = await db.execute(
        select(Docente).order_by(Docente.nombre_completo)
    )
    docentes = res.scalars().all()
    return [
        {"id": d.id, "nombre": d.nombre_completo, "tipo": d.tipo.value}
        for d in docentes
    ]


# ── GET /api/horario/aulas-all ────────────────────────────────────────────────

@router.get("/aulas-all")
async def list_aulas_all(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista todas las aulas ordenadas por tipo y código (para dropdowns del horario)."""
    res = await db.execute(
        select(Aula).order_by(Aula.tipo, Aula.codigo)
    )
    aulas = res.scalars().all()
    return [
        {
            "id": a.id,
            "codigo": a.codigo,
            "tipo": a.tipo.value if hasattr(a.tipo, "value") else a.tipo,
            "capacidad": a.capacidad,
        }
        for a in aulas
    ]


# ── POST /api/horario/publicar ────────────────────────────────────────────────

@router.post("/publicar")
async def publicar_horario(
    semestre_id: int = Query(...),
    user: User = Depends(_solo_director_escuela),
    db: AsyncSession = Depends(get_db),
):
    """Publica el horario del semestre (cambia estado a 'publicado')."""
    result = await db.execute(select(Semestre).where(Semestre.id == semestre_id))
    semestre = result.scalar_one_or_none()
    if not semestre:
        raise HTTPException(status_code=404, detail="Semestre no encontrado")

    if semestre.estado == EstadoSemestreEnum.publicado:
        return {"ok": True, "estado": "publicado", "ya_publicado": True}

    count_res = await db.execute(
        select(func.count(HorarioBloque.id)).where(HorarioBloque.semestre_id == semestre_id)
    )
    n_bloques = count_res.scalar() or 0
    if n_bloques == 0:
        raise HTTPException(
            status_code=422,
            detail="No se puede publicar: el horario está vacío. Genere el horario primero.",
        )

    semestre.estado = EstadoSemestreEnum.publicado
    await db.commit()
    logger.info("Semestre %d publicado por %s", semestre_id, user.email)
    return {"ok": True, "estado": "publicado"}


# ── POST /api/horario/despublicar ─────────────────────────────────────────────

@router.post("/despublicar")
async def despublicar_horario(
    semestre_id: int = Query(...),
    user: User = Depends(_solo_director_escuela),
    db: AsyncSession = Depends(get_db),
):
    """Revierte la publicación (vuelve el semestre a estado 'generando')."""
    result = await db.execute(select(Semestre).where(Semestre.id == semestre_id))
    semestre = result.scalar_one_or_none()
    if not semestre:
        raise HTTPException(status_code=404, detail="Semestre no encontrado")

    semestre.estado = EstadoSemestreEnum.generando
    await db.commit()
    logger.info("Semestre %d despublicado por %s", semestre_id, user.email)
    return {"ok": True, "estado": "generando"}
