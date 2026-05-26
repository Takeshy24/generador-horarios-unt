from datetime import date, time, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, Integer, Date, Time, DateTime, Boolean, ForeignKey, Table, Column, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import (
    TipoAulaEnum, EstadoSemestreEnum, TipoComponenteEnum, DiaEnum
)

if TYPE_CHECKING:
    from app.models.institucional import Escuela
    from app.models.docente import Docente


# Tabla puente semestre <-> aulas
semestre_aulas_disponibles = Table(
    "semestre_aulas_disponibles",
    Base.metadata,
    Column("semestre_id", ForeignKey("semestres.id"), primary_key=True),
    Column("aula_id", ForeignKey("aulas.id"), primary_key=True),
)


class Curso(Base):
    __tablename__ = "cursos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    ciclo: Mapped[int] = mapped_column(Integer, nullable=False)
    escuela_id: Mapped[int] = mapped_column(ForeignKey("escuelas.id"), nullable=False)
    es_electivo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    horas_T: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    horas_P: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    horas_L: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tipo_lab_requerido: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    escuela: Mapped["Escuela"] = relationship(back_populates="cursos")
    secciones: Mapped[List["Seccion"]] = relationship(back_populates="curso")


class Aula(Base):
    __tablename__ = "aulas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    tipo: Mapped[TipoAulaEnum] = mapped_column(nullable=False)
    capacidad: Mapped[int] = mapped_column(Integer, nullable=False)
    ubicacion: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    semestres: Mapped[List["Semestre"]] = relationship(
        secondary=semestre_aulas_disponibles, back_populates="aulas"
    )
    bloques: Mapped[List["HorarioBloque"]] = relationship(back_populates="aula")
    reservas_recuperacion: Mapped[List["ReservaRecuperacion"]] = relationship(back_populates="aula")


class Semestre(Base):
    __tablename__ = "semestres"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[date] = mapped_column(Date, nullable=False)
    escuela_id: Mapped[int] = mapped_column(ForeignKey("escuelas.id"), nullable=False)
    estado: Mapped[EstadoSemestreEnum] = mapped_column(nullable=False, default=EstadoSemestreEnum.configurando)

    escuela: Mapped["Escuela"] = relationship(back_populates="semestres")
    secciones: Mapped[List["Seccion"]] = relationship(back_populates="semestre")
    aulas: Mapped[List["Aula"]] = relationship(
        secondary=semestre_aulas_disponibles, back_populates="semestres"
    )
    bloques: Mapped[List["HorarioBloque"]] = relationship(back_populates="semestre")
    reservas_recuperacion: Mapped[List["ReservaRecuperacion"]] = relationship(back_populates="semestre")


class Seccion(Base):
    __tablename__ = "secciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    curso_id: Mapped[int] = mapped_column(ForeignKey("cursos.id"), nullable=False)
    semestre_id: Mapped[int] = mapped_column(ForeignKey("semestres.id"), nullable=False)
    letra: Mapped[str] = mapped_column(String(2), nullable=False, default="A")
    num_alumnos: Mapped[int] = mapped_column(Integer, nullable=False)

    curso: Mapped["Curso"] = relationship(back_populates="secciones")
    semestre: Mapped["Semestre"] = relationship(back_populates="secciones")
    grupos_lab: Mapped[List["GrupoLab"]] = relationship(back_populates="seccion")
    componentes: Mapped[List["ComponenteAProgramar"]] = relationship(back_populates="seccion")


class GrupoLab(Base):
    __tablename__ = "grupos_lab"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    seccion_id: Mapped[int] = mapped_column(ForeignKey("secciones.id"), nullable=False)
    numero: Mapped[int] = mapped_column(Integer, nullable=False)
    num_alumnos: Mapped[int] = mapped_column(Integer, nullable=False)

    seccion: Mapped["Seccion"] = relationship(back_populates="grupos_lab")
    componentes: Mapped[List["ComponenteAProgramar"]] = relationship(back_populates="grupo_lab")


class ComponenteAProgramar(Base):
    __tablename__ = "componentes_a_programar"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    seccion_id: Mapped[int] = mapped_column(ForeignKey("secciones.id"), nullable=False)
    tipo: Mapped[TipoComponenteEnum] = mapped_column(nullable=False)
    docente_id: Mapped[Optional[int]] = mapped_column(ForeignKey("docentes.id"), nullable=True)
    horas_semanales: Mapped[int] = mapped_column(Integer, nullable=False)
    grupo_lab_id: Mapped[Optional[int]] = mapped_column(ForeignKey("grupos_lab.id"), nullable=True)

    seccion: Mapped["Seccion"] = relationship(back_populates="componentes")
    docente: Mapped[Optional["Docente"]] = relationship(back_populates="componentes")
    grupo_lab: Mapped[Optional["GrupoLab"]] = relationship(back_populates="componentes")
    bloques: Mapped[List["HorarioBloque"]] = relationship(back_populates="componente")


class HorarioBloque(Base):
    __tablename__ = "horario_bloques"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    semestre_id: Mapped[int] = mapped_column(ForeignKey("semestres.id"), nullable=False)
    componente_id: Mapped[int] = mapped_column(ForeignKey("componentes_a_programar.id"), nullable=False)
    dia: Mapped[DiaEnum] = mapped_column(nullable=False)
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    hora_fin: Mapped[time] = mapped_column(Time, nullable=False)
    aula_id: Mapped[int] = mapped_column(ForeignKey("aulas.id"), nullable=False)

    semestre: Mapped["Semestre"] = relationship(back_populates="bloques")
    componente: Mapped["ComponenteAProgramar"] = relationship(back_populates="bloques")
    aula: Mapped["Aula"] = relationship(back_populates="bloques")


class ReservaRecuperacion(Base):
    __tablename__ = "reservas_recuperacion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    docente_id: Mapped[int] = mapped_column(ForeignKey("docentes.id"), nullable=False)
    aula_id: Mapped[int] = mapped_column(ForeignKey("aulas.id"), nullable=False)
    semestre_id: Mapped[int] = mapped_column(ForeignKey("semestres.id"), nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    hora_fin: Mapped[time] = mapped_column(Time, nullable=False)
    motivo: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    docente: Mapped["Docente"] = relationship(back_populates="reservas_recuperacion")
    aula: Mapped["Aula"] = relationship(back_populates="reservas_recuperacion")
    semestre: Mapped["Semestre"] = relationship(back_populates="reservas_recuperacion")
