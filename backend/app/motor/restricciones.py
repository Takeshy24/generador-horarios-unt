"""
11 restricciones duras del motor de generación de horarios.

Cada función recibe el estado actual y el slot candidato; retorna (cumple, razon).
R7 es estructural (siempre true), R10 se verifica al final del proceso.
"""

from datetime import time
from dataclasses import dataclass
from typing import Optional

from .tipos import ComponenteDomain, SlotAsignado, DocenteDomain, AulaDomain


@dataclass(frozen=True)
class Violacion:
    restriccion: str
    mensaje: str


# ── Helpers internos ──────────────────────────────────────────────────────────

def _horas_del_slot(slot: SlotAsignado) -> set[int]:
    """Horas del día ocupadas por un SlotAsignado (e.g. 7:00-9:50 → {7,8,9})."""
    return set(range(slot.hora_inicio.hour, slot.hora_fin.hour + 1))


def _horas_propuestas(start_h: int, n: int) -> set[int]:
    return set(range(start_h, start_h + n))


# ── R1: Docente no puede estar en 2 aulas a la vez ───────────────────────────

def r1_docente_no_doble_aula(
    comp: ComponenteDomain,
    dia: str,
    start_h: int,
    estado: list[SlotAsignado],
    componentes_map: dict[int, ComponenteDomain],
) -> tuple[bool, str]:
    if comp.docente_id is None:
        return True, ""

    propuestas = _horas_propuestas(start_h, comp.horas_semanales)
    for slot in estado:
        if slot.dia != dia:
            continue
        otro = componentes_map[slot.componente_id]
        if otro.docente_id == comp.docente_id:
            solapadas = propuestas & _horas_del_slot(slot)
            if solapadas:
                return False, (
                    f"Docente ya tiene clase a las {min(solapadas)}:00 el {dia}"
                )
    return True, ""


# ── R2: Un aula no puede tener 2 clases a la vez ─────────────────────────────

def r2_aula_no_doble_clase(
    dia: str,
    start_h: int,
    n_horas: int,
    aula_id: int,
    estado: list[SlotAsignado],
) -> tuple[bool, str]:
    propuestas = _horas_propuestas(start_h, n_horas)
    for slot in estado:
        if slot.dia == dia and slot.aula_id == aula_id:
            solapadas = propuestas & _horas_del_slot(slot)
            if solapadas:
                return False, (
                    f"Aula ocupada a las {min(solapadas)}:00 el {dia}"
                )
    return True, ""


# ── R3: Alumnos del mismo ciclo no pueden tener 2 componentes simultáneos ─────
#        Excepción: labs paralelos de distintos grupos del mismo curso

def r3_ciclo_no_doble_componente(
    comp: ComponenteDomain,
    dia: str,
    start_h: int,
    estado: list[SlotAsignado],
    componentes_map: dict[int, ComponenteDomain],
) -> tuple[bool, str]:
    propuestas = _horas_propuestas(start_h, comp.horas_semanales)
    for slot in estado:
        if slot.dia != dia:
            continue
        otro = componentes_map[slot.componente_id]
        if otro.ciclo != comp.ciclo:
            continue
        if not (propuestas & _horas_del_slot(slot)):
            continue

        # Excepción: labs paralelos de la misma sección (grupos distintos)
        if (
            comp.tipo_componente == "L"
            and otro.tipo_componente == "L"
            and comp.seccion_id == otro.seccion_id
        ):
            continue

        return False, (
            f"Ciclo {comp.ciclo} ya tiene '{otro.curso_nombre}' "
            f"a las {min(propuestas & _horas_del_slot(slot))}:00 el {dia}"
        )
    return True, ""


# ── R4: Tipo de aula correcto ─────────────────────────────────────────────────

def r4_tipo_aula_correcto(
    comp: ComponenteDomain,
    aula: AulaDomain,
) -> tuple[bool, str]:
    if comp.tipo_componente in ("T", "P"):
        if aula.tipo != "comun":
            return False, f"T/P requiere aula común, el aula es de tipo '{aula.tipo}'"
    else:  # L
        if aula.tipo != comp.tipo_aula_requerido:
            return False, (
                f"Lab requiere '{comp.tipo_aula_requerido}', "
                f"el aula es de tipo '{aula.tipo}'"
            )
    return True, ""


# ── R5: Capacidad suficiente ──────────────────────────────────────────────────

def r5_capacidad_suficiente(
    comp: ComponenteDomain,
    aula: AulaDomain,
) -> tuple[bool, str]:
    if aula.capacidad < comp.num_alumnos:
        return False, (
            f"Aula capacidad {aula.capacidad} < {comp.num_alumnos} alumnos del grupo"
        )
    return True, ""


# ── R6: Docente solo dicta dentro de su disponibilidad declarada ──────────────

def r6_dentro_de_disponibilidad(
    comp: ComponenteDomain,
    dia: str,
    start_h: int,
    docente: DocenteDomain,
) -> tuple[bool, str]:
    if comp.docente_id is None:
        return True, ""

    n = comp.horas_semanales
    proposed_start = time(start_h, 0)
    proposed_end = time(start_h + n - 1, 50)

    for disp in docente.disponibilidad:
        if (
            disp.dia == dia
            and disp.hora_inicio <= proposed_start
            and disp.hora_fin >= proposed_end
        ):
            return True, ""

    return False, (
        f"Docente no disponible el {dia} "
        f"de {start_h}:00 a {start_h + n - 1}:50"
    )


