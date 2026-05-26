from datetime import date, time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth_routes import get_current_user
from app.core.db import get_db
from app.models import Aula, HorarioBloque, ReservaRecuperacion, Semestre, User
from app.models.enums import DiaEnum, TipoAulaEnum

router = APIRouter(prefix="/recuperacion", tags=["recuperacion"])

_DIA_MAP = {0: DiaEnum.LUN, 1: DiaEnum.MAR, 2: DiaEnum.MIE, 3: DiaEnum.JUE, 4: DiaEnum.VIE, 5: DiaEnum.SAB}


def _parse_time(s: str) -> time:
    parts = s.split(":")
    return time(int(parts[0]), int(parts[1]))


async def _semestre_para_fecha(db: AsyncSession, fecha: date) -> Optional[Semestre]:
    result = await db.execute(
        select(Semestre)
        .where(Semestre.fecha_inicio <= fecha, Semestre.fecha_fin >= fecha)
        .order_by(Semestre.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


# ── GET /recuperacion/aulas-disponibles ──────────────────────────────────────

@router.get("/aulas-disponibles")
async def get_aulas_disponibles(
    fecha: date = Query(...),
    hora_inicio: str = Query(..., example="08:00"),
    hora_fin: str = Query(..., example="10:00"),
    tipo_aula: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        hi = _parse_time(hora_inicio)
        hf = _parse_time(hora_fin)
    except (ValueError, IndexError):
        raise HTTPException(status_code=422, detail="Formato de hora inválido (usar HH:MM)")

    if hi >= hf:
        raise HTTPException(status_code=422, detail="hora_inicio debe ser anterior a hora_fin")

    # Aulas query (optionally filtered by type)
    aula_q = select(Aula).order_by(Aula.codigo)
    if tipo_aula:
        try:
            aula_q = aula_q.where(Aula.tipo == TipoAulaEnum(tipo_aula))
        except ValueError:
            raise HTTPException(status_code=422, detail="Tipo de aula inválido")

    aulas = (await db.execute(aula_q)).scalars().all()

    # Find semesters covering this date (for regular schedule check)
    sem_result = await db.execute(
        select(Semestre).where(
            Semestre.fecha_inicio <= fecha,
            Semestre.fecha_fin >= fecha,
        )
    )
    semestre_ids = [s.id for s in sem_result.scalars().all()]

    weekday = fecha.weekday()
    dia_enum = _DIA_MAP.get(weekday)  # None on weekends

    disponibles = []
    for aula in aulas:
        # Check regular schedule conflict (weekdays only)
        if dia_enum and semestre_ids:
            conflicto = (await db.execute(
                select(HorarioBloque).where(
                    HorarioBloque.aula_id == aula.id,
                    HorarioBloque.dia == dia_enum,
                    HorarioBloque.semestre_id.in_(semestre_ids),
                    HorarioBloque.hora_inicio < hf,
                    HorarioBloque.hora_fin > hi,
                )
            )).scalars().first()
            if conflicto:
                continue

        # Check existing recovery reservations
        reserva = (await db.execute(
            select(ReservaRecuperacion).where(
                ReservaRecuperacion.aula_id == aula.id,
                ReservaRecuperacion.fecha == fecha,
                ReservaRecuperacion.hora_inicio < hf,
                ReservaRecuperacion.hora_fin > hi,
            )
        )).scalars().first()
        if reserva:
            continue

        disponibles.append({
            "id": aula.id,
            "codigo": aula.codigo,
            "tipo": aula.tipo.value,
            "capacidad": aula.capacidad,
            "ubicacion": aula.ubicacion,
        })

    return disponibles


# ── POST /recuperacion/reservas ──────────────────────────────────────────────

class ReservaIn(BaseModel):
    aula_id: int
    fecha: date
    hora_inicio: str
    hora_fin: str
    motivo: Optional[str] = None


@router.post("/reservas", status_code=201)
async def crear_reserva(
    body: ReservaIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.docente_id:
        raise HTTPException(status_code=403, detail="Usuario sin docente asociado")

    try:
        hi = _parse_time(body.hora_inicio)
        hf = _parse_time(body.hora_fin)
    except (ValueError, IndexError):
        raise HTTPException(status_code=422, detail="Formato de hora inválido (usar HH:MM)")

    if hi >= hf:
        raise HTTPException(status_code=422, detail="hora_inicio debe ser anterior a hora_fin")

    aula = (await db.execute(select(Aula).where(Aula.id == body.aula_id))).scalar_one_or_none()
    if not aula:
        raise HTTPException(status_code=404, detail="Aula no encontrada")

    semestre = await _semestre_para_fecha(db, body.fecha)
    if not semestre:
        raise HTTPException(status_code=422, detail="No hay semestre registrado para la fecha seleccionada")

    # Re-validate availability to prevent race conditions
    weekday = body.fecha.weekday()
    dia_enum = _DIA_MAP.get(weekday)
    if dia_enum:
        conflicto = (await db.execute(
            select(HorarioBloque).where(
                HorarioBloque.aula_id == body.aula_id,
                HorarioBloque.dia == dia_enum,
                HorarioBloque.semestre_id == semestre.id,
                HorarioBloque.hora_inicio < hf,
                HorarioBloque.hora_fin > hi,
            )
        )).scalars().first()
        if conflicto:
            raise HTTPException(status_code=409, detail="El aula tiene una clase regular en ese horario")

    reserva_existente = (await db.execute(
        select(ReservaRecuperacion).where(
            ReservaRecuperacion.aula_id == body.aula_id,
            ReservaRecuperacion.fecha == body.fecha,
            ReservaRecuperacion.hora_inicio < hf,
            ReservaRecuperacion.hora_fin > hi,
        )
    )).scalars().first()
    if reserva_existente:
        raise HTTPException(status_code=409, detail="El aula ya está reservada en ese horario")

    reserva = ReservaRecuperacion(
        docente_id=current_user.docente_id,
        aula_id=body.aula_id,
        semestre_id=semestre.id,
        fecha=body.fecha,
        hora_inicio=hi,
        hora_fin=hf,
        motivo=body.motivo,
    )
    db.add(reserva)
    await db.commit()
    await db.refresh(reserva)

    return {
        "id": reserva.id,
        "aula_codigo": aula.codigo,
        "aula_tipo": aula.tipo.value,
        "aula_ubicacion": aula.ubicacion,
        "fecha": reserva.fecha.isoformat(),
        "hora_inicio": reserva.hora_inicio.strftime("%H:%M"),
        "hora_fin": reserva.hora_fin.strftime("%H:%M"),
        "motivo": reserva.motivo,
    }


# ── GET /recuperacion/mis-reservas ───────────────────────────────────────────

@router.get("/mis-reservas")
async def get_mis_reservas(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.docente_id:
        raise HTTPException(status_code=403, detail="Usuario sin docente asociado")

    rows = (await db.execute(
        select(ReservaRecuperacion, Aula)
        .join(Aula, ReservaRecuperacion.aula_id == Aula.id)
        .where(ReservaRecuperacion.docente_id == current_user.docente_id)
        .order_by(ReservaRecuperacion.fecha.desc(), ReservaRecuperacion.hora_inicio)
    )).all()

    today = date.today()
    return [
        {
            "id": r.id,
            "aula_codigo": a.codigo,
            "aula_tipo": a.tipo.value,
            "aula_ubicacion": a.ubicacion,
            "fecha": r.fecha.isoformat(),
            "hora_inicio": r.hora_inicio.strftime("%H:%M"),
            "hora_fin": r.hora_fin.strftime("%H:%M"),
            "motivo": r.motivo,
            "pasada": r.fecha < today,
        }
        for r, a in rows
    ]


# ── DELETE /recuperacion/reservas/{id} ───────────────────────────────────────

@router.delete("/reservas/{reserva_id}")
async def cancelar_reserva(
    reserva_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.docente_id:
        raise HTTPException(status_code=403, detail="Usuario sin docente asociado")

    reserva = (await db.execute(
        select(ReservaRecuperacion).where(
            ReservaRecuperacion.id == reserva_id,
            ReservaRecuperacion.docente_id == current_user.docente_id,
        )
    )).scalar_one_or_none()

    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reserva.fecha < date.today():
        raise HTTPException(status_code=422, detail="No se puede cancelar una reserva de fecha pasada")

    await db.delete(reserva)
    await db.commit()
    return {"ok": True}
