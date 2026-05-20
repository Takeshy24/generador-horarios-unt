from datetime import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth_routes import get_current_user
from app.core.db import get_db
from app.models import (
    ComponenteAProgramar, Curso, Docente, DocenteDisponibilidad,
    DocentePreferencias, Seccion, User,
)
from app.models.enums import DiaEnum, TurnoEnum

router = APIRouter(prefix="/docentes", tags=["docentes"])

HORAS_REQUERIDAS: dict[str, int] = {
    "DE": 40, "TC": 40, "TP1": 20, "TP2": 16, "TP3": 12,
    "CONTRATO_A1": 16, "CONTRATO_A2": 20, "CONTRATO_A3": 24,
    "CONTRATO_B1": 16, "CONTRATO_B2": 20, "CONTRATO_B3": 24,
}


def _horas_totales(disponibilidades: list[DocenteDisponibilidad]) -> float:
    total = 0.0
    for d in disponibilidades:
        hi = d.hora_inicio.hour + d.hora_inicio.minute / 60
        hf = d.hora_fin.hour + d.hora_fin.minute / 60
        total += hf - hi
    return total


# ── GET /docentes/me ─────────────────────────────────────────────────────────

@router.get("/me")
async def get_docente_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.docente_id:
        raise HTTPException(status_code=404, detail="Usuario sin docente asociado")

    result = await db.execute(select(Docente).where(Docente.id == current_user.docente_id))
    docente = result.scalar_one_or_none()
    if not docente:
        raise HTTPException(status_code=404, detail="Docente no encontrado")

    return {
        "id": docente.id,
        "nombre_completo": docente.nombre_completo,
        "tipo": docente.tipo.value,
        "regimen": docente.regimen.value,
        "categoria": docente.categoria.value if docente.categoria else None,
    }


# ── GET /docentes/me/disponibilidad ──────────────────────────────────────────

