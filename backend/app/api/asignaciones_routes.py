from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth_routes import get_current_user
from app.core.db import get_db
from app.models import (
    ComponenteAProgramar, Curso, Docente, DocenteDisponibilidad,
    Seccion, User,
)
from app.models.enums import TipoDocenteEnum

router = APIRouter(prefix="/asignaciones", tags=["asignaciones"])

TOPES: dict[str, int] = {
    "DE": 22, "TC": 20, "TP1": 12, "TP2": 10, "TP3": 8,
    "CONTRATO_A1": 8, "CONTRATO_A2": 10, "CONTRATO_A3": 12,
    "CONTRATO_B1": 8, "CONTRATO_B2": 10, "CONTRATO_B3": 12,
}

HOY = date(2026, 5, 17)


def _antiguedad(fecha_ingreso: date) -> int:
    return (HOY - fecha_ingreso).days // 365


def _horas_disp_total(disponibilidades: list) -> float:
    total = 0.0
    for d in disponibilidades:
        hi = d.hora_inicio.hour + d.hora_inicio.minute / 60
        hf = d.hora_fin.hour + d.hora_fin.minute / 60
        total += hf - hi
    return total


async def _horas_asignadas(db: AsyncSession, docente_id: int, semestre_id: int) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(ComponenteAProgramar.horas_semanales), 0))
        .join(Seccion, ComponenteAProgramar.seccion_id == Seccion.id)
        .where(
            ComponenteAProgramar.docente_id == docente_id,
            Seccion.semestre_id == semestre_id,
        )
    )
    return int(result.scalar())


# ── GET /asignaciones/componentes ────────────────────────────────────────────

@router.get("/componentes")
async def get_componentes(
    semestre_id: int = Query(...),
    mostrar_todas: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(ComponenteAProgramar, Seccion, Curso)
        .join(Seccion, ComponenteAProgramar.seccion_id == Seccion.id)
        .join(Curso, Seccion.curso_id == Curso.id)
        .where(Seccion.semestre_id == semestre_id)
        .order_by(Curso.ciclo, Curso.nombre, ComponenteAProgramar.tipo)
    )
    if not mostrar_todas:
        query = query.where(ComponenteAProgramar.docente_id.is_(None))

    result = await db.execute(query)
    rows = result.all()

    componentes = []
    for comp, sec, curso in rows:
        docente_nombre = None
        if comp.docente_id:
            d_res = await db.execute(select(Docente).where(Docente.id == comp.docente_id))
            d = d_res.scalar_one_or_none()
            if d:
                docente_nombre = d.nombre_completo

        componentes.append({
            "id": comp.id,
            "curso_nombre": curso.nombre,
            "ciclo": curso.ciclo,
            "seccion_letra": sec.letra,
            "tipo": comp.tipo.value,
            "horas_semanales": comp.horas_semanales,
            "docente_id": comp.docente_id,
            "docente_nombre": docente_nombre,
            "esta_asignado": comp.docente_id is not None,
        })

    return componentes


# ── GET /asignaciones/candidatos/{componente_id} ─────────────────────────────

