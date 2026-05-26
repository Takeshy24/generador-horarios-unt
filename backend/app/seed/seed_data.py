"""
Script de seed para el Generador de Horarios UNT.
Idempotente: borra y recrea todos los datos en cada ejecución.

Datos reales extraídos de:
  - Plan de Estudios Ingeniería de Sistemas 2018
  - Horarios por Ciclos 2026-I (15 abril 2026)

Ejecutar desde backend/:
    python -m app.seed.seed_data
"""

import asyncio
from datetime import date, time

import bcrypt
from sqlalchemy import delete, insert, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import AsyncSessionLocal
from app.models import (
    Facultad, Escuela, Departamento, User,
    Docente, DocenteCargo, DocenteDisponibilidad, DocentePreferencias,
    Curso, Aula, Semestre, Seccion, GrupoLab,
    ComponenteAProgramar, HorarioBloque,
    semestre_aulas_disponibles,
)
from app.models.enums import (
    RoleEnum, TipoDocenteEnum, RegimenEnum, CategoriaEnum,
    DiaEnum, TurnoEnum, TipoAulaEnum, EstadoSemestreEnum, TipoComponenteEnum,
)
from app.motor.plantillas_reales import HORARIO_REFERENCIAL_2026_I
from app.motor.tipos import tipo_aula_compatible


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def t(h: int, m: int = 0) -> time:
    return time(h, m)


DIAS = [DiaEnum.LUN, DiaEnum.MAR, DiaEnum.MIE, DiaEnum.JUE, DiaEnum.VIE, DiaEnum.SAB]


def disponibilidad_full(docente: Docente) -> list[DocenteDisponibilidad]:
    """L-S 7:00-21:00, jornada continua como el horario real."""
    slots = []
    for dia in DIAS:
        slots.append(DocenteDisponibilidad(docente=docente, dia=dia, hora_inicio=t(7), hora_fin=t(21)))
    return slots


def disponibilidad_manana(docente: Docente, dias=None) -> list[DocenteDisponibilidad]:
    """Solo mañanas 7:00-13:00."""
    return [
        DocenteDisponibilidad(docente=docente, dia=d, hora_inicio=t(7), hora_fin=t(14))
        for d in (dias or DIAS)
    ]


def disponibilidad_tarde(docente: Docente, dias=None) -> list[DocenteDisponibilidad]:
    """Solo tardes 14:00-20:00."""
    return [
        DocenteDisponibilidad(docente=docente, dia=d, hora_inicio=t(14), hora_fin=t(21))
        for d in (dias or DIAS)
    ]


def disponibilidad_reducida(docente: Docente, horas_por_dia: int, dias=None) -> list[DocenteDisponibilidad]:
    """Mañana parcial (horas_por_dia h desde las 7)."""
    return [
        DocenteDisponibilidad(docente=docente, dia=d, hora_inicio=t(7), hora_fin=t(7 + horas_por_dia))
        for d in (dias or DIAS)
    ]


async def limpiar_bd(session: AsyncSession) -> None:
    await session.execute(delete(HorarioBloque))
    await session.execute(delete(ComponenteAProgramar))
    await session.execute(delete(GrupoLab))
    await session.execute(delete(Seccion))
    await session.execute(text("DELETE FROM semestre_aulas_disponibles"))
    await session.execute(delete(Semestre))
    await session.execute(delete(DocentePreferencias))
    await session.execute(delete(DocenteDisponibilidad))
    await session.execute(delete(DocenteCargo))
    await session.execute(delete(User))
    await session.execute(delete(Docente))
    await session.execute(delete(Curso))
    await session.execute(delete(Aula))
    await session.execute(delete(Escuela))
    await session.execute(delete(Departamento))
    await session.execute(delete(Facultad))
    await session.commit()


