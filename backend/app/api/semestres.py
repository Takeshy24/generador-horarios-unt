from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.db import get_db
from app.models import Semestre
from app.models.enums import EstadoSemestreEnum

router = APIRouter(prefix="/semestres", tags=["semestres"])


@router.get("/activo")
async def get_semestre_activo(db: AsyncSession = Depends(get_db)):
    # Preferir semestre no publicado; si no existe, devolver el más reciente (puede ser publicado)
    result = await db.execute(
        select(Semestre)
        .where(Semestre.estado != EstadoSemestreEnum.publicado)
        .order_by(Semestre.fecha_inicio.desc())
        .limit(1)
    )
    semestre = result.scalar_one_or_none()

    if not semestre:
        # Buscar el semestre publicado más reciente
        result2 = await db.execute(
            select(Semestre).order_by(Semestre.fecha_inicio.desc()).limit(1)
        )
        semestre = result2.scalar_one_or_none()

    if not semestre:
        raise HTTPException(status_code=404, detail="No hay semestre en el sistema")

    return {
        "id": semestre.id,
        "codigo": semestre.codigo,
        "fecha_inicio": semestre.fecha_inicio.isoformat(),
        "fecha_fin": semestre.fecha_fin.isoformat(),
        "estado": semestre.estado.value,
    }
