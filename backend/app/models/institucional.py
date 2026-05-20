from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import RoleEnum

if TYPE_CHECKING:
    from app.models.docente import Docente
    from app.models.academico import Curso, Semestre


class Facultad(Base):
    __tablename__ = "facultades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)

    escuelas: Mapped[List["Escuela"]] = relationship(back_populates="facultad")
    departamentos: Mapped[List["Departamento"]] = relationship(back_populates="facultad")


class Escuela(Base):
    __tablename__ = "escuelas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    facultad_id: Mapped[int] = mapped_column(ForeignKey("facultades.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)

    facultad: Mapped["Facultad"] = relationship(back_populates="escuelas")
    cursos: Mapped[List["Curso"]] = relationship(back_populates="escuela")
    semestres: Mapped[List["Semestre"]] = relationship(back_populates="escuela")


class Departamento(Base):
    __tablename__ = "departamentos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    facultad_id: Mapped[int] = mapped_column(ForeignKey("facultades.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)

    facultad: Mapped["Facultad"] = relationship(back_populates="departamentos")
    docentes: Mapped[List["Docente"]] = relationship(back_populates="departamento")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[RoleEnum] = mapped_column(nullable=False)
    docente_id: Mapped[Optional[int]] = mapped_column(ForeignKey("docentes.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    docente: Mapped[Optional["Docente"]] = relationship(back_populates="user")