@router.get("/me/disponibilidad")
async def get_disponibilidad(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.docente_id:
        raise HTTPException(status_code=404, detail="Usuario sin docente asociado")

    doc_res = await db.execute(select(Docente).where(Docente.id == current_user.docente_id))
    docente = doc_res.scalar_one_or_none()
    if not docente:
        raise HTTPException(status_code=404, detail="Docente no encontrado")

    result = await db.execute(
        select(DocenteDisponibilidad)
        .where(DocenteDisponibilidad.docente_id == current_user.docente_id)
        .order_by(DocenteDisponibilidad.dia, DocenteDisponibilidad.hora_inicio)
    )
    records = result.scalars().all()

    total = _horas_totales(list(records))
    requeridas = HORAS_REQUERIDAS.get(docente.regimen.value, 20)

    return {
        "disponibilidades": [
            {
                "id": r.id,
                "dia": r.dia.value,
                "hora_inicio": r.hora_inicio.strftime("%H:%M"),
                "hora_fin": r.hora_fin.strftime("%H:%M"),
            }
            for r in records
        ],
        "total_horas": round(total),
        "horas_requeridas": requeridas,
        "regimen": docente.regimen.value,
    }


# ── PATCH /docentes/me/disponibilidad ────────────────────────────────────────

class SlotIn(BaseModel):
    dia: str
    hora_inicio: str  # "07:00"
    hora_fin: str     # "13:00"


class DisponibilidadPatch(BaseModel):
    slots: list[SlotIn]


@router.patch("/me/disponibilidad")
async def patch_disponibilidad(
    body: DisponibilidadPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.docente_id:
        raise HTTPException(status_code=404, detail="Usuario sin docente asociado")

    await db.execute(
        delete(DocenteDisponibilidad).where(
            DocenteDisponibilidad.docente_id == current_user.docente_id
        )
    )

    for slot in body.slots:
        try:
            dia = DiaEnum(slot.dia)
            hi_parts = slot.hora_inicio.split(":")
            hf_parts = slot.hora_fin.split(":")
            hi = time(int(hi_parts[0]), int(hi_parts[1]))
            hf = time(int(hf_parts[0]), int(hf_parts[1]))
        except (ValueError, IndexError):
            raise HTTPException(status_code=422, detail=f"Slot inválido: {slot}")

        db.add(DocenteDisponibilidad(
            docente_id=current_user.docente_id,
            dia=dia,
            hora_inicio=hi,
            hora_fin=hf,
        ))

    await db.commit()
    return {"ok": True, "slots_guardados": len(body.slots)}


# ── GET /docentes/me/preferencias ────────────────────────────────────────────

@router.get("/me/preferencias")
async def get_preferencias(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.docente_id:
        raise HTTPException(status_code=404, detail="Usuario sin docente asociado")

    result = await db.execute(
        select(DocentePreferencias).where(
            DocentePreferencias.docente_id == current_user.docente_id
        )
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        return {
            "turno_preferido": "indiferente",
            "max_horas_seguidas": 4,
            "dias_evitar": [],
        }

    dias_evitar = [d.strip() for d in prefs.dias_evitar.split(",") if d.strip()] if prefs.dias_evitar else []
    return {
        "turno_preferido": prefs.turno_preferido.value,
        "max_horas_seguidas": prefs.max_horas_seguidas,
        "dias_evitar": dias_evitar,
    }


# ── PATCH /docentes/me/preferencias ──────────────────────────────────────────

class PreferenciasPatch(BaseModel):
    turno_preferido: str
    max_horas_seguidas: int
    dias_evitar: list[str]


@router.patch("/me/preferencias")
async def patch_preferencias(
    body: PreferenciasPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.docente_id:
        raise HTTPException(status_code=404, detail="Usuario sin docente asociado")

    try:
        turno = TurnoEnum(body.turno_preferido)
    except ValueError:
        raise HTTPException(status_code=422, detail="Turno inválido")

    if not (1 <= body.max_horas_seguidas <= 8):
        raise HTTPException(status_code=422, detail="max_horas_seguidas debe estar entre 1 y 8")

    result = await db.execute(
        select(DocentePreferencias).where(
            DocentePreferencias.docente_id == current_user.docente_id
        )
    )
    prefs = result.scalar_one_or_none()

    dias_str = ",".join(body.dias_evitar) if body.dias_evitar else None

    if prefs:
        prefs.turno_preferido = turno
        prefs.max_horas_seguidas = body.max_horas_seguidas
        prefs.dias_evitar = dias_str
    else:
        db.add(DocentePreferencias(
            docente_id=current_user.docente_id,
            turno_preferido=turno,
            max_horas_seguidas=body.max_horas_seguidas,
            dias_evitar=dias_str,
        ))

    await db.commit()
    return {"ok": True}


# ── GET /docentes/me/componentes ─────────────────────────────────────────────

@router.get("/me/componentes")
async def get_mis_componentes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.docente_id:
        raise HTTPException(status_code=404, detail="Usuario sin docente asociado")

    result = await db.execute(
        select(ComponenteAProgramar, Seccion, Curso)
        .join(Seccion, ComponenteAProgramar.seccion_id == Seccion.id)
        .join(Curso, Seccion.curso_id == Curso.id)
        .where(ComponenteAProgramar.docente_id == current_user.docente_id)
        .order_by(Curso.ciclo, Curso.nombre, ComponenteAProgramar.tipo)
    )
    rows = result.all()

    componentes = []
    for comp, sec, curso in rows:
        grupo_numero = None
        if comp.grupo_lab_id:
            from app.models import GrupoLab
            g_res = await db.execute(select(GrupoLab).where(GrupoLab.id == comp.grupo_lab_id))
            g = g_res.scalar_one_or_none()
            if g:
                grupo_numero = g.numero

        componentes.append({
            "id": comp.id,
            "curso_nombre": curso.nombre,
            "ciclo": curso.ciclo,
            "seccion_letra": sec.letra,
            "tipo": comp.tipo.value,
            "horas_semanales": comp.horas_semanales,
            "grupo_numero": grupo_numero,
        })

    return componentes