@router.get("/candidatos/{componente_id}")
async def get_candidatos(
    componente_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comp_res = await db.execute(
        select(ComponenteAProgramar, Seccion, Curso)
        .join(Seccion, ComponenteAProgramar.seccion_id == Seccion.id)
        .join(Curso, Seccion.curso_id == Curso.id)
        .where(ComponenteAProgramar.id == componente_id)
    )
    row = comp_res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Componente no encontrado")

    comp, sec, curso = row
    semestre_id = sec.semestre_id

    docente_actual_nombre = None
    if comp.docente_id:
        d_res = await db.execute(select(Docente).where(Docente.id == comp.docente_id))
        d_actual = d_res.scalar_one_or_none()
        if d_actual:
            docente_actual_nombre = d_actual.nombre_completo

    # Candidatos: nombrados por antigüedad desc, luego contratados por antigüedad desc
    doc_result = await db.execute(
        select(Docente).order_by(Docente.tipo, Docente.fecha_ingreso)
    )
    todos = doc_result.scalars().all()

    # Sort: nombrado first, then by fecha_ingreso ascending (oldest = most years first)
    def sort_key(d: Docente):
        tipo_orden = 0 if d.tipo == TipoDocenteEnum.nombrado else 1
        return (tipo_orden, d.fecha_ingreso)

    todos_sorted = sorted(todos, key=sort_key)

    candidatos = []
    for docente in todos_sorted:
        h_asig = await _horas_asignadas(db, docente.id, semestre_id)

        disp_res = await db.execute(
            select(DocenteDisponibilidad).where(DocenteDisponibilidad.docente_id == docente.id)
        )
        disps = disp_res.scalars().all()
        h_disp = round(_horas_disp_total(list(disps)))

        tope = TOPES.get(docente.regimen.value, 8)
        horas_libres = max(0, tope - h_asig)
        disponiblidad_ok = (
            horas_libres >= comp.horas_semanales
            and h_disp >= comp.horas_semanales
        )

        candidatos.append({
            "docente_id": docente.id,
            "nombre": docente.nombre_completo,
            "tipo": docente.tipo.value,
            "regimen": docente.regimen.value,
            "categoria": docente.categoria.value if docente.categoria else None,
            "antiguedad_anos": _antiguedad(docente.fecha_ingreso),
            "tope_horas": tope,
            "horas_asignadas": h_asig,
            "horas_libres": horas_libres,
            "horas_disponibles_total": h_disp,
            "disponibilidad_suficiente": disponiblidad_ok,
            "es_actual": docente.id == comp.docente_id,
        })

    return {
        "componente": {
            "id": comp.id,
            "curso_nombre": curso.nombre,
            "ciclo": curso.ciclo,
            "seccion_letra": sec.letra,
            "tipo": comp.tipo.value,
            "horas_semanales": comp.horas_semanales,
            "docente_actual_id": comp.docente_id,
            "docente_actual_nombre": docente_actual_nombre,
        },
        "candidatos": candidatos,
    }


# ── POST /asignaciones/asignar ───────────────────────────────────────────────

class AsignarBody(BaseModel):
    componente_id: int
    docente_id: int


@router.post("/asignar")
async def asignar(
    body: AsignarBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comp_res = await db.execute(
        select(ComponenteAProgramar, Seccion)
        .join(Seccion, ComponenteAProgramar.seccion_id == Seccion.id)
        .where(ComponenteAProgramar.id == body.componente_id)
    )
    row = comp_res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Componente no encontrado")

    comp, sec = row

    doc_res = await db.execute(select(Docente).where(Docente.id == body.docente_id))
    docente = doc_res.scalar_one_or_none()
    if not docente:
        raise HTTPException(status_code=404, detail="Docente no encontrado")

    tope = TOPES.get(docente.regimen.value, 8)
    h_asig = await _horas_asignadas(db, body.docente_id, sec.semestre_id)

    # No contar la asignación actual si se está reasignando
    if comp.docente_id == body.docente_id:
        return {"ok": True, "mensaje": "Docente ya asignado"}

    if h_asig + comp.horas_semanales > tope:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Docente supera tope: tiene {h_asig}h asignadas + "
                f"{comp.horas_semanales}h = {h_asig + comp.horas_semanales}h > tope {tope}h"
            ),
        )

    comp.docente_id = body.docente_id
    await db.commit()
    return {"ok": True}


# ── GET /asignaciones/resumen-cargas ─────────────────────────────────────────

@router.get("/resumen-cargas")
async def resumen_cargas(
    semestre_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc_result = await db.execute(
        select(Docente).order_by(Docente.tipo, Docente.fecha_ingreso)
    )
    todos = doc_result.scalars().all()

    def sort_key(d: Docente):
        tipo_orden = 0 if d.tipo == TipoDocenteEnum.nombrado else 1
        return (tipo_orden, d.fecha_ingreso)

    todos_sorted = sorted(todos, key=sort_key)

    resumen = []
    for docente in todos_sorted:
        h_asig = await _horas_asignadas(db, docente.id, semestre_id)

        disp_res = await db.execute(
            select(DocenteDisponibilidad).where(DocenteDisponibilidad.docente_id == docente.id)
        )
        disps = disp_res.scalars().all()
        h_disp = round(_horas_disp_total(list(disps)))

        tope = TOPES.get(docente.regimen.value, 8)

        if h_asig > tope:
            estado = "sobrecarga"
        elif h_disp < h_asig and h_asig > 0:
            estado = "disponibilidad_insuficiente"
        elif h_asig == 0:
            estado = "bajo_carga"
        else:
            estado = "ok"

        resumen.append({
            "docente_id": docente.id,
            "nombre": docente.nombre_completo,
            "tipo": docente.tipo.value,
            "regimen": docente.regimen.value,
            "categoria": docente.categoria.value if docente.categoria else None,
            "antiguedad_anos": _antiguedad(docente.fecha_ingreso),
            "tope_horas": tope,
            "horas_asignadas": h_asig,
            "horas_disponibles": h_disp,
            "estado": estado,
        })

    return resumen
