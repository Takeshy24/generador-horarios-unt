"""
Punto de entrada del motor: carga datos de la BD, ejecuta el motor, persiste resultados.
"""

import logging
from datetime import date

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.academico import Semestre, Seccion, ComponenteAProgramar, HorarioBloque
from app.models.docente import Docente
from app.models.enums import DiaEnum

from .tipos import (
    DocenteDomain, AulaDomain, ComponenteDomain, DisponibilidadSlot,
    ResultadoGeneracion, TOPES_REGIMEN, REDUCCION_POR_CARGO,
)
from .pre_validador import pre_validar
from .generador import generar
from .reporte import enriquecer_infactibles
from .plantillas_reales import PLANTILLAS_POR_SEMESTRE

logger = logging.getLogger(__name__)

_HOY = date(2026, 5, 17)   # fecha de referencia fija para reproducibilidad


def _antiguedad_anios(fecha_ingreso: date) -> float:
    return (_HOY - fecha_ingreso).days / 365.25


def _tope_efectivo(docente: Docente) -> int:
    """Tope CHL real = tope régimen - reducción por cargo administrativo activo."""
    base = TOPES_REGIMEN.get(docente.regimen.value, 8)
    reduccion = 0
    for cargo in docente.cargos:
        if cargo.fecha_fin is None:  # cargo activo
            reduccion = max(reduccion, REDUCCION_POR_CARGO.get(cargo.cargo, 0))
    return max(0, base - reduccion)


async def _cargar_datos(db: AsyncSession, semestre_id: int):
    """
    Carga desde la BD todos los objetos necesarios para el motor.
    Retorna (componentes_domain, docentes_domain, aulas_domain).
    """
    # ── Semestre + aulas disponibles ──────────────────────────────────────────
    res = await db.execute(
        select(Semestre)
        .where(Semestre.id == semestre_id)
        .options(selectinload(Semestre.aulas))
    )
    semestre = res.scalar_one_or_none()
    if semestre is None:
        raise ValueError(f"Semestre {semestre_id} no existe")

    # ── Secciones del semestre con sus cursos y grupos de lab ─────────────────
    res = await db.execute(
        select(Seccion)
        .where(Seccion.semestre_id == semestre_id)
        .options(
            selectinload(Seccion.curso),
            selectinload(Seccion.grupos_lab),
        )
    )
    secciones = {s.id: s for s in res.scalars().all()}
    logger.info("Semestre %d: %d secciones cargadas", semestre_id, len(secciones))

    # ── Componentes a programar ───────────────────────────────────────────────
    if not secciones:
        return [], [], []

    res = await db.execute(
        select(ComponenteAProgramar)
        .where(ComponenteAProgramar.seccion_id.in_(list(secciones.keys())))
    )
    comps_orm = res.scalars().all()
    logger.info("%d componentes cargados", len(comps_orm))

    # ── Docentes (todos, con disponibilidades y cargos) ───────────────────────
    res = await db.execute(
        select(Docente)
        .options(
            selectinload(Docente.disponibilidades),
            selectinload(Docente.cargos),
        )
    )
    docentes_orm = {d.id: d for d in res.scalars().all()}

    # ── Conversión a objetos del dominio del motor ────────────────────────────

    aulas_domain = [
        AulaDomain(
            id=a.id,
            codigo=a.codigo,
            tipo=a.tipo.value,
            capacidad=a.capacidad,
        )
        for a in sorted(semestre.aulas, key=lambda x: x.id)
    ]

    docentes_domain: dict[int, DocenteDomain] = {}
    for d in docentes_orm.values():
        disps = tuple(
            DisponibilidadSlot(
                dia=disp.dia.value,
                hora_inicio=disp.hora_inicio,
                hora_fin=disp.hora_fin,
            )
            for disp in sorted(d.disponibilidades, key=lambda x: (x.dia, x.hora_inicio))
        )
        docentes_domain[d.id] = DocenteDomain(
            id=d.id,
            nombre=d.nombre_completo,
            tipo=d.tipo.value,
            antiguedad_anios=_antiguedad_anios(d.fecha_ingreso),
            disponibilidad=disps,
            tope_horas=_tope_efectivo(d),
        )

    componentes_domain: list[ComponenteDomain] = []
    for comp in sorted(comps_orm, key=lambda x: x.id):
        sec = secciones[comp.seccion_id]
        curso = sec.curso

        # Número de alumnos: sección completa para T/P, grupo específico para L
        if comp.tipo.value == "L" and comp.grupo_lab_id is not None:
            grupo = next(
                (g for g in sec.grupos_lab if g.id == comp.grupo_lab_id),
                None,
            )
            num_alumnos = grupo.num_alumnos if grupo else sec.num_alumnos
            grupo_numero = grupo.numero if grupo else None
        else:
            num_alumnos = sec.num_alumnos
            grupo_numero = None

        # Tipo de aula requerido
        if comp.tipo.value == "L":
            tipo_aula_req = curso.tipo_lab_requerido or "lab_computo"
        else:
            tipo_aula_req = "comun"

        componentes_domain.append(ComponenteDomain(
            id=comp.id,
            seccion_id=comp.seccion_id,
            curso_id=sec.curso_id,
            curso_nombre=curso.nombre,
            ciclo=curso.ciclo,
            tipo_componente=comp.tipo.value,
            docente_id=comp.docente_id,
            horas_semanales=comp.horas_semanales,
            num_alumnos=num_alumnos,
            tipo_aula_requerido=tipo_aula_req,
            seccion_letra=sec.letra,
            curso_codigo=curso.codigo,
            grupo_lab_numero=grupo_numero,
        ))

    return componentes_domain, list(docentes_domain.values()), aulas_domain, semestre.codigo


