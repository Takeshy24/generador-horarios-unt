"""
Endpoints administrativos (solo rol admin).
"""
import bcrypt
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api.auth_routes import get_current_user
from app.core.db import get_db
from app.models import HorarioBloque, Semestre, User, Docente, Curso, Aula
from app.models.institucional import Departamento, Escuela
from app.models.enums import (
    EstadoSemestreEnum, RoleEnum, TipoDocenteEnum, RegimenEnum,
    CategoriaEnum, TipoAulaEnum,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(user: User):
    if user.role != RoleEnum.admin:
        raise HTTPException(status_code=403, detail="Solo el Administrador puede realizar esta acción")


# ─── Helpers ───────────────────────────────────────────────────────────────────

@router.get("/departamentos")
async def list_departamentos(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    result = await db.execute(select(Departamento).order_by(Departamento.nombre))
    return [{"id": d.id, "nombre": d.nombre} for d in result.scalars().all()]


@router.get("/escuelas")
async def list_escuelas(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    result = await db.execute(select(Escuela).order_by(Escuela.nombre))
    return [{"id": e.id, "nombre": e.nombre} for e in result.scalars().all()]


# ─── Docentes CRUD ─────────────────────────────────────────────────────────────

class DocenteIn(BaseModel):
    dni: str
    nombre_completo: str
    tipo: TipoDocenteEnum
    fecha_ingreso: date
    regimen: RegimenEnum
    categoria: Optional[CategoriaEnum] = None
    departamento_id: int


@router.get("/docentes")
async def list_docentes(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    result = await db.execute(select(Docente).order_by(Docente.nombre_completo))
    docentes = result.scalars().all()

    depto_ids = {d.departamento_id for d in docentes}
    depto_map: dict[int, str] = {}
    if depto_ids:
        dr = await db.execute(select(Departamento).where(Departamento.id.in_(depto_ids)))
        depto_map = {d.id: d.nombre for d in dr.scalars().all()}

    return [
        {
            "id": d.id,
            "dni": d.dni,
            "nombre_completo": d.nombre_completo,
            "tipo": d.tipo.value,
            "fecha_ingreso": d.fecha_ingreso.isoformat(),
            "regimen": d.regimen.value,
            "categoria": d.categoria.value if d.categoria else None,
            "departamento_id": d.departamento_id,
            "departamento_nombre": depto_map.get(d.departamento_id, ""),
        }
        for d in docentes
    ]


@router.post("/docentes", status_code=201)
async def create_docente(
    body: DocenteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    existing = await db.execute(select(Docente).where(Docente.dni == body.dni))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un docente con ese DNI")

    docente = Docente(
        dni=body.dni,
        nombre_completo=body.nombre_completo,
        tipo=body.tipo,
        fecha_ingreso=body.fecha_ingreso,
        regimen=body.regimen,
        categoria=body.categoria,
        departamento_id=body.departamento_id,
    )
    db.add(docente)
    await db.commit()
    await db.refresh(docente)
    return {"ok": True, "id": docente.id}


@router.put("/docentes/{docente_id}")
async def update_docente(
    docente_id: int,
    body: DocenteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    result = await db.execute(select(Docente).where(Docente.id == docente_id))
    docente = result.scalar_one_or_none()
    if not docente:
        raise HTTPException(status_code=404, detail="Docente no encontrado")

    if body.dni != docente.dni:
        existing = await db.execute(select(Docente).where(Docente.dni == body.dni))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe un docente con ese DNI")

    docente.dni = body.dni
    docente.nombre_completo = body.nombre_completo
    docente.tipo = body.tipo
    docente.fecha_ingreso = body.fecha_ingreso
    docente.regimen = body.regimen
    docente.categoria = body.categoria
    docente.departamento_id = body.departamento_id
    await db.commit()
    return {"ok": True}


@router.delete("/docentes/{docente_id}")
async def delete_docente(
    docente_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    result = await db.execute(select(Docente).where(Docente.id == docente_id))
    docente = result.scalar_one_or_none()
    if not docente:
        raise HTTPException(status_code=404, detail="Docente no encontrado")
    await db.delete(docente)
    await db.commit()
    return {"ok": True}


# ─── Cursos CRUD ───────────────────────────────────────────────────────────────

class CursoIn(BaseModel):
    codigo: str
    nombre: str
    ciclo: int
    escuela_id: int
    es_electivo: bool = False
    horas_T: int = 0
    horas_P: int = 0
    horas_L: int = 0
    tipo_lab_requerido: Optional[str] = None


@router.get("/cursos")
async def list_cursos(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    result = await db.execute(select(Curso).order_by(Curso.ciclo, Curso.nombre))
    cursos = result.scalars().all()
    return [
        {
            "id": c.id,
            "codigo": c.codigo,
            "nombre": c.nombre,
            "ciclo": c.ciclo,
            "escuela_id": c.escuela_id,
            "es_electivo": c.es_electivo,
            "horas_T": c.horas_T,
            "horas_P": c.horas_P,
            "horas_L": c.horas_L,
            "tipo_lab_requerido": c.tipo_lab_requerido,
        }
        for c in cursos
    ]


@router.post("/cursos", status_code=201)
async def create_curso(
    body: CursoIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    existing = await db.execute(select(Curso).where(Curso.codigo == body.codigo))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un curso con ese código")

    curso = Curso(
        codigo=body.codigo,
        nombre=body.nombre,
        ciclo=body.ciclo,
        escuela_id=body.escuela_id,
        es_electivo=body.es_electivo,
        horas_T=body.horas_T,
        horas_P=body.horas_P,
        horas_L=body.horas_L,
        tipo_lab_requerido=body.tipo_lab_requerido or None,
    )
    db.add(curso)
    await db.commit()
    await db.refresh(curso)
    return {"ok": True, "id": curso.id}


@router.put("/cursos/{curso_id}")
async def update_curso(
    curso_id: int,
    body: CursoIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    result = await db.execute(select(Curso).where(Curso.id == curso_id))
    curso = result.scalar_one_or_none()
    if not curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    if body.codigo != curso.codigo:
        existing = await db.execute(select(Curso).where(Curso.codigo == body.codigo))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe un curso con ese código")

    curso.codigo = body.codigo
    curso.nombre = body.nombre
    curso.ciclo = body.ciclo
    curso.escuela_id = body.escuela_id
    curso.es_electivo = body.es_electivo
    curso.horas_T = body.horas_T
    curso.horas_P = body.horas_P
    curso.horas_L = body.horas_L
    curso.tipo_lab_requerido = body.tipo_lab_requerido or None
    await db.commit()
    return {"ok": True}


@router.delete("/cursos/{curso_id}")
async def delete_curso(
    curso_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    result = await db.execute(select(Curso).where(Curso.id == curso_id))
    curso = result.scalar_one_or_none()
    if not curso:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    await db.delete(curso)
    await db.commit()
    return {"ok": True}


# ─── Aulas CRUD ────────────────────────────────────────────────────────────────

class AulaIn(BaseModel):
    codigo: str
    tipo: TipoAulaEnum
    capacidad: int
    ubicacion: Optional[str] = None


@router.get("/aulas")
async def list_aulas(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    result = await db.execute(select(Aula).order_by(Aula.codigo))
    return [
        {
            "id": a.id,
            "codigo": a.codigo,
            "tipo": a.tipo.value,
            "capacidad": a.capacidad,
            "ubicacion": a.ubicacion,
        }
        for a in result.scalars().all()
    ]


@router.post("/aulas", status_code=201)
async def create_aula(
    body: AulaIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    existing = await db.execute(select(Aula).where(Aula.codigo == body.codigo))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un aula con ese código")

    aula = Aula(
        codigo=body.codigo,
        tipo=body.tipo,
        capacidad=body.capacidad,
        ubicacion=body.ubicacion or None,
    )
    db.add(aula)
    await db.commit()
    await db.refresh(aula)
    return {"ok": True, "id": aula.id}


@router.put("/aulas/{aula_id}")
async def update_aula(
    aula_id: int,
    body: AulaIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    result = await db.execute(select(Aula).where(Aula.id == aula_id))
    aula = result.scalar_one_or_none()
    if not aula:
        raise HTTPException(status_code=404, detail="Aula no encontrada")

    if body.codigo != aula.codigo:
        existing = await db.execute(select(Aula).where(Aula.codigo == body.codigo))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe un aula con ese código")

    aula.codigo = body.codigo
    aula.tipo = body.tipo
    aula.capacidad = body.capacidad
    aula.ubicacion = body.ubicacion or None
    await db.commit()
    return {"ok": True}


@router.delete("/aulas/{aula_id}")
async def delete_aula(
    aula_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    result = await db.execute(select(Aula).where(Aula.id == aula_id))
    aula = result.scalar_one_or_none()
    if not aula:
        raise HTTPException(status_code=404, detail="Aula no encontrada")
    await db.delete(aula)
    await db.commit()
    return {"ok": True}


# ─── Usuarios CRUD ─────────────────────────────────────────────────────────────

class UsuarioIn(BaseModel):
    email: str
    password: str
    role: RoleEnum
    docente_id: Optional[int] = None


class UsuarioUpdate(BaseModel):
    email: str
    password: Optional[str] = None
    role: RoleEnum
    docente_id: Optional[int] = None


@router.get("/usuarios")
async def list_usuarios(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    result = await db.execute(select(User).order_by(User.email))
    users = result.scalars().all()

    docente_ids = {u.docente_id for u in users if u.docente_id}
    docente_names: dict[int, str] = {}
    if docente_ids:
        dr = await db.execute(select(Docente).where(Docente.id.in_(docente_ids)))
        docente_names = {d.id: d.nombre_completo for d in dr.scalars().all()}

    return [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role.value,
            "docente_id": u.docente_id,
            "docente_nombre": docente_names.get(u.docente_id) if u.docente_id else None,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.post("/usuarios", status_code=201)
async def create_usuario(
    body: UsuarioIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese email")

    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    new_user = User(
        email=body.email,
        password_hash=password_hash,
        role=body.role,
        docente_id=body.docente_id,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return {"ok": True, "id": new_user.id}


@router.put("/usuarios/{user_id}")
async def update_usuario(
    user_id: int,
    body: UsuarioUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if body.email != target.email:
        existing = await db.execute(select(User).where(User.email == body.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe un usuario con ese email")

    target.email = body.email
    target.role = body.role
    target.docente_id = body.docente_id
    if body.password:
        target.password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    await db.commit()
    return {"ok": True}


@router.delete("/usuarios/{user_id}")
async def delete_usuario(
    user_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(user)
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await db.delete(target)
    await db.commit()
    return {"ok": True}


# ─── Reset Demo ────────────────────────────────────────────────────────────────

@router.post("/reset-demo")
async def reset_demo(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != RoleEnum.admin:
        raise HTTPException(status_code=403, detail="Solo el Administrador puede resetear la demo")

    result = await db.execute(
        select(Semestre).order_by(Semestre.fecha_inicio.desc()).limit(1)
    )
    semestre = result.scalar_one_or_none()
    if not semestre:
        raise HTTPException(status_code=404, detail="No hay semestre en la base de datos")

    deleted = await db.execute(
        delete(HorarioBloque).where(HorarioBloque.semestre_id == semestre.id)
    )
    n_deleted = deleted.rowcount
    semestre.estado = EstadoSemestreEnum.asignando
    await db.commit()

    return {
        "ok": True,
        "semestre_id": semestre.id,
        "semestre_codigo": semestre.codigo,
        "bloques_eliminados": n_deleted,
        "nuevo_estado": "asignando",
        "mensaje": f"Demo reseteada: {n_deleted} bloques eliminados, semestre en estado 'asignando'",
    }