async def seed() -> None:
    async with AsyncSessionLocal() as session:
        print("Limpiando base de datos...")
        await limpiar_bd(session)

        # ── INSTITUCIONAL ──────────────────────────────────────────────────
        print("Creando estructura institucional...")
        facultad = Facultad(nombre="Facultad de Ingeniería")
        session.add(facultad)
        await session.flush()

        escuela = Escuela(nombre="Escuela de Ingeniería de Sistemas", facultad=facultad)

        # Departamentos reales mencionados en el plan de estudios
        depto_sis        = Departamento(nombre="Ingeniería de Sistemas",        facultad=facultad)
        depto_mat        = Departamento(nombre="Matemáticas",                   facultad=facultad)
        depto_est        = Departamento(nombre="Estadística",                   facultad=facultad)
        depto_fis        = Departamento(nombre="Física",                        facultad=facultad)
        depto_psi        = Departamento(nombre="Ciencias Psicológicas",         facultad=facultad)
        depto_len        = Departamento(nombre="Lengua Nacional y Literatura",  facultad=facultad)
        depto_fil        = Departamento(nombre="Filosofía y Arte",              facultad=facultad)
        depto_soc        = Departamento(nombre="Ciencias Sociales",             facultad=facultad)
        depto_edu        = Departamento(nombre="Ciencias de la Educación",      facultad=facultad)
        depto_adm        = Departamento(nombre="Administración",                facultad=facultad)
        depto_eco        = Departamento(nombre="Economía",                      facultad=facultad)
        depto_con        = Departamento(nombre="Contabilidad y Finanzas",       facultad=facultad)
        depto_ind        = Departamento(nombre="Ingeniería Industrial",         facultad=facultad)
        depto_amb        = Departamento(nombre="Ingeniería Ambiental",          facultad=facultad)
        depto_jur        = Departamento(nombre="Ciencias Jurídicas Públicas y Políticas", facultad=facultad)
        depto_com        = Departamento(nombre="Comunicación Social",           facultad=facultad)

        session.add_all([
            escuela,
            depto_sis, depto_mat, depto_est, depto_fis, depto_psi,
            depto_len, depto_fil, depto_soc, depto_edu, depto_adm,
            depto_eco, depto_con, depto_ind, depto_amb, depto_jur, depto_com,
        ])
        await session.flush()

        # ── CURSOS REALES — Plan de Estudios 2018 ─────────────────────────
        # Formato: (codigo, nombre, ciclo, es_electivo, horas_T, horas_P, horas_L, tipo_lab)
        print("Creando cursos del Plan de Estudios 2018...")
        cursos_data = [
            # ── I CICLO ────────────────────────────────────────────────────
            ("3311", "Desarrollo del Pensamiento Lógico Matemático",   1, False, 1, 4, 0, None),
            ("3312", "Lectura Crítica y Redacción de Textos Académicos",1, False, 2, 2, 0, None),
            ("3313", "Desarrollo Personal",                            1, False, 2, 2, 0, None),
            ("3314", "Introducción al Análisis Matemático",            1, False, 2, 4, 0, None),
            ("3315", "Estadística General",                            1, False, 2, 2, 2, "lab_computo"),
            ("3316", "Introducción a la Ingeniería de Sistemas",       1, False, 1, 2, 0, None),
            ("3317", "Introducción a la Programación",                 1, False, 2, 0, 2, "lab_computo"),
            # I Ciclo — electivos (estudios generales)
            ("3301", "Técnicas de Comunicación Eficaz",                1, True,  0, 2, 0, None),
            ("3302", "Taller de Música",                               1, True,  0, 2, 0, None),
            ("3303", "Taller de Liderazgo y Trabajo en Equipo",        1, True,  0, 2, 0, None),
            ("3304", "Taller de Teatro",                               1, True,  0, 2, 0, None),

            # ── II CICLO ───────────────────────────────────────────────────
            ("3321", "Ética, Convivencia Humana y Ciudadanía",         2, False, 2, 2, 0, None),
            ("3322", "Sociedad, Cultura y Ecología",                   2, False, 1, 4, 0, None),
            ("3323", "Cultura Investigativa y Pensamiento Crítico",    2, False, 2, 2, 0, None),
            ("3324", "Análisis Matemático",                            2, False, 2, 4, 0, None),
            ("3325", "Física General",                                 2, False, 2, 2, 2, "lab_computo"),
            ("3326", "Programación Orientada a Objetos I",             2, False, 2, 0, 4, "lab_computo"),
            # II Ciclo — electivos
            ("3305", "Taller de Manejo de TIC",                        2, True,  0, 2, 0, None),
            ("3306", "Taller de Danzas Folklóricas",                   2, True,  0, 2, 0, None),
            ("3307", "Taller de Deporte",                              2, True,  0, 2, 0, None),

            # ── III CICLO ──────────────────────────────────────────────────
            ("3331", "Administración General",                         3, False, 2, 2, 0, None),
            ("3332", "Sistémica",                                      3, False, 1, 2, 2, "lab_computo"),
            ("3333", "Estadística Aplicada",                           3, False, 1, 2, 2, "lab_computo"),
            ("3334", "Matemática Aplicada",                            3, False, 1, 2, 2, "lab_computo"),
            ("3335", "Física Electrónica",                             3, False, 1, 2, 2, "lab_computo"),
            ("3336", "Programación Orientada a Objetos II",            3, False, 2, 0, 4, "lab_computo"),
            # III Ciclo — electivos
            ("3337", "Ingeniería Gráfica",                             3, True,  1, 1, 3, "lab_computo"),
            ("3338", "Psicología Organizacional",                      3, True,  2, 2, 0, None),

            # ── IV CICLO ───────────────────────────────────────────────────
            ("3341", "Economía General",                               4, False, 2, 2, 0, None),
            ("3342", "Diseño Web",                                     4, False, 1, 1, 3, "lab_computo"),
            ("3343", "Pensamiento de Diseño",                          4, False, 1, 2, 2, "lab_computo"),
            ("3344", "Gestión por Procesos",                           4, False, 1, 2, 2, "lab_computo"),
            ("3345", "Sistemas Digitales",                             4, False, 1, 2, 2, "lab_computo"),
            ("3346", "Estructura de Datos Orientado a Objetos",        4, False, 2, 1, 3, "lab_computo"),
            # IV Ciclo — electivos
            ("3347", "Computación Gráfica y Visual",                   4, True,  1, 1, 3, "lab_computo"),
            ("3348", "Plataformas Tecnológicas",                       4, True,  2, 0, 2, "lab_computo"),

            # ── V CICLO ────────────────────────────────────────────────────
            ("3351", "Contabilidad Gerencial",                         5, False, 1, 2, 2, "lab_computo"),
            ("3352", "Tecnologías Web",                                5, False, 1, 1, 3, "lab_computo"),
            ("3353", "Investigación de Operaciones",                   5, False, 1, 2, 2, "lab_computo"),
            ("3354", "Ingeniería de Datos I",                          5, False, 2, 1, 3, "lab_bd"),
            ("3355", "Arquitectura y Organización de Computadoras",    5, False, 1, 2, 2, "lab_computo"),
            ("3356", "Sistemas de Información",                        5, False, 2, 2, 2, "lab_computo"),
            # V Ciclo — electivos
            ("3357", "Teleinformática",                                5, True,  1, 2, 2, "lab_redes"),
            ("3358", "Transformación Digital",                         5, True,  2, 0, 2, "lab_computo"),

            # ── VI CICLO ───────────────────────────────────────────────────
            ("3361", "Finanzas Corporativas",                          6, False, 1, 2, 2, "lab_computo"),
            ("3362", "Sistemas Inteligentes",                          6, False, 1, 2, 2, "lab_ia"),
            ("3363", "Ingeniería Económica",                           6, False, 1, 2, 2, "lab_computo"),
            ("3364", "Ingeniería de Datos II",                         6, False, 2, 1, 3, "lab_bd"),
            ("3365", "Sistemas Operativos",                            6, False, 1, 2, 2, "lab_computo"),
            ("3366", "Ingeniería de Requerimientos",                   6, False, 1, 2, 2, "lab_software"),
            # VI Ciclo — electivos
            ("3367", "Ingeniería Ambiental",                           6, True,  2, 2, 0, None),
            ("3368", "Gestión del Talento Humano",                     6, True,  2, 2, 0, None),

            # ── VII CICLO ──────────────────────────────────────────────────
            ("3371", "Cadena de Suministro",                           7, False, 2, 2, 0, None),
            ("3372", "Gestión de Servicios de TI",                     7, False, 1, 2, 2, "lab_computo"),
            ("3373", "Metodología de la Investigación Científica",     7, False, 2, 2, 0, None),
            ("3374", "Planeamiento Estratégico de la Información",     7, False, 1, 2, 2, "lab_computo"),
            ("3375", "Redes y Comunicaciones I",                       7, False, 1, 1, 3, "lab_redes"),
            ("3376", "Ingeniería del Software I",                      7, False, 2, 1, 3, "lab_software"),
            # VII Ciclo — electivos
            ("3377", "Administración de Base de Datos",                7, True,  1, 1, 3, "lab_bd"),
            ("3378", "Negocios Electrónicos",                          7, True,  2, 0, 2, "lab_computo"),

            # ── VIII CICLO ─────────────────────────────────────────────────
            ("3381", "Marketing y Medios Sociales",                    8, False, 1, 2, 2, "lab_computo"),
            ("3382", "Seguridad de la Información",                    8, False, 1, 2, 2, "lab_computo"),
            ("3383", "Internet de las Cosas",                          8, False, 1, 1, 3, "lab_computo"),
            ("3384", "Inteligencia de Negocios",                       8, False, 1, 2, 2, "lab_bd"),
            ("3385", "Redes y Comunicaciones II",                      8, False, 1, 1, 3, "lab_redes"),
            ("3386", "Ingeniería del Software II",                     8, False, 2, 1, 3, "lab_software"),
            # VIII Ciclo — electivos
            ("3387", "Deontología y Derecho Informático",              8, True,  2, 2, 0, None),
            ("3388", "Arquitectura basada en Microservicios",          8, True,  2, 0, 2, "lab_computo"),

            # ── IX CICLO ───────────────────────────────────────────────────
            ("3391", "Gestión de Proyectos de TI",                     9, False, 1, 2, 2, "lab_computo"),
            ("3392", "Auditoría Informática",                          9, False, 1, 2, 2, "lab_computo"),
            ("3393", "Tesis I",                                        9, False, 2, 2, 2, "lab_computo"),
            ("3394", "Analítica de Negocios",                          9, False, 1, 2, 2, "lab_bd"),
            ("3395", "Computación en la Nube",                         9, False, 1, 1, 3, "lab_computo"),
            ("3396", "Ingeniería Web",                                 9, False, 1, 1, 3, "lab_software"),
            # IX Ciclo — electivos
            ("3397", "Emprendimiento Tecnológico",                     9, True,  2, 0, 2, "lab_computo"),
            ("3398", "Hackeo Ético",                                   9, True,  2, 0, 2, "lab_computo"),

            # ── X CICLO ────────────────────────────────────────────────────
            ("33X1", "Sistemas de Información Empresarial",           10, False, 2, 1, 3, "lab_computo"),
            ("33X2", "Gobierno de TI",                                10, False, 1, 2, 2, "lab_computo"),
            ("33X3", "Tesis II",                                      10, False, 2, 2, 2, "lab_computo"),
            ("33X4", "Arquitectura Empresarial",                      10, False, 1, 2, 2, "lab_computo"),
            ("33X5", "Responsabilidad Social Corporativa",            10, False, 2, 2, 0, None),
            ("33X6", "Aplicaciones Móviles",                          10, False, 1, 1, 3, "lab_software"),
        ]

        cursos: dict[str, Curso] = {}
        for cod, nom, ciclo, electivo, hT, hP, hL, lab in cursos_data:
            c = Curso(
                codigo=cod, nombre=nom, ciclo=ciclo, escuela=escuela,
                es_electivo=electivo, horas_T=hT, horas_P=hP, horas_L=hL,
                tipo_lab_requerido=lab,
            )
            session.add(c)
            cursos[cod] = c
        await session.flush()

        # ── AULAS (basadas en ubicaciones reales del horario) ──────────────
        print("Creando aulas...")
        aulas_data = [
            # Aulas comunes del Pabellón de Posgrado (aparecen en horario real)
            ("A-303",    TipoAulaEnum.comun,       45, "Posgrado A-303"),
            ("A-307",    TipoAulaEnum.comun,       35, "Posgrado A-307"),
            ("A-311",    TipoAulaEnum.comun,       30, "Posgrado A-311"),
            # Aulas comunes adicionales
            ("A-201",    TipoAulaEnum.comun,       50, "Pabellón A 2°"),
            ("A-202",    TipoAulaEnum.comun,       50, "Pabellón A 2°"),
            ("A-301",    TipoAulaEnum.comun,       50, "Pabellón A 3°"),
            ("A-302",    TipoAulaEnum.comun,       50, "Pabellón A 3°"),
            ("A-401",    TipoAulaEnum.comun,       45, "Pabellón A 4°"),
            ("A-402",    TipoAulaEnum.comun,       45, "Pabellón A 4°"),
            ("AUDIOVIS", TipoAulaEnum.comun,       40, "Sala Audiovisuales"),
            ("AUDIVISUALES", TipoAulaEnum.comun,   40, "Sala Audiovisuales"),
            ("I-4",      TipoAulaEnum.comun,       40, "Aula I-4"),
            ("TC-ING-IND", TipoAulaEnum.comun,     50, "TC - Ing. Industrial"),
            ("PAB-ING-IND", TipoAulaEnum.comun,    50, "Pabellon Ing. Industria"),
            # Laboratorios de cómputo (Lab 1-4 aparecen en horario)
            ("LAB-1",    TipoAulaEnum.lab_computo, 20, "Laboratorio 1"),
            ("LAB-2",    TipoAulaEnum.lab_computo, 20, "Laboratorio 2"),
            ("LAB-3",    TipoAulaEnum.lab_computo, 20, "Laboratorio 3"),
            ("LAB-4",    TipoAulaEnum.lab_computo, 20, "Laboratorio 4"),
            ("LAB-FISICA", TipoAulaEnum.lab_computo, 20, "Lab. Física"),
            # Laboratorio de Redes
            ("LAB-REDES",TipoAulaEnum.lab_redes,   15, "Laboratorio de Redes"),
            # Laboratorio de BD
            ("LAB-BD",   TipoAulaEnum.lab_bd,      15, "Laboratorio de Base de Datos"),
            # Laboratorio de IA
            ("LAB-IA",   TipoAulaEnum.lab_ia,      20, "Laboratorio de IA"),
            # Laboratorio de Software
            ("LAB-SW",   TipoAulaEnum.lab_software, 20, "Laboratorio de Software"),
        ]

        aulas: dict[str, Aula] = {}
        for cod, tipo, cap, ubic in aulas_data:
            a = Aula(codigo=cod, tipo=tipo, capacidad=cap, ubicacion=ubic)
            session.add(a)
            aulas[cod] = a
        await session.flush()

        # ── DOCENTES REALES (extraídos del horario 2026-I) ─────────────────
        # Formato: (dni, nombre_completo, tipo, fecha_ingreso, regimen, categoria, departamento)
        # Los DNIs son ficticios pero únicos; los nombres son los reales del PDF.
        print("Creando docentes reales...")
        docentes_data = [
            # ── Nombrados con cargo / larga trayectoria ────────────────────
            # Ciclos I, VII, IX — Director de escuela probable
            ("41000001", "Mendoza de los Santos, Alberto",
             "nombrado", date(1998, 4, 1), "DE", "principal", depto_sis),

            # Ciclo VII, IX — activo en múltiples ciclos
            ("41000002", "Alcántara Moreno, Oscar Romel",
             "nombrado", date(2002, 4, 1), "DE", "principal", depto_sis),

            # Ciclo I, VII — Metodología de Investigación
            ("41000003", "Cotrina Castellanos, Paul",
             "nombrado", date(2007, 4, 1), "TC", "asociado", depto_sis),

            # Ciclo VII, IX — docente cuenta demo
            ("41000004", "Mendoza Rivera, Ricardo",
             "nombrado", date(2010, 4, 1), "TC", "asociado", depto_sis),

            # Ciclo VII, IX — Ingeniería del Software I / Tesis I
            ("41000005", "Santos Fernández, Juan Pedro",
             "nombrado", date(2014, 4, 1), "TC", "auxiliar", depto_sis),

            # Ciclo III, V, VII — POO II, Sistémica, Transformación Digital
            ("41000006", "Agreda Gamboa, Everson David",
             "nombrado", date(2015, 4, 1), "TC", "auxiliar", depto_sis),

            # Ciclo VII — Planeamiento Estratégico de TI
            ("41000007", "Gonzalez Vasquez, Jhoe",
             "nombrado", date(2016, 4, 1), "TC", "auxiliar", depto_sis),

            # Ciclo I, IX — Introducción a la Programación / Tesis
            ("41000008", "Torres Villanueva, Marcelino",
             "nombrado", date(2005, 4, 1), "DE", "principal", depto_sis),

            # Ciclo V — Ingeniería de Datos I
            ("41000009", "Boy Chavil, Luis",
             "nombrado", date(2012, 4, 1), "TC", "asociado", depto_sis),

            # Ciclo V — Sistemas de Información
            ("41000010", "Obando Roldán, Juan Carlos",
             "nombrado", date(2011, 4, 1), "TC", "asociado", depto_sis),

            # Ciclo IX — Gestión de Proyectos de TI
            ("41000011", "Gómez Ávila, José",
             "nombrado", date(2013, 4, 1), "TC", "auxiliar", depto_sis),

            # Ciclo I — Introducción al Análisis Matemático
            ("41000012", "Ipanaque Zapata, Miguel",
             "nombrado", date(2009, 4, 1), "TC", "asociado", depto_sis),

            # ── Docentes de Matemáticas ────────────────────────────────────
            # Ciclo I — Desarrollo del Pensamiento Lógico Matemático
            ("41000013", "Ponte Bejarano, Jose Luis",
             "nombrado", date(2003, 4, 1), "TC", "asociado", depto_mat),

            # Ciclo I — Introducción al Análisis Matemático (otro grupo)
            ("41000014", "Guibar Obeso, Segundo",
             "nombrado", date(2006, 4, 1), "TC", "asociado", depto_mat),

            # ── Docentes de Estadística ────────────────────────────────────
            # Ciclo I — Estadística General
            ("41000015", "Cardoso Rosales, Martha",
             "nombrado", date(2008, 4, 1), "TC", "asociado", depto_est),

            # ── Docentes de Lengua Nacional y Literatura ───────────────────
            # Ciclo I — Lectura Crítica y Redacción
            ("41000016", "Rios Gonzales, Jorge Luis",
             "nombrado", date(2007, 4, 1), "TC", "asociado", depto_len),

            # ── Docentes de Ciencias Psicológicas ─────────────────────────
            # Ciclo I — Desarrollo Personal
            ("41000017", "Urtecho Zavaleta, Bertha",
             "nombrado", date(2010, 4, 1), "TC", "asociado", depto_psi),

            # Ciclo III — Psicología Organizacional (electivo)
            ("41000018", "Mendez Gil, Vilma",
             "nombrado", date(2012, 4, 1), "TC", "auxiliar", depto_psi),

            # ── Docentes de Administración ─────────────────────────────────
            # Ciclo III — Administración General
            ("41000019", "Carrascal Cabanillas, Juan",
             "nombrado", date(2004, 4, 1), "TC", "asociado", depto_adm),

            # ── Docentes de Física ─────────────────────────────────────────
            # Ciclo III — Física Electrónica
            ("41000020", "Ferrer Reyna, Marcos",
             "nombrado", date(2009, 4, 1), "TC", "asociado", depto_fis),

            # ── Docentes de Matemáticas (Aplicada) ────────────────────────
            # Ciclo III — Matemática Aplicada
            ("41000021", "Rojas Garcia, Teresita",
             "nombrado", date(2011, 4, 1), "TC", "auxiliar", depto_mat),

            # ── Docentes de Ingeniería Industrial ─────────────────────────
            # Ciclo V — Investigación de Operaciones
            ("41000022", "Baca Lopez, Marcos",
             "nombrado", date(2007, 4, 1), "TC", "asociado", depto_ind),

            # ── Docentes de Contabilidad y Finanzas ───────────────────────
            # Ciclo V — Contabilidad Gerencial
            ("41000023", "Cuadra Mitzugaray, Ana",
             "nombrado", date(2008, 4, 1), "TC", "asociado", depto_con),

            # ── Docentes de Ciencias de la Educación ──────────────────────
            # Ciclo III — Estadística Aplicada
            ("41000024", "Laura Escobedo, Sheyla",
             "nombrado", date(2016, 4, 1), "TP1", "auxiliar", depto_edu),

            # ── Contratados ────────────────────────────────────────────────
            # Ciclo V, VII — Tecnología Web / Ing. Software I
            ("42000001", "Sánchez Ticona, Robert Jerry",
             "contratado", date(2022, 4, 1), "CONTRATO_A2", None, depto_sis),

            # Ciclo V, VII — Transformación Digital / Redes I
            ("42000002", "Arellano Salazar, César",
             "contratado", date(2023, 4, 1), "CONTRATO_B1", None, depto_sis),

            # Ciclo V, IX — Teleinformática / Hackeo Ético
            ("42000003", "Suárez Rebaza, Camilo",
             "contratado", date(2022, 4, 1), "CONTRATO_A3", None, depto_sis),

            # Ciclo III — Ingeniería Gráfica (electivo)
            ("42000004", "Vidal Melgarejo, Zoraida",
             "contratado", date(2023, 4, 1), "CONTRATO_B2", None, depto_sis),
        ]

        docentes: dict[str, Docente] = {}
        for dni, nombre, tipo, fi, regimen, cat, dpto in docentes_data:
            d = Docente(
                dni=dni,
                nombre_completo=nombre,
                tipo=TipoDocenteEnum(tipo),
                fecha_ingreso=fi,
                regimen=RegimenEnum(regimen),
                categoria=CategoriaEnum(cat) if cat else None,
                departamento=dpto,
            )
            session.add(d)
            docentes[dni] = d
        await session.flush()

        # Aliases legibles por nombre (clave = DNI)
        d_mendoza_santos  = docentes["41000001"]  # Mendoza de los Santos, Alberto
        d_alcantara       = docentes["41000002"]  # Alcántara Moreno, Oscar Romel
        d_cotrina         = docentes["41000003"]  # Cotrina Castellanos, Paul
        d_mendoza_rv      = docentes["41000004"]  # Mendoza Rivera, Ricardo
        d_santos_fz       = docentes["41000005"]  # Santos Fernández, Juan Pedro
        d_agreda          = docentes["41000006"]  # Agreda Gamboa, Everson David
        d_gonzalez        = docentes["41000007"]  # Gonzalez Vasquez, Jhoe
        d_torres          = docentes["41000008"]  # Torres Villanueva, Marcelino
        d_boy             = docentes["41000009"]  # Boy Chavil, Luis
        d_obando          = docentes["41000010"]  # Obando Roldán, Juan Carlos
        d_gomez           = docentes["41000011"]  # Gómez Ávila, José
        d_ipanaque        = docentes["41000012"]  # Ipanaque Zapata, Miguel
        d_ponte           = docentes["41000013"]  # Ponte Bejarano, Jose Luis
        d_guibar          = docentes["41000014"]  # Guibar Obeso, Segundo
        d_cardoso         = docentes["41000015"]  # Cardoso Rosales, Martha
        d_rios_gl         = docentes["41000016"]  # Rios Gonzales, Jorge Luis
        d_urtecho         = docentes["41000017"]  # Urtecho Zavaleta, Bertha
        d_mendez_gil      = docentes["41000018"]  # Mendez Gil, Vilma
        d_carrascal       = docentes["41000019"]  # Carrascal Cabanillas, Juan
        d_ferrer          = docentes["41000020"]  # Ferrer Reyna, Marcos
        d_rojas           = docentes["41000021"]  # Rojas Garcia, Teresita
        d_baca            = docentes["41000022"]  # Baca Lopez, Marcos
        d_cuadra          = docentes["41000023"]  # Cuadra Mitzugaray, Ana
        d_laura           = docentes["41000024"]  # Laura Escobedo, Sheyla
        d_sanchez         = docentes["42000001"]  # Sánchez Ticona, Robert Jerry
        d_arellano        = docentes["42000002"]  # Arellano Salazar, César
        d_suarez          = docentes["42000003"]  # Suárez Rebaza, Camilo
        d_vidal           = docentes["42000004"]  # Vidal Melgarejo, Zoraida

        # ── CARGOS ADMINISTRATIVOS ─────────────────────────────────────────
        session.add(DocenteCargo(
            docente=d_mendoza_santos, cargo="director_escuela",
            fecha_inicio=date(2023, 1, 1), fecha_fin=None,
        ))
        await session.flush()

        # ── DISPONIBILIDADES ───────────────────────────────────────────────
        print("Creando disponibilidades...")

        # Director de escuela: carga reducida (10h disponibles L-V 2h/día)
        session.add_all(disponibilidad_reducida(d_mendoza_santos, 2))
        # DE nombrados plenos
        session.add_all(disponibilidad_full(d_alcantara))
        session.add_all(disponibilidad_full(d_torres))
        # TC nombrados — mañana completa L-V
        session.add_all(disponibilidad_manana(d_cotrina))
        session.add_all(disponibilidad_manana(d_mendoza_rv))
        session.add_all(disponibilidad_full(d_santos_fz))
        session.add_all(disponibilidad_tarde(d_agreda))
        # Gonzalez sin jueves
        dias_sin_jue = [DiaEnum.LUN, DiaEnum.MAR, DiaEnum.MIE, DiaEnum.VIE]
        session.add_all(disponibilidad_full(d_gonzalez))
        session.add_all(disponibilidad_manana(d_boy))
        session.add_all(disponibilidad_full(d_obando))
        session.add_all(disponibilidad_manana(d_gomez))
        session.add_all(disponibilidad_full(d_ipanaque))
        # Docentes de otros departamentos
        session.add_all(disponibilidad_manana(d_ponte))
        session.add_all(disponibilidad_manana(d_guibar))
        session.add_all(disponibilidad_manana(d_cardoso))
        session.add_all(disponibilidad_manana(d_rios_gl))
        session.add_all(disponibilidad_manana(d_urtecho))
        session.add_all(disponibilidad_manana(d_mendez_gil))
        session.add_all(disponibilidad_manana(d_carrascal))
        session.add_all(disponibilidad_manana(d_ferrer))
        session.add_all(disponibilidad_manana(d_rojas))
        session.add_all(disponibilidad_manana(d_baca))
        session.add_all(disponibilidad_manana(d_cuadra))
        session.add_all(disponibilidad_manana(d_laura))
        # Contratados
        session.add_all(disponibilidad_full(d_sanchez))
        session.add_all(disponibilidad_full(d_arellano))
        session.add_all(disponibilidad_full(d_suarez))
        session.add_all(disponibilidad_manana(d_vidal))

        await session.flush()

        # ── PREFERENCIAS ───────────────────────────────────────────────────
        prefs = [
            (d_mendoza_santos, TurnoEnum.manana,      2, None),
            (d_alcantara,      TurnoEnum.indiferente,  4, None),
            (d_cotrina,        TurnoEnum.manana,       4, None),
            (d_mendoza_rv,     TurnoEnum.manana,       4, None),
            (d_santos_fz,      TurnoEnum.manana,       4, None),
            (d_agreda,         TurnoEnum.tarde,        4, None),
            (d_gonzalez,       TurnoEnum.indiferente,  4, "JUE"),
            (d_torres,         TurnoEnum.indiferente,  4, None),
            (d_boy,            TurnoEnum.manana,       4, None),
            (d_obando,         TurnoEnum.indiferente,  4, None),
            (d_gomez,          TurnoEnum.manana,       4, None),
            (d_ipanaque,       TurnoEnum.indiferente,  4, None),
            (d_ponte,          TurnoEnum.manana,       4, None),
            (d_guibar,         TurnoEnum.manana,       4, None),
            (d_cardoso,        TurnoEnum.manana,       3, None),
            (d_rios_gl,        TurnoEnum.manana,       4, None),
            (d_urtecho,        TurnoEnum.manana,       3, None),
            (d_mendez_gil,     TurnoEnum.manana,       3, None),
            (d_carrascal,      TurnoEnum.manana,       4, None),
            (d_ferrer,         TurnoEnum.manana,       4, None),
            (d_rojas,          TurnoEnum.manana,       4, None),
            (d_baca,           TurnoEnum.manana,       4, None),
            (d_cuadra,         TurnoEnum.manana,       3, None),
            (d_laura,          TurnoEnum.manana,       3, None),
            (d_sanchez,        TurnoEnum.indiferente,  4, None),
            (d_arellano,       TurnoEnum.manana,       4, None),
            (d_suarez,         TurnoEnum.indiferente,  4, None),
            (d_vidal,          TurnoEnum.manana,       4, None),
        ]
        for doc, turno, max_h, dias_ev in prefs:
            session.add(DocentePreferencias(
                docente=doc, turno_preferido=turno,
                max_horas_seguidas=max_h, dias_evitar=dias_ev,
            ))
        await session.flush()

        # ── SEMESTRE ───────────────────────────────────────────────────────
        print("Creando semestre 2026-I...")
        semestre = Semestre(
            codigo="2026-I",
            fecha_inicio=date(2026, 4, 13),
            fecha_fin=date(2026, 8, 8),
            escuela=escuela,
            estado=EstadoSemestreEnum.asignando,
        )
        session.add(semestre)
        await session.flush()

        await session.execute(
            insert(semestre_aulas_disponibles),
            [{"semestre_id": semestre.id, "aula_id": a.id} for a in aulas.values()],
        )
        await session.flush()

        # ── SECCIONES, GRUPOS Y COMPONENTES ───────────────────────────────
        print("Creando secciones, grupos y componentes...")

        # Asignaciones reales extraídas del horario 2026-I
        # Ciclo I (PDF pág. 1)
        asig_1 = {
            "3311": d_ponte,          # Desarrollo del Pensamiento Lógico Matemático
            "3312": d_rios_gl,        # Lectura Crítica y Redacción de Textos
            "3313": d_urtecho,        # Desarrollo Personal
            "3314": d_guibar,         # Introducción al Análisis Matemático
            "3315": d_cardoso,        # Estadística General
            "3316": d_mendoza_santos, # Introducción a la Ingeniería de Sistemas
            "3317": d_torres,         # Introducción a la Programación
            # electivos ciclo I — sin docente asignado en el horario visible
            "3301": None,
            "3302": None,
            "3303": None,
            "3304": None,
        }

        # Ciclo III (PDF pág. 2)
        asig_3 = {
            "3331": d_carrascal,   # Administración General
            "3332": d_agreda,      # Sistémica
            "3333": d_laura,       # Estadística Aplicada
            "3334": d_rojas,       # Matemática Aplicada
            "3335": d_ferrer,      # Física Electrónica
            "3336": d_vidal,       # POO II  (Zoraida Vidal)
            "3337": d_obando,      # Ingeniería Gráfica (electivo)
            "3338": d_mendez_gil,  # Psicología Organizacional (electivo)
        }

        # Ciclo V (PDF pág. 3)
        asig_5 = {
            "3351": d_cuadra,    # Contabilidad Gerencial
            "3352": d_sanchez,   # Tecnologías Web
            "3353": d_baca,      # Investigación de Operaciones
            "3354": d_boy,       # Ingeniería de Datos I
            "3355": d_arellano,  # Arquitectura y Org. de Computadoras
            "3356": d_obando,    # Sistemas de Información
            "3357": d_suarez,    # Teleinformática (electivo)
            "3358": d_agreda,    # Transformación Digital (electivo)
        }

        # Ciclo VII (PDF pág. 4)
        asig_7 = {
            "3371": d_gonzalez,       # Cadena de Suministro (electivo en tabla)
            "3372": d_mendoza_santos, # Gestión de Servicios de TI
            "3373": d_cotrina,        # Metodología de la Investigación Científica
            "3374": d_alcantara,      # Planeamiento Estratégico de la Información
            "3375": d_arellano,       # Redes y Comunicaciones I
            "3376": d_santos_fz,      # Ingeniería del Software I
            "3377": d_mendoza_rv,     # Administración de Base de Datos (electivo)
            "3378": d_agreda,         # Negocios Electrónicos (electivo)
        }

        # Ciclo IX (PDF pág. 5)
        asig_9 = {
            "3391": d_mendoza_santos, # Gestión de Proyectos de TI
            "3392": d_mendoza_rv,     # Auditoría Informática
            "3393": d_santos_fz,      # Tesis I
            "3394": d_mendoza_rv,     # Analítica de Negocios
            "3395": d_alcantara,      # Computación en la Nube
            "3396": d_gomez,          # Ingeniería Web
            "3397": d_suarez,         # Emprendimiento Tecnológico (electivo)
            "3398": d_suarez,         # Hackeo Ético (electivo)
        }

        # Mapa global de asignaciones por código de curso
        asignaciones_globales = {
            **asig_1, **asig_3, **asig_5, **asig_7, **asig_9,
        }

        # Para ciclos sin datos reales del horario (II, IV, VI, VIII, X)
        # se hace asignación automática respetando topes.
        _TOPES = {
            "DE": 22, "TC": 20, "TP1": 12, "TP2": 10, "TP3": 8,
            "CONTRATO_A1": 8,  "CONTRATO_A2": 10, "CONTRATO_A3": 12,
            "CONTRATO_B1": 8,  "CONTRATO_B2": 10, "CONTRATO_B3": 12,
        }

        def horas_curso(c: Curso, n_alu: int) -> int:
            n_g = max(1, (n_alu + 14) // 15) if c.horas_L > 0 else 0
            return c.horas_T + c.horas_P + c.horas_L * n_g

        # Pre-cargar horas ya asignadas a docentes con datos reales
        _horas_asig: dict[str, int] = {}
        alumnos_por_ciclo = {
            1: 40, 2: 38, 3: 36, 4: 34, 5: 28,
            6: 26, 7: 24, 8: 22, 9: 20, 10: 18,
        }
        grupos_reales_pdf = {
            "3311": 2, "3315": 2, "3317": 2,
            "3332": 3, "3333": 3, "3334": 1, "3335": 3, "3337": 1,
            "3351": 3, "3352": 3, "3353": 2, "3354": 3, "3355": 3,
            "3356": 2, "3357": 1, "3358": 1,
            "3372": 2, "3375": 3, "3376": 2, "3377": 2, "3378": 2,
            "3391": 3, "3392": 2, "3393": 2, "3394": 2, "3395": 3,
            "3396": 3, "3397": 2, "3398": 2,
        }
        for cod, doc in asignaciones_globales.items():
            if doc and cod in cursos:
                n = alumnos_por_ciclo.get(cursos[cod].ciclo, 25)
                h = horas_curso(cursos[cod], n)
                _horas_asig[doc.dni] = _horas_asig.get(doc.dni, 0) + h

        # Pool de docentes de Ingeniería de Sistemas para ciclos sin asignación real
        pool_sis = [
            d_agreda, d_gonzalez, d_ipanaque, d_obando, d_boy,
            d_gomez, d_torres, d_cotrina, d_mendoza_rv, d_santos_fz,
            d_sanchez, d_arellano, d_suarez,
        ]
        pool_idx = 0

        def siguiente_docente_para(curso: Curso, n_alu: int) -> Docente | None:
            nonlocal pool_idx
            h = horas_curso(curso, n_alu)
            for i in range(len(pool_sis)):
                d = pool_sis[(pool_idx + i) % len(pool_sis)]
                tope = _TOPES.get(d.regimen.value, 8)
                if _horas_asig.get(d.dni, 0) + h <= tope:
                    _horas_asig[d.dni] = _horas_asig.get(d.dni, 0) + h
                    pool_idx = (pool_idx + i + 1) % len(pool_sis)
                    return d
            # Fallback: el con más capacidad restante
            d = min(pool_sis, key=lambda x: _horas_asig.get(x.dni, 0) - _TOPES.get(x.regimen.value, 8))
            _horas_asig[d.dni] = _horas_asig.get(d.dni, 0) + h
            return d

        componentes_por_curso: dict[str, list[ComponenteAProgramar]] = {}

        for cod, curso in cursos.items():
            if curso.ciclo % 2 == 0:
                continue
            ciclo = curso.ciclo
            n_alumnos = alumnos_por_ciclo.get(ciclo, 25)

            seccion = Seccion(
                curso=curso, semestre=semestre,
                letra="A", num_alumnos=n_alumnos,
            )
            session.add(seccion)
            await session.flush()

            # Grupos de laboratorio (grupos de 15 alumnos)
            grupos: list[GrupoLab] = []
            if curso.horas_L > 0:
                n_grupos = grupos_reales_pdf.get(cod, max(1, (n_alumnos + 14) // 15))
                for g in range(1, n_grupos + 1):
                    alumnos_g = min(15, n_alumnos - (g - 1) * 15)
                    if alumnos_g <= 0:
                        break
                    grupo = GrupoLab(seccion=seccion, numero=g, num_alumnos=alumnos_g)
                    session.add(grupo)
                    grupos.append(grupo)
                await session.flush()

            # Determinar docente
            if cod in asignaciones_globales:
                docente_asignado = asignaciones_globales[cod]
            else:
                docente_asignado = siguiente_docente_para(curso, n_alumnos)

            # Componente T
            if curso.horas_T > 0:
                comp_t = ComponenteAProgramar(
                    seccion=seccion,
                    tipo=TipoComponenteEnum.T,
                    docente=docente_asignado,
                    horas_semanales=curso.horas_T,
                    grupo_lab=None,
                )
                session.add(comp_t)
                componentes_por_curso.setdefault(cod, []).append(comp_t)

            # Componente P
            if curso.horas_P > 0:
                comp_p = ComponenteAProgramar(
                    seccion=seccion,
                    tipo=TipoComponenteEnum.P,
                    docente=docente_asignado,
                    horas_semanales=curso.horas_P,
                    grupo_lab=None,
                )
                session.add(comp_p)
                componentes_por_curso.setdefault(cod, []).append(comp_p)

            # Componentes L (uno por grupo)
            for grupo in grupos:
                comp_l = ComponenteAProgramar(
                    seccion=seccion,
                    tipo=TipoComponenteEnum.L,
                    docente=docente_asignado,
                    horas_semanales=curso.horas_L,
                    grupo_lab=grupo,
                )
                session.add(comp_l)
                componentes_por_curso.setdefault(cod, []).append(comp_l)

        await session.flush()

        # ── USUARIOS ───────────────────────────────────────────────────────
        print("Precargando bloques del horario real 2026-I...")
        horas_colocadas: dict[int, int] = {}
        bloques_creados: list[HorarioBloque] = []

        def duracion_bloque(bloque: HorarioBloque) -> int:
            return bloque.hora_fin.hour - bloque.hora_inicio.hour + 1

        def horas_de(hora_inicio: int, duracion: int) -> set[int]:
            return set(range(hora_inicio, hora_inicio + duracion))

        def bloque_conflictua(
            componente: ComponenteAProgramar,
            dia: DiaEnum,
            hora_inicio: int,
            duracion: int,
            aula: Aula,
        ) -> bool:
            propuestas = horas_de(hora_inicio, duracion)
            ciclo = componente.seccion.curso.ciclo
            for bloque in bloques_creados:
                if bloque.dia != dia:
                    continue
                existentes = horas_de(bloque.hora_inicio.hour, duracion_bloque(bloque))
                if not (propuestas & existentes):
                    continue
                otro = bloque.componente
                if bloque.aula == aula:
                    return True
                if otro.docente_id and componente.docente_id and otro.docente_id == componente.docente_id:
                    return True
                if otro.seccion.curso.ciclo == ciclo:
                    ambos_labs = (
                        otro.tipo == TipoComponenteEnum.L
                        and componente.tipo == TipoComponenteEnum.L
                    )
                    if not ambos_labs:
                        return True
            return False

        def componente_para_bloque(ref) -> ComponenteAProgramar | None:
            aula = aulas.get(ref.aula_codigo)
            if not aula:
                return None
            aula_tipo = aula.tipo.value
            prioridad = ["L"] if aula_tipo.startswith("lab_") else ["T", "P", "L"]
            if ref.tipo_preferido:
                prioridad = [ref.tipo_preferido] + [p for p in prioridad if p != ref.tipo_preferido]

            curso = cursos.get(ref.curso_codigo)
            candidatos: list[ComponenteAProgramar] = []
            for comp in componentes_por_curso.get(ref.curso_codigo, []):
                if horas_colocadas.get(comp.id, 0) + ref.duracion > comp.horas_semanales:
                    continue
                if comp.tipo in (TipoComponenteEnum.T, TipoComponenteEnum.P):
                    if aula.tipo != TipoAulaEnum.comun:
                        continue
                else:
                    tipo_req = curso.tipo_lab_requerido if curso else None
                    if not tipo_aula_compatible(tipo_req or "lab_computo", aula_tipo):
                        continue
                candidatos.append(comp)

            candidatos.sort(key=lambda comp: (
                prioridad.index(comp.tipo.value) if comp.tipo.value in prioridad else 99,
                comp.grupo_lab.numero if comp.grupo_lab else 0,
                comp.id,
            ))
            return candidatos[0] if candidatos else None

        for ref in HORARIO_REFERENCIAL_2026_I:
            comp = componente_para_bloque(ref)
            aula = aulas.get(ref.aula_codigo)
            if not comp or not aula:
                continue
            dia = DiaEnum(ref.dia)
            if bloque_conflictua(comp, dia, ref.hora_inicio, ref.duracion, aula):
                continue

            bloque = HorarioBloque(
                semestre=semestre,
                componente=comp,
                dia=dia,
                hora_inicio=t(ref.hora_inicio),
                hora_fin=t(ref.hora_inicio + ref.duracion - 1, 50),
                aula=aula,
            )
            session.add(bloque)
            bloques_creados.append(bloque)
            horas_colocadas[comp.id] = horas_colocadas.get(comp.id, 0) + ref.duracion

        semestre.estado = EstadoSemestreEnum.generando
        await session.flush()
        print(f"  Bloques reales precargados: {len(bloques_creados)}")

        print("Creando usuarios...")
        usuarios = [
            User(
                email="admin@unt.edu.pe",
                password_hash=hash_password("admin123"),
                role=RoleEnum.admin,
                docente=None,
            ),
            User(
                email="director.escuela@unt.edu.pe",
                password_hash=hash_password("dir123"),
                role=RoleEnum.director_escuela,
                docente=d_mendoza_santos,
            ),
            User(
                email="director.depto@unt.edu.pe",
                password_hash=hash_password("depto123"),
                role=RoleEnum.director_depto,
                docente=d_cotrina,
            ),
            User(
                email="docente@unt.edu.pe",
                password_hash=hash_password("doc123"),
                role=RoleEnum.docente,
                docente=d_mendoza_rv,
            ),
        ]
        session.add_all(usuarios)
        await session.flush()

        await session.commit()

        n_cursos = len(cursos_data)
        n_docentes = len(docentes_data)
        n_aulas = len(aulas_data)
        print("\n[OK] Seed completado exitosamente")
        print(f"  Docentes reales:       {n_docentes}")
        print(f"  Cursos (Plan 2018):    {n_cursos}")
        print(f"  Aulas:                 {n_aulas}")
        print(f"  Semestre:              2026-I (13/04/2026 – 08/08/2026)")
        print(f"  Usuarios:              4")
        print()
        print("  Asignaciones reales del horario 2026-I:")
        print("    Ciclo I  — 7 cursos con docente")
        print("    Ciclo III — 8 cursos con docente")
        print("    Ciclo V  — 8 cursos con docente")
        print("    Ciclo VII — 8 cursos con docente")
        print("    Ciclo IX — 8 cursos con docente")
        print("    Ciclos II, IV, VI, VIII, X — asignación automática por tope")


if __name__ == "__main__":
    asyncio.run(seed())
