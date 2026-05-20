"""
Endpoints para el Director de Escuela — pool de aulas del semestre.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.auth_routes import get_current_user
from app.core.db import get_db
from app.models import Semestre, Aula, User
from app.models.enums import RoleEnum

router = APIRouter(prefix="/director", tags=["director"])


def require_director_or_admin(user: User):
    if user.role not in (RoleEnum.director_escuela, RoleEnum.admin):
        raise HTTPException(
            status_code=403,
            detail="Solo el Director de Escuela puede realizar esta acción",
        )


# ── GET /director/aulas-semestre ──────────────────────────────────────────────

@router.get("/aulas-semestre")
async def get_aulas_semestre(
    semestre_id: int = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Devuelve todas las aulas indicando cuáles están habilitadas para el semestre."""
    require_director_or_admin(user)

    result = await db.execute(
        select(Semestre)
        .where(Semestre.id == semestre_id)
        .options(selectinload(Semestre.aulas))
    )
    semestre = result.scalar_one_or_none()
    if not semestre:
        raise HTTPException(status_code=404, detail="Semestre no encontrado")

    aulas_en_semestre = {a.id for a in semestre.aulas}

    aulas_result = await db.execute(select(Aula).order_by(Aula.tipo, Aula.codigo))
    todas = aulas_result.scalars().all()

    return [
        {
            "id": a.id,
            "codigo": a.codigo,
            "tipo": a.tipo.value,
            "capacidad": a.capacidad,
            "ubicacion": a.ubicacion,
            "disponible": a.id in aulas_en_semestre,
        }
        for a in todas
    ]


# ── POST /director/aulas-semestre/agregar ─────────────────────────────────────

class AulaToggleBody(BaseModel):
    semestre_id: int
    aula_id: int


@router.post("/aulas-semestre/agregar")
async def agregar_aula_semestre(
    body: AulaToggleBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Habilita un aula para el semestre."""
    require_director_or_admin(user)

    result = await db.execute(
        select(Semestre)
        .where(Semestre.id == body.semestre_id)
        .options(selectinload(Semestre.aulas))
    )
    semestre = result.scalar_one_or_none()
    if not semestre:
        raise HTTPException(status_code=404, detail="Semestre no encontrado")

    aula_result = await db.execute(select(Aula).where(Aula.id == body.aula_id))
    aula = aula_result.scalar_one_or_none()
    if not aula:
        raise HTTPException(status_code=404, detail="Aula no encontrada")

    if aula not in semestre.aulas:
        semestre.aulas.append(aula)
        await db.commit()

    return {"ok": True}


# ── POST /director/aulas-semestre/quitar ──────────────────────────────────────

@router.post("/aulas-semestre/quitar")
async def quitar_aula_semestre(
    body: AulaToggleBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deshabilita un aula del semestre."""
    require_director_or_admin(user)

    result = await db.execute(
        select(Semestre)
        .where(Semestre.id == body.semestre_id)
        .options(selectinload(Semestre.aulas))
    )
    semestre = result.scalar_one_or_none()
    if not semestre:
        raise HTTPException(status_code=404, detail="Semestre no encontrado")

    aula_result = await db.execute(select(Aula).where(Aula.id == body.aula_id))
    aula = aula_result.scalar_one_or_none()
    if not aula:
        raise HTTPException(status_code=404, detail="Aula no encontrada")

    if aula in semestre.aulas:
        semestre.aulas.remove(aula)
        await db.commit()

    return {"ok": True}
