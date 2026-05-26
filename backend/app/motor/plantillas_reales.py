"""Plantillas de horarios reales usadas como referencia por el motor.

La plantilla 2026-I replica la distribucion observada en el PDF
"Horarios x ciclos 2026-I 15 abril 2026" para los ciclos impares visibles.
Los bloques se guardan a nivel de celda horaria para admitir que una misma
asignatura se reparta en varias sesiones, tal como ocurre en el horario real.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class BloqueReferencial:
    ciclo: int
    curso_codigo: str
    dia: str
    hora_inicio: int
    duracion: int
    aula_codigo: str
    tipo_preferido: str | None = None


CURSOS_POR_NUMERO: dict[int, dict[int, str]] = {
    1: {
        1: "3311", 2: "3312", 3: "3313", 4: "3314", 5: "3315",
        6: "3316", 7: "3317", 8: "3301", 9: "3315",
    },
    3: {
        1: "3336", 2: "3332", 3: "3333", 4: "3334",
        5: "3335", 6: "3331", 7: "3337", 8: "3338",
    },
    5: {
        1: "3354", 2: "3352", 3: "3353", 4: "3356",
        5: "3355", 6: "3351", 7: "3357", 8: "3358",
    },
    7: {
        1: "3376", 2: "3375", 3: "3376", 4: "3378", 5: "3372",
        6: "3373", 7: "3377", 8: "3374", 9: "3378", 10: "3371",
    },
    9: {
        1: "3393", 2: "3394", 3: "3395", 4: "3392", 5: "3391",
        6: "3397", 7: "3396", 8: "3396", 9: "3398",
    },
}


def _aula(valor: str) -> str:
    return {
        "A303": "A-303",
        "A307": "A-307",
        "A311": "A-311",
        "LAB1": "LAB-1",
        "LAB2": "LAB-2",
        "LAB3": "LAB-3",
        "LAB4": "LAB-4",
        "AUD": "AUDIOVIS",
    }[valor]


# (ciclo, numero_en_pdf, dia, hora, aula_abreviada)
_CELDAS_2026_I: tuple[tuple[int, int, str, int, str], ...] = (
    # Ciclo I
    (1, 1, "LUN", 7, "A307"), (1, 7, "LUN", 9, "A307"),
    (1, 7, "LUN", 11, "A307"), (1, 1, "LUN", 14, "LAB3"),
    (1, 1, "LUN", 16, "LAB3"), (1, 5, "MAR", 11, "A307"),
    (1, 7, "MAR", 16, "A307"), (1, 8, "JUE", 7, "A307"),
    (1, 6, "JUE", 15, "A303"), (1, 9, "VIE", 14, "A303"),

    # Ciclo III
    (3, 3, "MIE", 7, "A303"), (3, 1, "LUN", 11, "LAB2"),
    (3, 1, "MAR", 11, "LAB2"), (3, 2, "MIE", 11, "A307"),
    (3, 1, "VIE", 11, "LAB4"), (3, 4, "JUE", 17, "A303"),
    (3, 1, "MAR", 17, "A307"), (3, 7, "MIE", 17, "LAB3"),
    (3, 7, "LUN", 20, "A307"), (3, 5, "MAR", 20, "LAB3"),
    (3, 5, "VIE", 20, "A303"),

    # Ciclo V
    (5, 4, "MIE", 7, "A307"), (5, 7, "VIE", 7, "LAB2"),
    (5, 1, "LUN", 8, "A303"), (5, 1, "MAR", 8, "LAB4"),
    (5, 5, "VIE", 10, "A307"), (5, 1, "LUN", 11, "LAB4"),
    (5, 1, "MAR", 11, "LAB4"), (5, 2, "MIE", 11, "A303"),
    (5, 6, "MAR", 14, "LAB2"), (5, 2, "MIE", 15, "LAB1"),
    (5, 5, "MIE", 15, "LAB2"), (5, 8, "VIE", 15, "A307"),
    (5, 4, "LUN", 16, "LAB1"), (5, 4, "MAR", 16, "LAB1"),
    (5, 4, "JUE", 16, "LAB4"), (5, 2, "MIE", 17, "LAB1"),
    (5, 5, "MIE", 17, "LAB2"), (5, 2, "MIE", 19, "LAB1"),
    (5, 5, "MIE", 19, "LAB2"), (5, 6, "VIE", 19, "A307"),
    (5, 6, "MAR", 20, "LAB2"),

    # Ciclo VII
    (7, 7, "JUE", 7, "A307"), (7, 3, "LUN", 8, "LAB1"),
    (7, 1, "MAR", 8, "LAB1"), (7, 10, "MIE", 8, "A307"),
    (7, 5, "VIE", 8, "A303"), (7, 8, "JUE", 10, "LAB3"),
    (7, 3, "LUN", 11, "LAB1"), (7, 2, "LUN", 11, "LAB3"),
    (7, 1, "MAR", 11, "A303"), (7, 5, "VIE", 11, "LAB1"),
    (7, 5, "VIE", 13, "LAB1"), (7, 2, "LUN", 14, "LAB2"),
    (7, 8, "MAR", 14, "A307"), (7, 8, "MIE", 14, "LAB4"),
    (7, 6, "JUE", 15, "A307"), (7, 9, "LUN", 15, "LAB4"),
    (7, 4, "MAR", 16, "A311"), (7, 8, "MIE", 16, "LAB4"),
    (7, 2, "VIE", 16, "A311"), (7, 2, "LUN", 17, "LAB2"),
    (7, 9, "LUN", 17, "LAB4"), (7, 8, "MIE", 18, "AUD"),
    (7, 7, "JUE", 19, "LAB4"), (7, 7, "VIE", 19, "LAB2"),

    # Ciclo IX
    (9, 8, "LUN", 8, "LAB3"), (9, 9, "MAR", 8, "A303"),
    (9, 1, "JUE", 8, "A303"), (9, 4, "MAR", 10, "LAB3"),
    (9, 5, "MAR", 10, "AUD"), (9, 1, "JUE", 11, "LAB2"),
    (9, 4, "LUN", 11, "A303"), (9, 3, "VIE", 11, "A303"),
    (9, 5, "MAR", 14, "LAB1"), (9, 5, "LUN", 15, "A303"),
    (9, 7, "MAR", 15, "LAB4"), (9, 6, "SAB", 15, "LAB2"),
    (9, 3, "VIE", 15, "LAB4"), (9, 2, "JUE", 16, "A311"),
    (9, 9, "MAR", 16, "LAB2"), (9, 6, "SAB", 17, "LAB2"),
    (9, 2, "VIE", 17, "LAB4"), (9, 7, "MAR", 18, "LAB4"),
    (9, 9, "MAR", 18, "LAB2"), (9, 8, "MIE", 18, "LAB4"),
    (9, 7, "LUN", 19, "A303"), (9, 6, "SAB", 19, "A303"),
    (9, 5, "MAR", 20, "LAB1"),
)


HORARIO_REFERENCIAL_2026_I: tuple[BloqueReferencial, ...] = tuple(
    BloqueReferencial(
        ciclo=ciclo,
        curso_codigo=CURSOS_POR_NUMERO[ciclo][numero],
        dia=dia,
        hora_inicio=hora,
        duracion=1,
        aula_codigo=_aula(aula),
        tipo_preferido="L" if aula.startswith("LAB") else None,
    )
    for ciclo, numero, dia, hora, aula in _CELDAS_2026_I
)


PLANTILLAS_POR_SEMESTRE: dict[str, tuple[BloqueReferencial, ...]] = {
    "2026-I": HORARIO_REFERENCIAL_2026_I,
}