# ── R7: Bloques de 50 min ─────────────────────────────────────────────────────
#        Estructural: el generador solo crea slots de 50 min, siempre cumplida.

def r7_bloques_50_min() -> tuple[bool, str]:
    return True, ""


# ── R8: Franjas válidas: mañana (7-12) o tarde (14-19), sin cruzar el break ────

def r8_horario_franja_correcta(
    start_h: int,
    n_horas: int,
) -> tuple[bool, str]:
    end_h = start_h + n_horas - 1
    en_manana = (7 <= start_h and end_h <= 12)
    en_tarde = (14 <= start_h and end_h <= 19)
    if not (en_manana or en_tarde):
        return False, (
            f"Bloque {start_h}:00-{end_h}:50 cruza el break de mediodía (13-14h)"
        )
    return True, ""


# ── R9: Carga total del docente no excede su tope (Art. 12) ──────────────────

def r9_carga_dentro_de_tope(
    comp: ComponenteDomain,
    docente: DocenteDomain,
    estado: list[SlotAsignado],
    componentes_map: dict[int, ComponenteDomain],
) -> tuple[bool, str]:
    if comp.docente_id is None:
        return True, ""

    ya_colocadas = sum(
        slot.hora_fin.hour - slot.hora_inicio.hour + 1
        for slot in estado
        if componentes_map[slot.componente_id].docente_id == comp.docente_id
    )
    total = ya_colocadas + comp.horas_semanales
    if total > docente.tope_horas:
        return False, (
            f"Docente ya tiene {ya_colocadas}h + {comp.horas_semanales}h nuevas "
            f"= {total}h, excede tope {docente.tope_horas}h"
        )
    return True, ""


# ── R10: Horas semanales exactas ──────────────────────────────────────────────
#         Se verifica al finalizar el proceso, no durante la asignación de slots.

def r10_horas_semanales_exactas(
    componente_id: int,
    horas_esperadas: int,
    estado: list[SlotAsignado],
) -> tuple[bool, str]:
    colocadas = sum(
        slot.hora_fin.hour - slot.hora_inicio.hour + 1
        for slot in estado
        if slot.componente_id == componente_id
    )
    if colocadas != horas_esperadas:
        return False, (
            f"Componente tiene {colocadas}h colocadas, "
            f"se esperaban {horas_esperadas}h"
        )
    return True, ""


# ── R11: Ciclo debe tener ≥1h libre entre 12:00-14:00 cuando tiene mañana y tarde

def r11_hora_almuerzo_del_ciclo(
    comp: ComponenteDomain,
    dia: str,
    start_h: int,
    estado: list[SlotAsignado],
    componentes_map: dict[int, ComponenteDomain],
) -> tuple[bool, str]:
    n = comp.horas_semanales
    propuestas = _horas_propuestas(start_h, n)
    ciclo = comp.ciclo

    # Horas ya asignadas a este ciclo en este día
    horas_ciclo: set[int] = set()
    for slot in estado:
        otro = componentes_map[slot.componente_id]
        if otro.ciclo == ciclo and slot.dia == dia:
            horas_ciclo.update(_horas_del_slot(slot))

    todas = horas_ciclo | propuestas

    tiene_manana = any(7 <= h <= 11 for h in todas)
    tiene_mediodia = 12 in todas
    tiene_tarde = any(14 <= h <= 19 for h in todas)

    if tiene_manana and tiene_tarde and tiene_mediodia:
        return False, (
            f"Ciclo {ciclo} quedaría sin hora de almuerzo libre el {dia} "
            f"(sin franja libre en 12:00-14:00)"
        )
    return True, ""


# ── Función agregadora ────────────────────────────────────────────────────────

def verificar_todas(
    comp: ComponenteDomain,
    dia: str,
    start_h: int,
    aula: AulaDomain,
    estado: list[SlotAsignado],
    docente: Optional[DocenteDomain],
    componentes_map: dict[int, ComponenteDomain],
) -> list[Violacion]:
    """
    Verifica R1-R9, R11 para el slot candidato.
    R7 es estructural (omitida). R10 se verifica al final del proceso.
    Retorna lista de violaciones (vacía = slot válido).
    """
    violaciones: list[Violacion] = []

    def chk(nombre: str, resultado: tuple[bool, str]) -> None:
        ok, razon = resultado
        if not ok:
            violaciones.append(Violacion(nombre, razon))

    chk("R8", r8_horario_franja_correcta(start_h, comp.horas_semanales))
    if violaciones:
        return violaciones  # cortar temprano: franja inválida

    chk("R4", r4_tipo_aula_correcto(comp, aula))
    chk("R5", r5_capacidad_suficiente(comp, aula))

    if docente:
        chk("R6", r6_dentro_de_disponibilidad(comp, dia, start_h, docente))
        chk("R9", r9_carga_dentro_de_tope(comp, docente, estado, componentes_map))

    if not violaciones:
        chk("R1", r1_docente_no_doble_aula(comp, dia, start_h, estado, componentes_map))
        chk("R2", r2_aula_no_doble_clase(dia, start_h, comp.horas_semanales, aula.id, estado))
        chk("R3", r3_ciclo_no_doble_componente(comp, dia, start_h, estado, componentes_map))
        chk("R11", r11_hora_almuerzo_del_ciclo(comp, dia, start_h, estado, componentes_map))

    return violaciones
