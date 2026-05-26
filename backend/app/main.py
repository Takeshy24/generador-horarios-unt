from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.db import engine
from app.api import health, seed, auth_routes, semestres, docentes_routes, asignaciones_routes
from app.api import horario as horario_routes
from app.api import pdf_routes, admin_routes, director_routes, recuperacion_routes, excel_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    print("[OK] Conexion a PostgreSQL establecida")
    yield
    await engine.dispose()


app = FastAPI(
    title="Generador de Horarios UNT",
    description="Sistema de generación automática de horarios — Escuela de Ing. de Sistemas UNT",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(seed.router, prefix="/api/seed", tags=["seed"])
app.include_router(auth_routes.router, prefix="/api")
app.include_router(semestres.router, prefix="/api")
app.include_router(docentes_routes.router, prefix="/api")
app.include_router(asignaciones_routes.router, prefix="/api")
app.include_router(horario_routes.router, prefix="/api")
app.include_router(pdf_routes.router, prefix="/api")
app.include_router(admin_routes.router, prefix="/api")
app.include_router(director_routes.router, prefix="/api")
app.include_router(recuperacion_routes.router, prefix="/api")
app.include_router(excel_routes.router, prefix="/api")
