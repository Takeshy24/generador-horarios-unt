"""
Script de seed para el Generador de Horarios UNT.
Idempotente: borra y recrea todos los datos en cada ejecución.

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


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def t(h: int, m: int = 0) -> time:
    return time(h, m)


DIAS = [DiaEnum.LUN, DiaEnum.MAR, DiaEnum.MIE, DiaEnum.JUE, DiaEnum.VIE]


def disponibilidad_full(docente: Docente) -> list[DocenteDisponibilidad]:
    """L-V 7:00-13:00 y 14:00-20:00 (40h/semana)."""
    slots = []
    for dia in DIAS:
        slots.append(DocenteDisponibilidad(docente=docente, dia=dia, hora_inicio=t(7), hora_fin=t(13)))
        slots.append(DocenteDisponibilidad(docente=docente, dia=dia, hora_inicio=t(14), hora_fin=t(20)))
    return slots


def disponibilidad_manana(docente: Docente, dias=None) -> list[DocenteDisponibilidad]:
    """Solo mañanas."""
    return [
        DocenteDisponibilidad(docente=docente, dia=d, hora_inicio=t(7), hora_fin=t(13))
        for d in (dias or DIAS)
    ]


def disponibilidad_tarde(docente: Docente, dias=None) -> list[DocenteDisponibilidad]:
    """Solo tardes."""
    return [
        DocenteDisponibilidad(docente=docente, dia=d, hora_inicio=t(14), hora_fin=t(20))
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
        depto = Departamento(nombre="Departamento de Ingeniería de Sistemas", facultad=facultad)
        session.add_all([escuela, depto])
        await session.flush()

        # ── CURSOS ─────────────────────────────────────────────────────────
        print("Creando cursos...")
        cursos_data = [
            # Ciclo 1
            ("SIS101", "Matemática Básica",                    1, False, 3, 2, 0, None),
            ("SIS102", "Comunicación y Redacción",             1, False, 3, 2, 0, None),
            ("SIS103", "Algorítmica I",                        1, False, 2, 2, 2, "lab_computo"),
            ("SIS104", "Introducción a los Sistemas",         1, False, 2, 1, 0, None),
            # Ciclo 2
            ("SIS201", "Cálculo I",                           2, False, 3, 2, 0, None),
            ("SIS202", "Programación I",                      2, False, 2, 2, 2, "lab_computo"),
            ("SIS203", "Estadística I",                       2, False, 3, 2, 0, None),
            ("SIS204", "Comunicación II",                     2, False, 2, 2, 0, None),
            # Ciclo 3
            ("SIS301", "Cálculo II",                          3, False, 3, 2, 0, None),
            ("SIS302", "Programación II",                     3, False, 2, 2, 2, "lab_computo"),
            ("SIS303", "Algoritmos y Estructuras de Datos",   3, False, 2, 2, 2, "lab_computo"),
            ("SIS304", "Algebra Lineal",                      3, False, 3, 2, 0, None),
            # Ciclo 4
            ("SIS401", "Cálculo III",                         4, False, 3, 2, 0, None),
            ("SIS402", "Bases de Datos I",                    4, False, 2, 2, 2, "lab_bd"),
            ("SIS403", "Sistemas Operativos",                 4, False, 2, 2, 2, "lab_computo"),
            ("SIS404", "Matemática Discreta",                 4, False, 3, 2, 0, None),
            # Ciclo 5
            ("SIS501", "Bases de Datos II",                   5, False, 2, 2, 2, "lab_bd"),
            ("SIS502", "Redes de Computadoras I",             5, False, 2, 2, 2, "lab_redes"),
            ("SIS503", "Análisis de Sistemas",                5, False, 2, 2, 0, None),
            ("SIS504", "Probabilidad y Estadística",          5, False, 3, 2, 0, None),
            # Ciclo 6
            ("SIS601", "Ingeniería de Software (Base)",       6, False, 2, 2, 2, "lab_software"),
            ("SIS602", "Inteligencia Artificial",             6, False, 2, 2, 2, "lab_ia"),
            ("SIS603", "Calidad de Software",                 6, False, 2, 2, 0, None),
            ("SIS604", "Arquitectura de Computadoras",        6, False, 2, 2, 0, None),
            # Ciclo 7 — EXACTOS del horario real
            ("SIS701", "Ingeniería de Software I",            7, False, 2, 1, 3, "lab_software"),
            ("SIS702", "Redes y Comunicaciones I",            7, False, 1, 1, 3, "lab_redes"),
            ("SIS703", "Ingeniería de Software II",           7, False, 0, 0, 2, "lab_software"),
            ("SIS704", "Negocios Electrónicos",               7, True,  2, 0, 0, None),
            ("SIS705", "Gestión de Servicios de TI",          7, False, 1, 2, 2, "lab_computo"),
            ("SIS706", "Metodología de la Investigación",     7, False, 2, 2, 0, None),
            ("SIS707", "Administración de Base de Datos",     7, False, 1, 1, 3, "lab_bd"),
            ("SIS708", "Planeamiento Estratégico de TI",      7, False, 1, 2, 2, "lab_computo"),
            ("SIS709", "Cadena de Suministros",               7, True,  2, 2, 0, None),
            # Ciclo 8
            ("SIS801", "Auditoría de Sistemas",               8, False, 2, 2, 0, None),
            ("SIS802", "Seguridad Informática",               8, False, 2, 2, 2, "lab_computo"),
            ("SIS803", "Gestión de Proyectos de TI",          8, False, 2, 2, 0, None),
            ("SIS804", "Computación en la Nube",              8, False, 2, 2, 2, "lab_computo"),
            # Ciclo 9
            ("SIS901", "Inteligencia de Negocios",            9, False, 2, 2, 2, "lab_bd"),
            ("SIS902", "Sistemas Distribuidos",               9, False, 2, 2, 2, "lab_redes"),
            ("SIS903", "Gobierno de TI",                      9, False, 2, 2, 0, None),
            # Ciclo 10
            ("SIS1001", "Tesis I",                           10, False, 0, 4, 0, None),
            ("SIS1002", "Práctica Pre-profesional",          10, False, 0, 6, 0, None),
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

        # ── AULAS ──────────────────────────────────────────────────────────
        print("Creando aulas...")
        aulas_data = [
            # Aulas comunes
            ("A-201", TipoAulaEnum.comun, 40, "Pabellón A 2°"),
            ("A-202", TipoAulaEnum.comun, 40, "Pabellón A 2°"),
            ("A-203", TipoAulaEnum.comun, 50, "Pabellón A 2°"),
            ("A-204", TipoAulaEnum.comun, 50, "Pabellón A 2°"),
            ("A-205", TipoAulaEnum.comun, 60, "Pabellón A 2°"),
            ("A-301", TipoAulaEnum.comun, 40, "Pabellón A 3°"),
            ("A-302", TipoAulaEnum.comun, 40, "Pabellón A 3°"),
            ("A-303", TipoAulaEnum.comun, 50, "Pabellón A 3°"),
            ("A-304", TipoAulaEnum.comun, 50, "Pabellón A 3°"),
            ("A-305", TipoAulaEnum.comun, 60, "Pabellón A 3°"),
            ("A-307", TipoAulaEnum.comun, 35, "Pabellón A 3°"),
            ("A-308", TipoAulaEnum.comun, 35, "Pabellón A 3°"),
            ("A-311", TipoAulaEnum.comun, 30, "Pabellón A 3°"),
            ("A-401", TipoAulaEnum.comun, 45, "Pabellón A 4°"),
            ("A-402", TipoAulaEnum.comun, 45, "Pabellón A 4°"),
            # Laboratorios de cómputo
            ("LAB-C1", TipoAulaEnum.lab_computo, 20, "Pabellón B 1°"),
            ("LAB-C2", TipoAulaEnum.lab_computo, 20, "Pabellón B 1°"),
            ("LAB-C3", TipoAulaEnum.lab_computo, 15, "Pabellón B 2°"),
            # Laboratorio de Redes
            ("LAB-REDES", TipoAulaEnum.lab_redes, 15, "Pabellón B 2°"),
            # Laboratorio BD
            ("LAB-BD", TipoAulaEnum.lab_bd, 15, "Pabellón B 2°"),
            # Laboratorio IA
            ("LAB-IA", TipoAulaEnum.lab_ia, 20, "Pabellón B 3°"),
            # Laboratorio Software
            ("LAB-SW", TipoAulaEnum.lab_software, 20, "Pabellón B 3°"),
            # Salas adicionales
            ("SAL-POS1", TipoAulaEnum.comun, 30, "Posgrado A-303"),
            ("SAL-POS2", TipoAulaEnum.comun, 25, "Posgrado A-307"),
            ("SAL-POS3", TipoAulaEnum.comun, 25, "Posgrado A-311"),
        ]

        aulas: dict[str, Aula] = {}
        for cod, tipo, cap, ubic in aulas_data:
            a = Aula(codigo=cod, tipo=tipo, capacidad=cap, ubicacion=ubic)
            session.add(a)
            aulas[cod] = a
        await session.flush()

        # ── DOCENTES ───────────────────────────────────────────────────────
        print("Creando docentes...")
        docentes_data = [
            # (dni, nombre, tipo, fecha_ingreso, regimen, categoria)
            ("40001001", "Mendoza de los Santos, Alberto",   "nombrado", date(2000, 4, 1),  "DE",  "principal"),
            ("40001002", "Alcántara Moreno, Oscar Ramel",    "nombrado", date(2005, 4, 1),  "DE",  "principal"),
            ("40001003", "Cotrina Castellanos, Paul",        "nombrado", date(2010, 4, 1),  "TC",  "asociado"),
            ("40001004", "Mendoza Rivera, Ricardo",          "nombrado", date(2013, 4, 1),  "TC",  "asociado"),
            ("40001005", "Santos Fernández, Juan Pedro",     "nombrado", date(2017, 4, 1),  "TC",  "auxiliar"),
            ("40001006", "Agreda Gamboa, Everson David",     "nombrado", date(2018, 4, 1),  "TC",  "auxiliar"),
            ("40001007", "Gonzalez Vasquez, Jhoe",           "nombrado", date(2019, 4, 1),  "TC",  "auxiliar"),
            ("40001008", "Torres Vargas, Luis Alberto",      "nombrado", date(2003, 4, 1),  "DE",  "principal"),
            ("40001009", "Paredes Quispe, María Elena",      "nombrado", date(2008, 4, 1),  "TC",  "asociado"),
            ("40001010", "Romero Castillo, Jorge Humberto",  "nombrado", date(2012, 4, 1),  "TC",  "asociado"),
            ("40001011", "Villanueva López, Carlos Andrés",  "nombrado", date(2015, 4, 1),  "TC",  "auxiliar"),
            ("40001012", "Gutiérrez Salinas, Ana Patricia",  "nombrado", date(2016, 4, 1),  "TP1", "auxiliar"),
            ("40001013", "Chunga Távara, Marco Antonio",     "nombrado", date(2020, 4, 1),  "TC",  "auxiliar"),
            # Contratados
            ("40002001", "Sánchez Ticona, Robert Jerry",     "contratado", date(2022, 4, 1), "CONTRATO_A1", None),
            ("40002002", "Arellano Salazar, César",          "contratado", date(2024, 4, 1), "CONTRATO_B1", None),
            ("40002003", "Díaz Vásquez, Fernando",           "contratado", date(2023, 4, 1), "CONTRATO_A2", None),
            ("40002004", "Castro Flores, Milagros",          "contratado", date(2023, 4, 1), "CONTRATO_B2", None),
            ("40002005", "Ríos Herrera, Pablo César",        "contratado", date(2024, 4, 1), "CONTRATO_A3", None),
            ("40002006", "Valverde Noriega, Silvia",         "contratado", date(2022, 4, 1), "CONTRATO_A1", None),
            ("40002007", "Pretell Agreda, Juan Carlos",      "contratado", date(2021, 4, 1), "CONTRATO_B3", None),
        ]

        docentes: dict[str, Docente] = {}
        for dni, nombre, tipo, fi, regimen, cat in docentes_data:
            d = Docente(
                dni=dni,
                nombre_completo=nombre,
                tipo=TipoDocenteEnum(tipo),
                fecha_ingreso=fi,
                regimen=RegimenEnum(regimen),
                categoria=CategoriaEnum(cat) if cat else None,
                departamento=depto,
            )
            session.add(d)
            docentes[dni] = d
        await session.flush()

        # Alias cortos para legibilidad
        d_mendoza_santos = docentes["40001001"]   # Director escuela
        d_alcantara      = docentes["40001002"]   # Full disponibilidad
        d_cotrina        = docentes["40001003"]   # Director depto
        d_mendoza_rv     = docentes["40001004"]   # Cuenta "docente@unt.edu.pe"
        d_santos_fz      = docentes["40001005"]
        d_agreda         = docentes["40001006"]
        d_gonzalez       = docentes["40001007"]
        d_torres         = docentes["40001008"]
        d_paredes        = docentes["40001009"]
        d_romero         = docentes["40001010"]
        d_villanueva     = docentes["40001011"]
        d_gutierrez      = docentes["40001012"]
        d_chunga         = docentes["40001013"]
        d_sanchez        = docentes["40002001"]
        d_arellano       = docentes["40002002"]
        d_diaz           = docentes["40002003"]
        d_castro         = docentes["40002004"]
        d_rios           = docentes["40002005"]
        d_valverde       = docentes["40002006"]
        d_pretell        = docentes["40002007"]

        # ── CARGOS ADMINISTRATIVOS ─────────────────────────────────────────
        session.add(DocenteCargo(
            docente=d_mendoza_santos, cargo="director_escuela",
            fecha_inicio=date(2023, 1, 1), fecha_fin=None,
        ))
        session.add(DocenteCargo(
            docente=d_cotrina, cargo="director_depto",
            fecha_inicio=date(2023, 1, 1), fecha_fin=None,
        ))
        await session.flush()

        # ── DISPONIBILIDADES ───────────────────────────────────────────────
        print("Creando disponibilidades...")

        # d_mendoza_santos — Director Escuela: solo 10h (L-V mañana parcial 2h/día)
        session.add_all(disponibilidad_reducida(d_mendoza_santos, 2))

        # d_alcantara — Full 40h (DE)
        session.add_all(disponibilidad_full(d_alcantara))

        # d_cotrina — Director Depto: mañana L-V (30h disponibles)
        session.add_all(disponibilidad_manana(d_cotrina))

        # d_mendoza_rv — Normal 30h (mañana L-V)
        session.add_all(disponibilidad_manana(d_mendoza_rv))

        # d_santos_fz — Full 40h (mañana + tarde)
        session.add_all(disponibilidad_full(d_santos_fz))

        # d_agreda — Solo tardes
        session.add_all(disponibilidad_tarde(d_agreda))

        # d_gonzalez — Sin jueves (va a Huamachuco) — mañana y tarde L-Mi-Vi
        dias_sin_jue = [DiaEnum.LUN, DiaEnum.MAR, DiaEnum.MIE, DiaEnum.VIE]
        session.add_all(disponibilidad_manana(d_gonzalez, dias_sin_jue))
        session.add_all(disponibilidad_tarde(d_gonzalez, dias_sin_jue))

        # d_torres — Full 40h
        session.add_all(disponibilidad_full(d_torres))

        # d_paredes — Mañana L-J, tarde solo L-Mi (reducida natural)
        session.add_all(disponibilidad_manana(d_paredes, [DiaEnum.LUN, DiaEnum.MAR, DiaEnum.MIE, DiaEnum.JUE]))
        session.add_all(disponibilidad_tarde(d_paredes, [DiaEnum.LUN, DiaEnum.MIE]))

        # d_romero — Normal mañana + tarde L-J (no viernes tarde)
        session.add_all(disponibilidad_manana(d_romero))
        session.add_all(disponibilidad_tarde(d_romero, [DiaEnum.LUN, DiaEnum.MAR, DiaEnum.MIE, DiaEnum.JUE]))

        # d_villanueva — TP1, solo 20h: mañana L-V + tarde L-Mi
        session.add_all(disponibilidad_manana(d_villanueva))
        session.add_all(disponibilidad_tarde(d_villanueva, [DiaEnum.LUN, DiaEnum.MAR, DiaEnum.MIE]))

        # d_gutierrez — TP1, mañana L-J
        session.add_all(disponibilidad_manana(d_gutierrez, [DiaEnum.LUN, DiaEnum.MAR, DiaEnum.MIE, DiaEnum.JUE]))

        # d_chunga — TC nuevo, mañana completa L-V (30h disponibles)
        session.add_all(disponibilidad_manana(d_chunga))

        # Contratados — disponibilidades variadas
        session.add_all(disponibilidad_full(d_sanchez))
        session.add_all(disponibilidad_full(d_arellano))
        session.add_all(disponibilidad_full(d_diaz))
        session.add_all(disponibilidad_tarde(d_castro))
        session.add_all(disponibilidad_manana(d_rios))
        session.add_all(disponibilidad_full(d_valverde))
        session.add_all(disponibilidad_manana(d_pretell))

        await session.flush()

        # ── PREFERENCIAS ───────────────────────────────────────────────────
        prefs = [
            (d_mendoza_santos, TurnoEnum.manana, 2, None),
            (d_alcantara,      TurnoEnum.indiferente, 4, None),
            (d_cotrina,        TurnoEnum.manana, 2, None),
            (d_mendoza_rv,     TurnoEnum.manana, 4, None),
            (d_santos_fz,      TurnoEnum.manana, 4, None),
            (d_agreda,         TurnoEnum.tarde, 4, None),
            (d_gonzalez,       TurnoEnum.indiferente, 4, "JUE"),
            (d_torres,         TurnoEnum.indiferente, 4, None),
            (d_paredes,        TurnoEnum.manana, 4, None),
            (d_romero,         TurnoEnum.indiferente, 4, "VIE"),
            (d_villanueva,     TurnoEnum.manana, 4, None),
            (d_gutierrez,      TurnoEnum.manana, 3, None),
            (d_chunga,         TurnoEnum.indiferente, 4, None),
            (d_sanchez,        TurnoEnum.indiferente, 4, None),
            (d_arellano,       TurnoEnum.manana, 4, None),
            (d_diaz,           TurnoEnum.indiferente, 4, None),
            (d_castro,         TurnoEnum.tarde, 4, None),
            (d_rios,           TurnoEnum.manana, 4, None),
            (d_valverde,       TurnoEnum.indiferente, 4, None),
            (d_pretell,        TurnoEnum.manana, 4, None),
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

        # Todas las aulas disponibles para el semestre (insert directo — evita lazy load)
        await session.execute(
            insert(semestre_aulas_disponibles),
            [{"semestre_id": semestre.id, "aula_id": a.id} for a in aulas.values()],
        )
        await session.flush()

        # ── SECCIONES ──────────────────────────────────────────────────────
        print("Creando secciones, grupos y componentes...")

        # Asignaciones curso→docente para 7° ciclo (datos reales)
        asig_7 = {
            "SIS701": d_santos_fz,       # Ingeniería de Software I
            "SIS702": d_arellano,         # Redes y Comunicaciones I
            "SIS703": d_sanchez,          # Ingeniería de Software II
            "SIS704": d_agreda,           # Negocios Electrónicos
            "SIS705": d_mendoza_santos,   # Gestión de Servicios de TI
            "SIS706": d_cotrina,          # Metodología de la Investigación
            "SIS707": d_mendoza_rv,       # Administración de Base de Datos
            "SIS708": d_alcantara,        # Planeamiento Estratégico de TI
            "SIS709": d_gonzalez,         # Cadena de Suministros
        }

        # Docentes para ciclos restantes — asignación capacity-aware
        # Respeta el tope reglamentario de cada docente.
        _TOPES = {
            "DE": 22, "TC": 20, "TP1": 12, "TP2": 10, "TP3": 8,
            "CONTRATO_A1": 8, "CONTRATO_A2": 10, "CONTRATO_A3": 12,
            "CONTRATO_B1": 8, "CONTRATO_B2": 10, "CONTRATO_B3": 12,
        }

        # Pre-inicializar con las horas ya asignadas en el 7° ciclo (directo)
        _horas_asig: dict[str, int] = {}

        def _horas_curso_total(c: Curso, n_alu: int) -> int:
            n_g = max(1, (n_alu + 14) // 15) if c.horas_L > 0 else 0
            return c.horas_T + c.horas_P + c.horas_L * n_g

        _N7 = 28  # alumnos ciclo 7 (hardcoded para no depender del dict definido abajo)
        for cod7, doc7 in asig_7.items():
            if doc7:
                h7 = _horas_curso_total(cursos[cod7], _N7)
                _horas_asig[doc7.dni] = _horas_asig.get(doc7.dni, 0) + h7

        # Pool ordenado por prelación: nombrados primero, mayor antigüedad primero
        docentes_pool = [
            d_alcantara, d_torres, d_mendoza_rv, d_paredes, d_romero,
            d_villanueva, d_gutierrez, d_gonzalez, d_santos_fz, d_agreda,
            d_chunga, d_sanchez, d_diaz, d_valverde, d_pretell,
            d_arellano, d_castro, d_rios,
        ]
        pool_idx = 0

        def siguiente_docente_para(curso: Curso, n_alu: int) -> Docente:
            nonlocal pool_idx
            h = _horas_curso_total(curso, n_alu)
            for i in range(len(docentes_pool)):
                d = docentes_pool[(pool_idx + i) % len(docentes_pool)]
                tope = _TOPES.get(d.regimen.value, 8)
                if _horas_asig.get(d.dni, 0) + h <= tope:
                    _horas_asig[d.dni] = _horas_asig.get(d.dni, 0) + h
                    pool_idx = (pool_idx + i + 1) % len(docentes_pool)
                    return d
            # Fallback: el que tenga más capacidad restante
            d = min(docentes_pool, key=lambda x: _horas_asig.get(x.dni, 0) - _TOPES.get(x.regimen.value, 8))
            _horas_asig[d.dni] = _horas_asig.get(d.dni, 0) + h
            return d

        # Alias de compatibilidad
        def siguiente_docente() -> Docente:
            return docentes_pool[pool_idx % len(docentes_pool)]

        alumnos_por_ciclo = {
            1: 45, 2: 42, 3: 40, 4: 38, 5: 32, 6: 30,
            7: 14, 8: 14, 9: 14, 10: 15,
        }

        for cod, curso in cursos.items():
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
                n_grupos = max(1, (n_alumnos + 14) // 15)
                for g in range(1, n_grupos + 1):
                    alumnos_g = min(15, n_alumnos - (g - 1) * 15)
                    if alumnos_g <= 0:
                        break
                    grupo = GrupoLab(seccion=seccion, numero=g, num_alumnos=alumnos_g)
                    session.add(grupo)
                    grupos.append(grupo)
                await session.flush()

            # Determinar docente
            if ciclo == 7:
                docente_asignado = asig_7.get(cod)
            else:
                docente_asignado = siguiente_docente_para(curso, n_alumnos)

            # Componente T
            if curso.horas_T > 0:
                session.add(ComponenteAProgramar(
                    seccion=seccion,
                    tipo=TipoComponenteEnum.T,
                    docente=docente_asignado,
                    horas_semanales=curso.horas_T,
                    grupo_lab=None,
                ))

            # Componente P
            if curso.horas_P > 0:
                session.add(ComponenteAProgramar(
                    seccion=seccion,
                    tipo=TipoComponenteEnum.P,
                    docente=docente_asignado,
                    horas_semanales=curso.horas_P,
                    grupo_lab=None,
                ))

            # Componentes L (uno por grupo)
            for grupo in grupos:
                session.add(ComponenteAProgramar(
                    seccion=seccion,
                    tipo=TipoComponenteEnum.L,
                    docente=docente_asignado,
                    horas_semanales=curso.horas_L,
                    grupo_lab=grupo,
                ))

        await session.flush()

        # ── USUARIOS ───────────────────────────────────────────────────────
        print("Creando usuarios...")
        usuarios = [
            User(email="admin@unt.edu.pe",             password_hash=hash_password("admin123"),  role=RoleEnum.admin,            docente=None),
            User(email="director.escuela@unt.edu.pe",  password_hash=hash_password("dir123"),    role=RoleEnum.director_escuela, docente=d_mendoza_santos),
            User(email="director.depto@unt.edu.pe",    password_hash=hash_password("depto123"),  role=RoleEnum.director_depto,   docente=d_cotrina),
            User(email="docente@unt.edu.pe",           password_hash=hash_password("doc123"),    role=RoleEnum.docente,          docente=d_mendoza_rv),
        ]
        session.add_all(usuarios)
        await session.flush()

        await session.commit()
        print("\n[OK] Seed completado exitosamente")
        print(f"  Docentes:              20")
        print(f"  Cursos:                {len(cursos)}")
        print(f"  Aulas:                 {len(aulas)}")
        print(f"  Usuarios:              4")


if __name__ == "__main__":
    asyncio.run(seed())