async def ejecutar_generacion(
    db: AsyncSession,
    semestre_id: int,
    reiniciar: bool = True,
) -> ResultadoGeneracion:
    """
    Orquesta la generación completa:
    1. Carga datos de la BD
    2. Pre-valida factibilidad
    3. Ejecuta el motor greedy
    4. Enriquece infactibles con causas
    5. Persiste horario_bloques
    """
    logger.info("=== Iniciando generación para semestre %d ===", semestre_id)

    componentes, docentes, aulas, semestre_codigo = await _cargar_datos(db, semestre_id)

    if not componentes:
        raise ValueError(f"El semestre {semestre_id} no tiene componentes a programar")

    # Pre-validar
    problemas = pre_validar(componentes, docentes, aulas)
    errores = [p for p in problemas if p.nivel == "error"]
    advertencias = [p for p in problemas if p.nivel == "advertencia"]

    if errores:
        logger.warning(
            "Pre-validación: %d errores, %d advertencias",
            len(errores), len(advertencias),
        )
        for e in errores:
            logger.warning("  [ERROR] %s: %s", e.categoria, e.mensaje)
    if advertencias:
        for w in advertencias:
            logger.info("  [WARN] %s: %s", w.categoria, w.mensaje)

    # Borrar horario previo
    if reiniciar:
        await db.execute(
            delete(HorarioBloque).where(HorarioBloque.semestre_id == semestre_id)
        )
        await db.flush()
        logger.info("Horario previo eliminado")

    # Ejecutar motor
    resultado = generar(
        componentes,
        docentes,
        aulas,
        plantilla=PLANTILLAS_POR_SEMESTRE.get(semestre_codigo),
    )

    # Enriquecer infactibles con diagnóstico
    comp_map = {c.id: c for c in componentes}
    doc_map = {d.id: d for d in docentes}
    resultado.infactibles = enriquecer_infactibles(
        resultado.infactibles, comp_map, doc_map, aulas, resultado.asignaciones
    )

    # Persistir bloques en la BD
    for slot in resultado.asignaciones:
        db.add(HorarioBloque(
            semestre_id=semestre_id,
            componente_id=slot.componente_id,
            dia=DiaEnum(slot.dia),
            hora_inicio=slot.hora_inicio,
            hora_fin=slot.hora_fin,
            aula_id=slot.aula_id,
        ))

    await db.commit()
    logger.info(
        "=== Generación finalizada: %d bloques persistidos en %.3fs ===",
        len(resultado.asignaciones), resultado.tiempo_segundos,
    )

    return resultado


async def cargar_datos_para_prevalidacion(db: AsyncSession, semestre_id: int):
    """Expone la carga de datos para el endpoint de pre-validación."""
    componentes, docentes, aulas, _semestre_codigo = await _cargar_datos(db, semestre_id)
    return componentes, docentes, aulas
