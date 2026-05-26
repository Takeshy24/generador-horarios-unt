"""
Dataclasses inmutables del dominio del motor.
Desacoplan el algoritmo de SQLAlchemy — el motor solo conoce estos tipos.
"""

from dataclasses import dataclass, field
from datetime import time
from typing import Optional

# ── Constantes de slots ─────────────────────────────────────────────────────

DIAS = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB"]

# La grilla real del horario 2026-I usa una jornada continua:
# 7-8, 8-9, ..., 12-1, 1-2, ..., 8-9 p.m.
HORA_INICIO_JORNADA = 7
HORA_FIN_JORNADA = 20
ALL_STARTS = list(range(HORA_INICIO_JORNADA, HORA_FIN_JORNADA + 1))

# Alias conservados para compatibilidad con vistas/reportes existentes.
MANANA_STARTS = list(range(7, 14))     # [7, 8, 9, 10, 11, 12, 13]
TARDE_STARTS = list(range(14, 21))     # [14, 15, 16, 17, 18, 19, 20]

LAB_AULAS_GENERICAS = {"lab_computo"}


def tipo_aula_compatible(tipo_requerido: str, tipo_aula: str) -> bool:
    """Compatibilidad realista: los labs genericos pueden cubrir labs especializados."""
    if tipo_requerido == tipo_aula:
        return True
    if tipo_requerido.startswith("lab_") and tipo_aula in LAB_AULAS_GENERICAS:
        return True
    return False

# Tope CHL por régimen (Art. 12 Reglamento UNT)
TOPES_REGIMEN: dict[str, int] = {
    "DE":          22,
    "TC":          20,
    "TP1":         12,
    "TP2":         10,
    "TP3":          8,
    "CONTRATO_A1":  8,
    "CONTRATO_A2": 10,
    "CONTRATO_A3": 12,
    "CONTRATO_B1":  8,
    "CONTRATO_B2": 10,
    "CONTRATO_B3": 12,
}

# Reducción de tope por cargo administrativo (Art. 12.3)
REDUCCION_POR_CARGO: dict[str, int] = {
    "director_escuela": 12,
    "director_depto":   10,
    "jefe_departamento": 8,
}


# ── Helpers de tiempo ────────────────────────────────────────────────────────

def hora_fin_bloque(hora_inicio_h: int, n_slots: int) -> time:
    """
    Calcula hora_fin de un bloque de n_slots comenzando a hora_inicio_h.
    Ej: hora_inicio=7, n_slots=3 → time(9, 50)  [slots 7:00, 8:00, 9:00]
    """
    return time(hora_inicio_h + n_slots - 1, 50)


def overlaps(a_ini: time, a_fin: time, b_ini: time, b_fin: time) -> bool:
    """True si los intervalos [a_ini, a_fin) y [b_ini, b_fin) se solapan."""
    return a_ini < b_fin and b_ini < a_fin


def usa_slot_mediodia(hora_inicio: time, hora_fin: time) -> bool:
    """True si el bloque ocupa o cruza el slot de las 12:00."""
    return hora_inicio <= time(12, 0) < hora_fin


# ── Dataclasses de entrada ────────────────────────────────────────────────────

@dataclass(frozen=True)
class DisponibilidadSlot:
    dia: str
    hora_inicio: time
    hora_fin: time


@dataclass(frozen=True)
class DocenteDomain:
    id: int
    nombre: str
    tipo: str            # 'nombrado' | 'contratado'
    antiguedad_anios: float
    disponibilidad: tuple  # tuple[DisponibilidadSlot, ...]
    tope_horas: int


@dataclass(frozen=True)
class AulaDomain:
    id: int
    codigo: str
    tipo: str            # 'comun' | 'lab_computo' | ...
    capacidad: int


@dataclass(frozen=True)
class ComponenteDomain:
    id: int
    seccion_id: int
    curso_id: int
    curso_nombre: str
    ciclo: int
    tipo_componente: str    # 'T' | 'P' | 'L'
    docente_id: Optional[int]
    horas_semanales: int
    num_alumnos: int
    tipo_aula_requerido: str  # 'comun' para T/P, 'lab_X' para L
    seccion_letra: str = ""
    curso_codigo: str = ""
    grupo_lab_numero: int | None = None


# ── Dataclasses de salida ─────────────────────────────────────────────────────

@dataclass(frozen=True)
class SlotAsignado:
    componente_id: int
    dia: str
    hora_inicio: time
    hora_fin: time
    aula_id: int


@dataclass
class InfactibilidadInfo:
    componente_id: int
    curso_nombre: str
    ciclo: int
    tipo_componente: str
    causa: str
    sugerencias: list[str] = field(default_factory=list)
    restriccion_principal: str = ""   # "R1", "R3", "R6", "ORDEN", etc.
    docente_nombre: str = ""
    seccion_letra: str = ""


@dataclass
class ResultadoGeneracion:
    exitoso: bool
    asignaciones: list[SlotAsignado]
    infactibles: list[InfactibilidadInfo]
    tiempo_segundos: float
    total_componentes: int
    componentes_colocados: int

    @property
    def porcentaje_colocado(self) -> float:
        if self.total_componentes == 0:
            return 100.0
        return round(100 * self.componentes_colocados / self.total_componentes, 1)
