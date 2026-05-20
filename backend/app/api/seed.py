from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models import (
    Docente, Curso, Aula, ComponenteAProgramar, User,
    Seccion, GrupoLab, DocenteDisponibilidad,
)

router = APIRouter(tags=["seed"])


@router.get("/summary")
async def seed_summary(db: AsyncSession = Depends(get_db)):
    async def count(model) -> int:
        result = await db.execute(select(func.count()).select_from(model))
        return result.scalar_one()

    return {
        "docentes": await count(Docente),
        "cursos": await count(Curso),
        "aulas": await count(Aula),
        "secciones": await count(Seccion),
        "grupos_lab": await count(GrupoLab),
        "componentes_a_programar": await count(ComponenteAProgramar),
        "disponibilidades": await count(DocenteDisponibilidad),
        "usuarios": await count(User),
    }
