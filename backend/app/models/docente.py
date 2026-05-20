from datetime import date, time
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, Integer, Date, Time, Boolean, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import (
    TipoDocenteEnum, RegimenEnum, CategoriaEnum,
    DiaEnum, TurnoEnum
)

if TYPE_CHECKING:
    from app.models.institucional import Departamento, User
    from app.models.academico import ComponenteAProgramar


class Docente(Base):
    __tablename__ = "docentes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dni: Mapped[str] = mapped_column(String(8), nullable=False, unique=True)
    nombre_completo: Mapped[str] = mapped_column(String(200), nullable=False)
    tipo: Mapped[TipoDocenteEnum] = mapped_column(nullable=False)
    fecha_ingreso: Mapped[date] = mapped_column(Date, nullable=False)
    regimen: Mapped[RegimenEnum] = mapped_column(nullable=False)
    categoria: Mapped[Optional[CategoriaEnum]] = mapped_column(nullable=True)
    departamento_id: Mapped[int] = mapped_column(ForeignKey("departamentos.id"), nullable=False)

    departamento: Mapped["Departamento"] = relationship(back_populates="docentes")
    user: Mapped[Optional["User"]] = relationship(back_populates="docente")
    cargos: Mapped[List["DocenteCargo"]] = relationship(back_populates="docente")
    disponibilidades: Mapped[List["DocenteDisponibilidad"]] = relationship(back_populates="docente")
    preferencias: Mapped[Optional["DocentePreferencias"]] = relationship(
        back_populates="docente", uselist=False
    )
    componentes: Mapped[List["ComponenteAProgramar"]] = relationship(back_populates="docente")


class DocenteCargo(Base):
    __tablename__ = "docente_cargos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    docente_id: Mapped[int] = mapped_column(ForeignKey("docentes.id"), nullable=False)
    cargo: Mapped[str] = mapped_column(String(100), nullable=False)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    docente: Mapped["Docente"] = relationship(back_populates="cargos")


class DocenteDisponibilidad(Base):
    __tablename__ = "docente_disponibilidad"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    docente_id: Mapped[int] = mapped_column(ForeignKey("docentes.id"), nullable=False)
    dia: Mapped[DiaEnum] = mapped_column(nullable=False)
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    hora_fin: Mapped[time] = mapped_column(Time, nullable=False)

    docente: Mapped["Docente"] = relationship(back_populates="disponibilidades")


class DocentePreferencias(Base):
    __tablename__ = "docente_preferencias"

    docente_id: Mapped[int] = mapped_column(ForeignKey("docentes.id"), primary_key=True)
    turno_preferido: Mapped[TurnoEnum] = mapped_column(nullable=False, default=TurnoEnum.indiferente)
    max_horas_seguidas: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    dias_evitar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    docente: Mapped["Docente"] = relationship(back_populates="preferencias")
