"""
Enriquece los infactibles con causas específicas diagnosticadas probando todos
los slots posibles y contando qué restricción falla con mayor frecuencia.
"""

import logging
from collections import Counter, defaultdict

from .tipos import (
    ComponenteDomain, DocenteDomain, AulaDomain, InfactibilidadInfo, SlotAsignado,
    DIAS, ALL_STARTS, tipo_aula_compatible,
)
from .restricciones import verificar_todas, r8_horario_franja_correcta

logger = logging.getLogger(__name__)

_RESTRICCION_LABEL: dict[str, str] = {
    "R1":  "conflicto de docente",
    "R2":  "conflicto de aula",
    "R3":  "conflicto de ciclo",
    "R4":  "tipo de aula incorrecto",
    "R5":  "capacidad insuficiente",
    "R6":  "disponibilidad del docente",
    "R8":  "franja horaria",
    "R9":  "tope de carga",
    "R11": "hora de almuerzo",
}


def _diagnosticar(
    comp: ComponenteDomain,
    docente: DocenteDomain | None,
    aulas: list[AulaDomain],
    estado: list[SlotAsignado],
    componentes_map: dict[int, ComponenteDomain],
) -> tuple[str, str, list[str]]:
    """
    Sondea todos los slots (dia × hora × aula) y retorna
    (restriccion_principal, causa_especifica, sugerencias).
    """
    docente_str = docente.nombre if docente else "Sin docente"

    # ── R4 / R5: verificar pool de aulas sin necesidad de sondear ────────────
    aulas_tipo_ok = [
        a for a in aulas
        if tipo_aula_compatible(comp.tipo_aula_requerido, a.tipo)
    ]
    if not aulas_tipo_ok:
        return (
            "R4",
            f"No existe ningún aula de tipo '{comp.tipo_aula_requerido}' "
            f"habilitada para este semestre",
            [
                f"Habilitar al menos un aula de tipo '{comp.tipo_aula_requerido}' "
                f"en el pool del semestre",
            ],
        )

    aulas_cap_ok = [a for a in aulas_tipo_ok if a.capacidad >= comp.num_alumnos]
    if not aulas_cap_ok:
        max_cap = max(a.capacidad for a in aulas_tipo_ok)
        return (
            "R5",
            f"Las {len(aulas_tipo_ok)} aula(s) de tipo '{comp.tipo_aula_requerido}' "
            f"tienen capacidad máxima {max_cap}, insuficiente para "
            f"{comp.num_alumnos} alumnos de la sección",
            [
                f"Dividir el grupo en subgrupos de ≤{max_cap} alumnos",
                f"Habilitar un aula de tipo '{comp.tipo_aula_requerido}' "
                f"con capacidad ≥{comp.num_alumnos}",
            ],
        )

    # ── Sondeo de slots ───────────────────────────────────────────────────────
    counter: Counter[str] = Counter()
    samples: dict[str, list[str]] = defaultdict(list)
    valid_slots = 0

    for dia in DIAS:
        for start_h in ALL_STARTS:
            r8_ok, _ = r8_horario_franja_correcta(start_h, comp.horas_semanales)
            if not r8_ok:
                continue
            for aula in aulas_cap_ok:
                violaciones = verificar_todas(
                    comp, dia, start_h, aula, estado, docente, componentes_map,
                )
                if not violaciones:
                    valid_slots += 1
                else:
                    for v in violaciones:
                        counter[v.restriccion] += 1
                        if len(samples[v.restriccion]) < 2:
                            samples[v.restriccion].append(v.mensaje)

    # Slots libres en estado final → problema de orden del greedy
    if valid_slots > 0:
        return (
            "ORDEN",
            f"El motor greedy no logró ubicar este componente en el orden de "
            f"prioridad aplicado ({valid_slots} slot(s) potencialmente libres "
            f"en el estado final)",
            ["Regenerar el horario puede resolver este conflicto automáticamente"],
        )

    if not counter:
        return (
            "DESCONOCIDO",
            "Combinación de restricciones impide cualquier slot válido",
            [
                "Revisar disponibilidad de docentes del ciclo",
                "Ampliar el pool de aulas disponibles para este semestre",
            ],
        )

    # ── Causa principal: la restricción que bloquea más slots ─────────────────
    rest = counter.most_common(1)[0][0]
    sample = samples[rest][0] if samples[rest] else ""

    horas_disp = (
        sum(d.hora_fin.hour - d.hora_inicio.hour for d in docente.disponibilidad)
        if docente else 0
    )

    if rest == "R1":
        causa = (
            f"El docente {docente_str} ya tiene otras clases asignadas en sus "
            f"slots disponibles. {sample}"
        ).strip()
        sugerencias = [
            f"Revisar la carga total del docente {docente_str} — "
            f"puede tener demasiados componentes concentrados",
            f"Reasignar '{comp.curso_nombre}' a un docente con slots libres",
        ]

    elif rest == "R2":
        causa = (
            f"Las aulas de tipo '{comp.tipo_aula_requerido}' están ocupadas "
            f"en los slots disponibles del docente {docente_str}. {sample}"
        ).strip()
        sugerencias = [
            f"Ampliar el pool de aulas de tipo '{comp.tipo_aula_requerido}' "
            f"para este semestre",
            "Verificar si alguna aula puede habilitarse en horario adicional",
        ]

    elif rest == "R3":
        causa = (
            f"El ciclo {comp.ciclo} ya tiene cursos asignados en los horarios "
            f"compatibles con la disponibilidad del docente. {sample}"
        ).strip()
        sugerencias = [
            f"El ciclo {comp.ciclo} tiene cursos concentrados — "
            f"revisar la distribución horaria del ciclo",
            "Considerar si algún otro curso del ciclo puede moverse",
        ]

    elif rest == "R6":
        causa = (
            f"El docente {docente_str} no está disponible en ningún slot "
            f"compatible (componente requiere {comp.horas_semanales}h, "
            f"disponibilidad declarada: {horas_disp}h). {sample}"
        ).strip()
        sugerencias = [
            f"Registrar disponibilidad adicional para el docente {docente_str} "
            f"(mínimo {comp.horas_semanales}h libres sin conflicto)",
            f"Reasignar '{comp.curso_nombre}' a un docente con horario compatible",
        ]

    elif rest == "R9":
        causa = (
            f"El docente {docente_str} ha alcanzado su tope de carga horaria. "
            f"{sample}"
        ).strip()
        sugerencias = [
            f"El docente {docente_str} ya tiene demasiadas horas asignadas",
            f"Reasignar '{comp.curso_nombre}' a un docente con carga libre",
        ]

    elif rest == "R11":
        causa = (
            f"Colocar este componente eliminaría la hora de almuerzo del "
            f"ciclo {comp.ciclo}. {sample}"
        ).strip()
        sugerencias = [
            f"Distribuir los cursos del ciclo {comp.ciclo} preservando "
            f"la franja 12:00–14:00 al menos en un día",
        ]

    else:
        label = _RESTRICCION_LABEL.get(rest, rest)
        causa = sample or f"Bloqueado principalmente por {label}"
        sugerencias = [
            "Revisar disponibilidad de docentes y aulas del ciclo",
            "Ampliar el pool de aulas disponibles para este semestre",
        ]

    return rest, causa, sugerencias


def enriquecer_infactibles(
    infactibles: list[InfactibilidadInfo],
    componentes_map: dict[int, ComponenteDomain],
    docentes_map: dict[int, DocenteDomain],
    aulas: list[AulaDomain],
    estado: list[SlotAsignado],
) -> list[InfactibilidadInfo]:
    """
    Para cada infactible, sondea todos los slots del semestre y determina
    la restricción que bloquea con mayor frecuencia.
    Modifica los objetos in-place y los retorna.
    """
    for inf in infactibles:
        comp = componentes_map.get(inf.componente_id)
        if comp is None:
            continue

        docente = docentes_map.get(comp.docente_id) if comp.docente_id else None

        rest, causa, sugerencias = _diagnosticar(
            comp, docente, aulas, estado, componentes_map,
        )

        inf.causa = causa
        inf.sugerencias = sugerencias
        inf.restriccion_principal = rest
        inf.docente_nombre = docente.nombre if docente else ""
        inf.seccion_letra = comp.seccion_letra

        logger.debug(
            "Infactible [%s] %s-%s → %s",
            rest, inf.curso_nombre, inf.tipo_componente, causa[:80],
        )

    return infactibles
