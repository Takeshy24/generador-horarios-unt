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
        1: "3317", 2: "3316", 3: "3317", 4: "3313", 5: "3311",
        6: "3312", 7: "3314", 8: "3315", 9: "3315",
    },
    3: {
        1: "3336", 2: "3332", 3: "3337", 4: "3334",
        5: "3333", 6: "3331", 7: "3335", 8: "3338",
    },
    5: {
        1: "3354", 2: "3356", 3: "3358", 4: "3352",
        5: "3355", 6: "3357", 7: "3353", 8: "3351",
    },
    7: {
        1: "3376", 2: "3375", 3: "3376", 4: "3378", 5: "3372",
        6: "3373", 7: "3377", 8: "3374", 9: "3378", 10: "3371",
    },
    9: {
        1: "3393", 2: "3393", 3: "3394", 4: "3392", 5: "3391",
        6: "3397", 7: "3396", 8: "3395", 9: "3398",
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
        "LABF": "LAB-FISICA",
        "AUD": "AUDIOVIS",
        "AUDIV": "AUDIVISUALES",
        "I4": "I-4",
        "TCIND": "TC-ING-IND",
        "PABIND": "PAB-ING-IND",
    }[valor]


# (ciclo, numero_en_pdf, dia, hora, aula_abreviada)
_CELDAS_2026_I: tuple[tuple[int, int, str, int, str], ...] = (
    # ────────────────────────────────────────────────────────────────────────────
    # CICLO I
    # ────────────────────────────────────────────────────────────────────────────
    # N° 1: Marcelino Torres - Introducción a la Programación
    (1, 1, "LUN", 7, "A307"), (1, 1, "LUN", 8, "A307"),
    (1, 1, "LUN", 14, "LAB3"), (1, 1, "LUN", 15, "LAB3"),
    (1, 1, "LUN", 16, "LAB3"), (1, 1, "LUN", 17, "LAB3"),
    # N° 2: Alberto Mendoza - Introducción a la Ing. de Sistemas
    (1, 2, "MAR", 7, "A307"), (1, 2, "MAR", 8, "A307"),
    (1, 2, "MAR", 9, "A307"),
    # N° 3: Paul Cotrina - Introducción a la Programación
    (1, 3, "JUE", 9, "LAB4"), (1, 3, "JUE", 10, "LAB4"),
    (1, 3, "JUE", 11, "LAB4"), (1, 3, "JUE", 12, "LAB4"),
    # N° 4: Bertha Urtecho - Desarrollo Personal
    (1, 4, "VIE", 9, "TCIND"), (1, 4, "VIE", 10, "TCIND"),
    (1, 4, "VIE", 11, "TCIND"), (1, 4, "VIE", 12, "TCIND"),
    # N° 5: Jose Luis Ponte - Des. Pensamiento Lógico Matemático
    (1, 5, "MAR", 10, "A307"), (1, 5, "MAR", 11, "A307"),
    (1, 5, "MAR", 12, "A307"),
    (1, 5, "VIE", 7, "A307"), (1, 5, "VIE", 8, "A307"),
    # N° 6: Jorge Luis Rios - Lectura Crítica y Redacción
    (1, 6, "JUE", 14, "A303"), (1, 6, "JUE", 15, "A303"),
    (1, 6, "JUE", 16, "A303"), (1, 6, "JUE", 17, "A303"),
    # N° 7: Segundo Guibar - Intro. al Análisis Matemático
    (1, 7, "LUN", 9, "A307"), (1, 7, "LUN", 10, "A307"),
    (1, 7, "LUN", 11, "A307"), (1, 7, "LUN", 12, "A307"),
    (1, 7, "MAR", 16, "A307"), (1, 7, "MAR", 17, "A307"),
    # N° 8: Miguel Ipanaque - Estadística General
    (1, 8, "JUE", 7, "TCIND"), (1, 8, "JUE", 8, "TCIND"),
    # N° 9: Martha Cardoso - Estadística General
    (1, 9, "VIE", 14, "A303"), (1, 9, "VIE", 15, "A303"),
    (1, 9, "VIE", 16, "TCIND"), (1, 9, "VIE", 17, "TCIND"),

    # ────────────────────────────────────────────────────────────────────────────
    # CICLO III
    # ────────────────────────────────────────────────────────────────────────────
    # N° 1: Zoraida Vidal - Prog. Orientada a Objetos II
    (3, 1, "LUN", 9, "LAB2"), (3, 1, "LUN", 10, "LAB2"),
    (3, 1, "LUN", 11, "LAB2"), (3, 1, "LUN", 12, "LAB2"),
    (3, 1, "MAR", 9, "LAB2"), (3, 1, "MAR", 10, "LAB2"),
    (3, 1, "MAR", 11, "LAB2"), (3, 1, "MAR", 12, "LAB2"),
    (3, 1, "MAR", 14, "I4"), (3, 1, "MAR", 15, "I4"),
    (3, 1, "VIE", 9, "LAB4"), (3, 1, "VIE", 10, "LAB4"),
    (3, 1, "VIE", 11, "LAB4"), (3, 1, "VIE", 12, "LAB4"),
    # N° 2: Everson Agreda - Sistémica
    (3, 2, "MIE", 9, "A307"), (3, 2, "MIE", 10, "A307"),
    (3, 2, "MIE", 11, "A307"),
    (3, 2, "MIE", 14, "LAB3"), (3, 2, "MIE", 15, "LAB3"),
    (3, 2, "MIE", 16, "LAB3"), (3, 2, "MIE", 17, "LAB3"),
    (3, 2, "JUE", 16, "LAB3"), (3, 2, "JUE", 17, "LAB3"),
    # N° 3: Juan Carlos Obando - Ingeniería Gráfica
    (3, 3, "MIE", 7, "A303"), (3, 3, "MIE", 8, "A303"),
    (3, 3, "JUE", 7, "LAB1"), (3, 3, "JUE", 8, "LAB1"),
    (3, 3, "JUE", 9, "LAB1"),
    (3, 3, "JUE", 10, "LAB1"), (3, 3, "JUE", 11, "LAB1"),
    (3, 3, "JUE", 12, "LAB1"),
    # N° 4: Marcos Ferrer - Matemática Aplicada
    (3, 4, "MIE", 18, "A303"), (3, 4, "MIE", 19, "A303"),
    (3, 4, "MIE", 20, "A303"),
    (3, 4, "JUE", 14, "TCIND"), (3, 4, "JUE", 15, "TCIND"),
    # N° 5: Teresita Rojas - Estadística Aplicada
    (3, 5, "MAR", 16, "A303"), (3, 5, "MAR", 17, "A303"),
    (3, 5, "JUE", 18, "TCIND"), (3, 5, "JUE", 19, "TCIND"),
    (3, 5, "JUE", 20, "TCIND"),
    (3, 5, "VIE", 7, "TCIND"), (3, 5, "VIE", 8, "TCIND"),
    (3, 5, "VIE", 16, "A303"), (3, 5, "VIE", 17, "A303"),
    # N° 6: Juan Carrascal - Administración General
    (3, 6, "LUN", 7, "TCIND"), (3, 6, "LUN", 8, "TCIND"),
    (3, 6, "MAR", 7, "PABIND"), (3, 6, "MAR", 8, "PABIND"),
    # N° 7: Vilma Mendez - Física Electrónica
    (3, 7, "LUN", 15, "A307"), (3, 7, "LUN", 16, "A307"),
    (3, 7, "LUN", 17, "A307"), (3, 7, "LUN", 18, "A307"),
    (3, 7, "LUN", 19, "A307"),
    (3, 7, "MIE", 14, "LABF"), (3, 7, "MIE", 15, "LABF"),
    (3, 7, "MIE", 16, "LABF"), (3, 7, "MIE", 17, "LABF"),
    (3, 7, "JUE", 7, "LABF"), (3, 7, "JUE", 8, "LABF"),
    (3, 7, "JUE", 9, "LABF"), (3, 7, "JUE", 10, "LABF"),
    # N° 8: Sheyla Laura - Psicologia Organizacional (e)
    (3, 8, "MAR", 18, "A311"), (3, 8, "MAR", 19, "A311"),
    (3, 8, "VIE", 18, "A311"), (3, 8, "VIE", 19, "A311"),

    # ────────────────────────────────────────────────────────────────────────────
    # CICLO V
    # ────────────────────────────────────────────────────────────────────────────
    # N° 1: Luis Boy - Ingeniería de Datos I
    (5, 1, "LUN", 7, "A303"), (5, 1, "LUN", 8, "A303"),
    (5, 1, "LUN", 9, "A303"),
    (5, 1, "LUN", 10, "LAB4"), (5, 1, "LUN", 11, "LAB4"),
    (5, 1, "LUN", 12, "LAB4"),
    (5, 1, "MAR", 7, "LAB4"), (5, 1, "MAR", 8, "LAB4"),
    (5, 1, "MAR", 9, "LAB4"),
    (5, 1, "MAR", 10, "LAB4"), (5, 1, "MAR", 11, "LAB4"),
    (5, 1, "MAR", 12, "LAB4"),
    # N° 2: Juan Carlos Obando - Sistemas de Información
    (5, 2, "MIE", 9, "A303"), (5, 2, "MIE", 10, "A303"),
    (5, 2, "MIE", 11, "A303"), (5, 2, "MIE", 12, "A303"),
    (5, 2, "MIE", 14, "LAB1"), (5, 2, "MIE", 15, "LAB1"),
    (5, 2, "MIE", 16, "LAB1"), (5, 2, "MIE", 17, "LAB1"),
    (5, 2, "MIE", 18, "LAB1"), (5, 2, "MIE", 19, "LAB1"),
    # N° 3: Everson David Agreda - Transformación digital
    (5, 3, "JUE", 7, "LAB3"), (5, 3, "JUE", 8, "LAB3"),
    (5, 3, "JUE", 9, "A307"), (5, 3, "JUE", 10, "A307"),
    (5, 3, "JUE", 11, "LAB3"), (5, 3, "JUE", 12, "LAB3"),
    # N° 4: Robert Jerry Sánchez - Tecnología Web
    (5, 4, "LUN", 15, "LAB1"), (5, 4, "LUN", 16, "LAB1"),
    (5, 4, "LUN", 17, "LAB1"),
    (5, 4, "MAR", 15, "LAB1"), (5, 4, "MAR", 16, "LAB1"),
    (5, 4, "MAR", 17, "LAB1"),
    (5, 4, "MIE", 7, "A307"), (5, 4, "MIE", 8, "A307"),
    (5, 4, "JUE", 15, "LAB4"), (5, 4, "JUE", 16, "LAB4"),
    (5, 4, "JUE", 17, "LAB4"),
    # N° 5: Cesar Arellano - Arquitectura de Computadoras
    (5, 5, "MIE", 14, "LAB2"), (5, 5, "MIE", 15, "LAB2"),
    (5, 5, "MIE", 16, "LAB2"), (5, 5, "MIE", 17, "LAB2"),
    (5, 5, "MIE", 18, "LAB2"), (5, 5, "MIE", 19, "LAB2"),
    (5, 5, "VIE", 9, "A307"), (5, 5, "VIE", 10, "A307"),
    (5, 5, "VIE", 11, "A307"),
    # N° 6: Camilo Suárez - Teleinformática
    (5, 6, "MAR", 13, "LAB2"), (5, 6, "MAR", 14, "LAB2"),
    (5, 6, "MAR", 19, "LAB2"), (5, 6, "MAR", 20, "LAB2"),
    (5, 6, "VIE", 17, "A307"), (5, 6, "VIE", 18, "A307"),
    (5, 6, "VIE", 19, "A307"),
    # N° 7: Marcos Baca - Investigación de Operaciones
    (5, 7, "JUE", 7, "LAB2"), (5, 7, "JUE", 8, "LAB2"),
    (5, 7, "JUE", 9, "LAB2"), (5, 7, "JUE", 10, "LAB2"),
    (5, 7, "JUE", 11, "A307"), (5, 7, "JUE", 12, "A307"),
    (5, 7, "JUE", 13, "A307"),
    (5, 7, "VIE", 7, "LAB2"), (5, 7, "VIE", 8, "LAB2"),
    # N° 8: Ana Cuadra - Contabilidad Gerencial
    (5, 8, "JUE", 18, "A307"), (5, 8, "JUE", 19, "A307"),
    (5, 8, "VIE", 14, "A307"), (5, 8, "VIE", 15, "A307"),
    (5, 8, "VIE", 16, "A307"),

    # ────────────────────────────────────────────────────────────────────────────
    # CICLO VII
    # ────────────────────────────────────────────────────────────────────────────
    # N° 1: Juan Pedro Santos - Ingeniería de Software I
    (7, 1, "MAR", 7, "LAB1"), (7, 1, "MAR", 8, "LAB1"),
    (7, 1, "MAR", 9, "LAB1"),
    (7, 1, "MAR", 10, "A303"), (7, 1, "MAR", 11, "A303"),
    (7, 1, "MAR", 12, "A303"),
    # N° 2: César Arellano - Redes y Comunicaciones I
    (7, 2, "LUN", 10, "LAB3"), (7, 2, "LUN", 11, "LAB3"),
    (7, 2, "LUN", 12, "LAB3"),
    (7, 2, "LUN", 13, "LAB2"), (7, 2, "LUN", 14, "LAB2"),
    (7, 2, "LUN", 15, "LAB2"),
    (7, 2, "LUN", 16, "LAB2"), (7, 2, "LUN", 17, "LAB2"),
    (7, 2, "LUN", 18, "LAB2"),
    (7, 2, "VIE", 16, "A311"), (7, 2, "VIE", 17, "A311"),
    # N° 3: Robert Jerry Sánchez - Ingeniería de Software I
    (7, 3, "LUN", 7, "LAB1"), (7, 3, "LUN", 8, "LAB1"),
    (7, 3, "LUN", 9, "LAB1"),
    (7, 3, "LUN", 10, "LAB1"), (7, 3, "LUN", 11, "LAB1"),
    (7, 3, "LUN", 12, "LAB1"),
    # N° 4: Everson Agreda - Negocios Electrónicos
    (7, 4, "MAR", 16, "A311"), (7, 4, "MAR", 17, "A311"),
    # N° 5: Alberto Mendoza - Gestión de Servicios de TI
    (7, 5, "VIE", 7, "A303"), (7, 5, "VIE", 8, "A303"),
    (7, 5, "VIE", 9, "A303"),
    (7, 5, "VIE", 10, "LAB1"), (7, 5, "VIE", 11, "LAB1"),
    (7, 5, "VIE", 12, "LAB1"), (7, 5, "VIE", 13, "LAB1"),
    # N° 6: Paul Cotrina - Metodología de la Investigación Científica
    (7, 6, "JUE", 14, "A307"), (7, 6, "JUE", 15, "A307"),
    (7, 6, "JUE", 16, "A307"), (7, 6, "JUE", 17, "A307"),
    # N° 7: Ricardo Mendoza - Administración de Base de Datos
    (7, 7, "JUE", 7, "A307"), (7, 7, "JUE", 8, "A307"),
    (7, 7, "JUE", 18, "LAB4"), (7, 7, "JUE", 19, "LAB4"),
    (7, 7, "JUE", 20, "LAB4"),
    (7, 7, "VIE", 18, "LAB2"), (7, 7, "VIE", 19, "LAB2"),
    (7, 7, "VIE", 20, "LAB2"),
    # N° 8: Oscar Romel Alcántara - Planeamiento Estratégico de TI
    (7, 8, "MAR", 13, "A307"), (7, 8, "MAR", 14, "A307"),
    (7, 8, "MAR", 15, "A307"),
    (7, 8, "MIE", 13, "LAB4"), (7, 8, "MIE", 14, "LAB4"),
    (7, 8, "MIE", 15, "LAB4"), (7, 8, "MIE", 16, "LAB4"),
    (7, 8, "MIE", 17, "AUDIV"), (7, 8, "MIE", 18, "AUDIV"),
    (7, 8, "MIE", 19, "AUDIV"),
    (7, 8, "JUE", 9, "LAB3"), (7, 8, "JUE", 10, "LAB3"),
    # N° 9: Paul Cotrina - Negocios Electrónicos (e)
    (7, 9, "LUN", 14, "LAB4"), (7, 9, "LUN", 15, "LAB4"),
    (7, 9, "LUN", 16, "LAB4"), (7, 9, "LUN", 17, "LAB4"),
    # N° 10: Jhoe Gonzalez - Cadena de Suministros (e)
    (7, 10, "MIE", 7, "TCIND"), (7, 10, "MIE", 8, "TCIND"),
    (7, 10, "MIE", 9, "TCIND"), (7, 10, "MIE", 10, "TCIND"),

    # ────────────────────────────────────────────────────────────────────────────
    # CICLO IX
    # ────────────────────────────────────────────────────────────────────────────
    # N° 1: Juan Pedro Santos - Tesis
    (9, 1, "JUE", 7, "A303"), (9, 1, "JUE", 8, "A303"),
    (9, 1, "JUE", 9, "A303"), (9, 1, "JUE", 10, "A303"),
    (9, 1, "JUE", 11, "LAB2"), (9, 1, "JUE", 12, "LAB2"),
    # N° 2: Ricardo Mendoza - Tesis
    (9, 2, "JUE", 14, "A311"), (9, 2, "JUE", 15, "A311"),
    (9, 2, "JUE", 16, "A311"), (9, 2, "JUE", 17, "A311"),
    (9, 2, "VIE", 16, "LAB4"), (9, 2, "VIE", 17, "LAB4"),
    # N° 3: Ricardo Mendoza - Analítica de Negocios
    (9, 3, "VIE", 10, "A303"), (9, 3, "VIE", 11, "A303"),
    (9, 3, "VIE", 12, "A303"),
    (9, 3, "VIE", 14, "LAB4"), (9, 3, "VIE", 15, "LAB4"),
    # N° 4: Alberto Mendoza - Auditoría Informática
    (9, 4, "LUN", 10, "A303"), (9, 4, "LUN", 11, "A303"),
    (9, 4, "LUN", 12, "A303"),
    (9, 4, "MAR", 10, "LAB3"), (9, 4, "MAR", 11, "LAB3"),
    (9, 4, "MAR", 12, "LAB3"), (9, 4, "MAR", 13, "LAB3"),
    # N° 5: José Gómez - Gestión de Proyectos de TI
    (9, 5, "LUN", 14, "A303"), (9, 5, "LUN", 15, "A303"),
    (9, 5, "LUN", 16, "A303"),
    (9, 5, "MAR", 10, "AUDIV"), (9, 5, "MAR", 11, "AUDIV"),
    (9, 5, "MAR", 13, "LAB1"), (9, 5, "MAR", 14, "LAB1"),
    (9, 5, "MAR", 19, "LAB1"), (9, 5, "MAR", 20, "LAB1"),
    # N° 6: Oscar Romel Alcántara - Emprendimiento Tecnológico
    (9, 6, "VIE", 14, "LAB2"), (9, 6, "VIE", 15, "LAB2"),
    (9, 6, "VIE", 16, "LAB2"), (9, 6, "VIE", 17, "LAB2"),
    (9, 6, "VIE", 18, "A303"), (9, 6, "VIE", 19, "A303"),
    # N° 7: Marcelino Torres - Ingeniería Web
    (9, 7, "LUN", 18, "A303"), (9, 7, "LUN", 19, "A303"),
    (9, 7, "MAR", 14, "LAB4"), (9, 7, "MAR", 15, "LAB4"),
    (9, 7, "MAR", 16, "LAB4"), (9, 7, "MAR", 17, "LAB4"),
    (9, 7, "MAR", 18, "LAB4"), (9, 7, "MAR", 19, "LAB4"),
    (9, 7, "JUE", 10, "LAB4"), (9, 7, "JUE", 11, "LAB4"),
    (9, 7, "JUE", 12, "LAB4"),
    # N° 8: José Gómez - Computación en la Nube
    (9, 8, "LUN", 7, "LAB3"), (9, 8, "LUN", 8, "LAB3"),
    (9, 8, "LUN", 9, "LAB3"),
    (9, 8, "MIE", 7, "LAB3"), (9, 8, "MIE", 8, "LAB3"),
    (9, 8, "MIE", 9, "LAB3"),
    (9, 8, "MIE", 17, "LAB3"), (9, 8, "MIE", 18, "LAB3"),
    (9, 8, "MIE", 19, "LAB3"),
    (9, 8, "JUE", 18, "A303"), (9, 8, "JUE", 19, "A303"),
    # N° 9: Camilo Suarez - Hackeo Ético
    (9, 9, "MAR", 8, "A303"), (9, 9, "MAR", 9, "A303"),
    (9, 9, "MAR", 15, "LAB2"), (9, 9, "MAR", 16, "LAB2"),
    (9, 9, "MAR", 17, "LAB2"), (9, 9, "MAR", 18, "LAB2"),
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
