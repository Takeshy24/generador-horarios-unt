"""
Tests unitarios del motor de generación de horarios.

Ejecutar desde backend/:
    pytest tests/test_motor.py -v
"""

import pytest
from datetime import time

from app.motor.tipos import (
    ComponenteDomain, DocenteDomain, AulaDomain,
    DisponibilidadSlot, SlotAsignado, DIAS,
)
from app.motor.generador import generar, _candidatos_para_n_horas, _aulas_compatibles
from app.motor.restricciones import (
    r1_docente_no_doble_aula,
    r2_aula_no_doble_clase,
    r3_ciclo_no_doble_componente,
    r6_dentro_de_disponibilidad,
    r8_horario_franja_correcta,
    r11_hora_almuerzo_del_ciclo,
    verificar_todas,
)
from app.motor.pre_validador import pre_validar


# ── Helpers de fixture ────────────────────────────────────────────────────────

def disponibilidad_full() -> tuple:
    """L-V 7:00-13:00 y 14:00-20:00."""
    slots = []
    for dia in DIAS:
        slots.append(DisponibilidadSlot(dia=dia, hora_inicio=time(7, 0), hora_fin=time(13, 0)))
        slots.append(DisponibilidadSlot(dia=dia, hora_inicio=time(14, 0), hora_fin=time(20, 0)))
    return tuple(slots)


def make_docente(
    id: int,
    tipo: str = "nombrado",
    anios: float = 10.0,
    disponibilidad=None,
    tope: int = 20,
) -> DocenteDomain:
    return DocenteDomain(
        id=id,
        nombre=f"Docente {id}",
        tipo=tipo,
        antiguedad_anios=anios,
        disponibilidad=disponibilidad if disponibilidad is not None else disponibilidad_full(),
        tope_horas=tope,
    )


def make_aula(id: int, tipo: str = "comun", capacidad: int = 40) -> AulaDomain:
    return AulaDomain(id=id, codigo=f"A{id:03}", tipo=tipo, capacidad=capacidad)


def make_comp(
    id: int,
    ciclo: int = 1,
    tipo: str = "T",
    horas: int = 2,
    docente_id: int = 1,
    num_alumnos: int = 30,
    tipo_aula: str = "comun",
    curso_id: int = 1,
    seccion_id: int = 0,
) -> ComponenteDomain:
    return ComponenteDomain(
        id=id,
        seccion_id=seccion_id or id,
        curso_id=curso_id,
        curso_nombre=f"Curso {id}",
        ciclo=ciclo,
        tipo_componente=tipo,
        docente_id=docente_id,
        horas_semanales=horas,
        num_alumnos=num_alumnos,
        tipo_aula_requerido=tipo_aula,
    )


# ── Tests de candidatos ───────────────────────────────────────────────────────

def test_candidatos_1h():
    c = _candidatos_para_n_horas(1)
    # 5 días × (6 mañana + 6 tarde) = 60
    assert len(c) == 60
    assert ("LUN", 7) in c
    assert ("VIE", 19) in c
    # No debe incluir hora 13 (break)
    assert ("LUN", 13) not in c


def test_candidatos_3h():
    c = _candidatos_para_n_horas(3)
    # Mañana: 7,8,9,10 (4 starts) × 5 días = 20
    # Tarde:  14,15,16,17 (4 starts) × 5 días = 20
    assert len(c) == 40
    assert ("LUN", 10) in c       # 10+3-1=12 ≤ 12 ✓
    assert ("LUN", 11) not in c   # 11+3-1=13 > 12 ✗
    assert ("LUN", 17) in c       # 17+3-1=19 ≤ 19 ✓
    assert ("LUN", 18) not in c   # 18+3-1=20 > 19 ✗


def test_candidatos_6h():
    c = _candidatos_para_n_horas(6)
    # Solo start 7 mañana y start 14 tarde, × 5 días = 10
    assert len(c) == 10
    assert ("LUN", 7) in c
    assert ("LUN", 14) in c
    assert ("LUN", 8) not in c


# ── Tests de restricciones individuales ──────────────────────────────────────

def test_r8_franja_correcta():
    assert r8_horario_franja_correcta(7, 1)[0] is True
    assert r8_horario_franja_correcta(12, 1)[0] is True    # último slot mañana
    assert r8_horario_franja_correcta(19, 1)[0] is True    # último slot tarde
    assert r8_horario_franja_correcta(13, 1)[0] is False   # break
    assert r8_horario_franja_correcta(11, 2)[0] is True    # 11-12:50 OK
    assert r8_horario_franja_correcta(12, 2)[0] is False   # 12-13:50 cruza break


def test_r6_disponibilidad():
    doc = make_docente(1, disponibilidad=tuple([
        DisponibilidadSlot(dia="LUN", hora_inicio=time(7, 0), hora_fin=time(9, 0)),
    ]))
    comp = make_comp(1)

    ok, _ = r6_dentro_de_disponibilidad(comp, "LUN", 7, doc)
    assert ok is True   # 7:00-8:50 ⊂ 7:00-9:00 ✓

    ok, _ = r6_dentro_de_disponibilidad(comp, "LUN", 8, doc)
    assert ok is False  # 8:00-9:50 ⊄ 7:00-9:00 ✗

    ok, _ = r6_dentro_de_disponibilidad(comp, "MAR", 7, doc)
    assert ok is False  # martes no está en disponibilidad


def test_r1_docente_no_doble():
    comp_a = make_comp(1, docente_id=1, horas=2)
    comp_b = make_comp(2, docente_id=1, horas=1)
    comp_map = {1: comp_a, 2: comp_b}

    estado = [
        SlotAsignado(componente_id=1, dia="LUN",
                     hora_inicio=time(8, 0), hora_fin=time(9, 50), aula_id=1)
    ]

    # Mismo docente, solapamiento en hora 9
    ok, _ = r1_docente_no_doble_aula(comp_b, "LUN", 9, estado, comp_map)
    assert ok is False

    # Mismo docente, sin solapamiento
    ok, _ = r1_docente_no_doble_aula(comp_b, "LUN", 11, estado, comp_map)
    assert ok is True

    # Diferente día, no hay conflicto
    ok, _ = r1_docente_no_doble_aula(comp_b, "MAR", 9, estado, comp_map)
    assert ok is True


def test_r2_aula_no_doble():
    estado = [
        SlotAsignado(componente_id=1, dia="LUN",
                     hora_inicio=time(9, 0), hora_fin=time(9, 50), aula_id=5)
    ]

    ok, _ = r2_aula_no_doble_clase("LUN", 9, 1, 5, estado)
    assert ok is False  # misma aula, mismo día y hora

    ok, _ = r2_aula_no_doble_clase("LUN", 10, 1, 5, estado)
    assert ok is True   # misma aula, hora distinta

    ok, _ = r2_aula_no_doble_clase("LUN", 9, 1, 6, estado)
    assert ok is True   # diferente aula


def test_r3_ciclo_no_doble():
    comp_a = make_comp(1, ciclo=7, horas=2)
    comp_b = make_comp(2, ciclo=7, horas=1, docente_id=2)
    comp_c = make_comp(3, ciclo=5, horas=1, docente_id=3)  # ciclo distinto
    comp_map = {1: comp_a, 2: comp_b, 3: comp_c}

    estado = [
        SlotAsignado(componente_id=1, dia="LUN",
                     hora_inicio=time(9, 0), hora_fin=time(10, 50), aula_id=1)
    ]

    # Mismo ciclo, solapamiento → violación
    ok, _ = r3_ciclo_no_doble_componente(comp_b, "LUN", 10, estado, comp_map)
    assert ok is False

    # Mismo ciclo, sin solapamiento → OK
    ok, _ = r3_ciclo_no_doble_componente(comp_b, "LUN", 11, estado, comp_map)
    assert ok is True

    # Ciclo distinto → OK aunque solape
    ok, _ = r3_ciclo_no_doble_componente(comp_c, "LUN", 10, estado, comp_map)
    assert ok is True


def test_r3_labs_paralelos_misma_seccion():
    """Labs paralelos de la misma sección SÍ pueden solapar."""
    comp_lab1 = make_comp(1, ciclo=7, tipo="L", horas=3, seccion_id=10)
    comp_lab2 = make_comp(2, ciclo=7, tipo="L", horas=3, seccion_id=10)  # misma sección
    comp_map = {1: comp_lab1, 2: comp_lab2}

    estado = [
        SlotAsignado(componente_id=1, dia="LUN",
                     hora_inicio=time(7, 0), hora_fin=time(9, 50), aula_id=1)
    ]

    # Lab paralelo de la misma sección → excepción, debe ser OK
    ok, _ = r3_ciclo_no_doble_componente(comp_lab2, "LUN", 7, estado, comp_map)
    assert ok is True


def test_r11_almuerzo_bloqueado():
    """Si ciclo tiene mañana + tarde, slot a las 12 debe rechazarse."""
    comp_manana = make_comp(1, ciclo=7, horas=1, docente_id=1)
    comp_tarde = make_comp(2, ciclo=7, horas=1, docente_id=2)
    comp_mediodia = make_comp(3, ciclo=7, horas=1, docente_id=3)
    comp_map = {1: comp_manana, 2: comp_tarde, 3: comp_mediodia}

    estado = [
        SlotAsignado(componente_id=1, dia="LUN",
                     hora_inicio=time(9, 0), hora_fin=time(9, 50), aula_id=1),
        SlotAsignado(componente_id=2, dia="LUN",
                     hora_inicio=time(15, 0), hora_fin=time(15, 50), aula_id=1),
    ]

    # Slot a las 12 con mañana (9) y tarde (15) → violación
    ok, razon = r11_hora_almuerzo_del_ciclo(comp_mediodia, "LUN", 12, estado, comp_map)
    assert ok is False
    assert "almuerzo" in razon.lower() or "12" in razon

    # Slot a las 11 (no ocupa las 12) → OK
    ok, _ = r11_hora_almuerzo_del_ciclo(comp_mediodia, "LUN", 11, estado, comp_map)
    assert ok is True

    # Slot en día diferente → OK
    ok, _ = r11_hora_almuerzo_del_ciclo(comp_mediodia, "MAR", 12, estado, comp_map)
    assert ok is True


def test_r11_solo_manana_no_bloquea():
    """Si solo hay clases de mañana, el slot a las 12 NO debe bloquearse."""
    comp_a = make_comp(1, ciclo=3, horas=1, docente_id=1)
    comp_b = make_comp(2, ciclo=3, horas=1, docente_id=2)
    comp_map = {1: comp_a, 2: comp_b}

    estado = [
        SlotAsignado(componente_id=1, dia="MAR",
                     hora_inicio=time(9, 0), hora_fin=time(9, 50), aula_id=1),
    ]

    # Sin clase de tarde: slot a las 12 está permitido
    ok, _ = r11_hora_almuerzo_del_ciclo(comp_b, "MAR", 12, estado, comp_map)
    assert ok is True


# ── Tests de integración del generador ───────────────────────────────────────

def test_caso_feliz_1_componente():
    """1 docente, 1 componente de 2h → debe colocarse."""
    doc = make_docente(1)
    aula = make_aula(1)
    comp = make_comp(1, horas=2, docente_id=1)

    resultado = generar([comp], [doc], [aula])

    assert resultado.exitoso
    assert resultado.componentes_colocados == 1
    assert len(resultado.asignaciones) == 1
    slot = resultado.asignaciones[0]
    assert slot.componente_id == 1
    # Bloque de 2h: hora_fin.hour = hora_inicio.hour + 1
    assert slot.hora_fin.hour == slot.hora_inicio.hour + 1
    assert slot.hora_fin.minute == 50


def test_docente_sin_disponibilidad():
    """Docente con 0h disponibles → componente infactible."""
    doc = DocenteDomain(
        id=1, nombre="Sin disp", tipo="nombrado",
        antiguedad_anios=5, disponibilidad=tuple(), tope_horas=20,
    )
    aula = make_aula(1)
    comp = make_comp(1, horas=2, docente_id=1)

    resultado = generar([comp], [doc], [aula])

    assert not resultado.exitoso
    assert resultado.componentes_colocados == 0
    assert len(resultado.infactibles) == 1
    assert resultado.infactibles[0].componente_id == 1


def test_prelacion_nombrado_vs_contratado():
    """El nombrado obtiene el único slot disponible; el contratado queda infactible."""
    # Solo disponibilidad: LUN 7:00-9:00 (caben 2h pero no 2 docentes)
    disp_limitada = tuple([
        DisponibilidadSlot(dia="LUN", hora_inicio=time(7, 0), hora_fin=time(9, 0))
    ])
    doc_nombrado = make_docente(1, tipo="nombrado", anios=20.0,
                                disponibilidad=disp_limitada)
    doc_contratado = make_docente(2, tipo="contratado", anios=2.0,
                                  disponibilidad=disp_limitada)
    aula = make_aula(1)

    # Ambos docentes tienen el mismo único slot disponible
    comp_nombrado = make_comp(1, ciclo=1, horas=2, docente_id=1)
    comp_contratado = make_comp(2, ciclo=2, horas=2, docente_id=2)  # ciclo distinto

    resultado = generar(
        [comp_nombrado, comp_contratado],
        [doc_nombrado, doc_contratado],
        [aula],
    )

    slots_nombrado = [s for s in resultado.asignaciones if s.componente_id == 1]
    slots_contratado = [s for s in resultado.asignaciones if s.componente_id == 2]

    assert len(slots_nombrado) == 1, "El nombrado DEBE colocarse primero"
    assert len(slots_contratado) == 0, "El contratado NO debe colocarse (slot tomado)"
    assert len(resultado.infactibles) == 1
    assert resultado.infactibles[0].componente_id == 2


def test_prelacion_antiguedad_entre_nombrados():
    """Entre nombrados, el de mayor antigüedad gana el slot conflictivo."""
    disp = tuple([
        DisponibilidadSlot(dia="LUN", hora_inicio=time(7, 0), hora_fin=time(9, 0))
    ])
    doc_viejo = make_docente(1, tipo="nombrado", anios=25.0, disponibilidad=disp)
    doc_nuevo = make_docente(2, tipo="nombrado", anios=5.0, disponibilidad=disp)

    aula = make_aula(1)
    comp_viejo = make_comp(1, ciclo=1, horas=2, docente_id=1)
    comp_nuevo = make_comp(2, ciclo=2, horas=2, docente_id=2)

    resultado = generar(
        [comp_viejo, comp_nuevo],
        [doc_viejo, doc_nuevo],
        [aula],
    )

    slots_viejo = [s for s in resultado.asignaciones if s.componente_id == 1]
    assert len(slots_viejo) == 1
    assert len(resultado.infactibles) == 1
    assert resultado.infactibles[0].componente_id == 2


def test_ciclo_no_doble_se_resuelve():
    """2 componentes del mismo ciclo con 1 docente se colocan en slots distintos."""
    doc = make_docente(1)
    aula = make_aula(1)
    comp1 = make_comp(1, ciclo=5, horas=1, docente_id=1)
    comp2 = make_comp(2, ciclo=5, horas=1, docente_id=1)

    resultado = generar([comp1, comp2], [doc], [aula])

    assert resultado.exitoso
    s1 = resultado.asignaciones[0]
    s2 = resultado.asignaciones[1]

    if s1.dia == s2.dia:
        horas_s1 = set(range(s1.hora_inicio.hour, s1.hora_fin.hour + 1))
        horas_s2 = set(range(s2.hora_inicio.hour, s2.hora_fin.hour + 1))
        assert not (horas_s1 & horas_s2), "Mismas horas en el mismo día para el mismo ciclo"


def test_restriccion_almuerzo_en_generacion():
    """
    El generador no coloca un bloque a las 12:00 si el ciclo ya tiene
    clases de mañana y tarde ese día.
    """
    doc1 = make_docente(1, disponibilidad=tuple([
        DisponibilidadSlot(dia="LUN", hora_inicio=time(9, 0), hora_fin=time(10, 0)),
    ]))
    doc2 = make_docente(2, disponibilidad=tuple([
        DisponibilidadSlot(dia="LUN", hora_inicio=time(15, 0), hora_fin=time(16, 0)),
    ]))
    doc3 = make_docente(3, disponibilidad=tuple([
        DisponibilidadSlot(dia="LUN", hora_inicio=time(12, 0), hora_fin=time(13, 0)),
        DisponibilidadSlot(dia="MAR", hora_inicio=time(9, 0), hora_fin=time(10, 0)),
    ]))
    aula1 = make_aula(1)
    aula2 = make_aula(2)
    aula3 = make_aula(3)

    comp1 = make_comp(1, ciclo=7, horas=1, docente_id=1)  # LUN mañana
    comp2 = make_comp(2, ciclo=7, horas=1, docente_id=2)  # LUN tarde
    comp3 = make_comp(3, ciclo=7, horas=1, docente_id=3)  # intenta LUN 12:00

    resultado = generar(
        [comp1, comp2, comp3],
        [doc1, doc2, doc3],
        [aula1, aula2, aula3],
    )

    # comp1 y comp2 deben colocarse
    assert any(s.componente_id == 1 for s in resultado.asignaciones)
    assert any(s.componente_id == 2 for s in resultado.asignaciones)

    # comp3 no debe ir a LUN 12:00 (ciclo ya tiene mañana + tarde)
    for slot in resultado.asignaciones:
        if slot.componente_id == 3 and slot.dia == "LUN":
            assert slot.hora_inicio.hour != 12, (
                "No debe colocar clase a las 12:00 el LUN cuando hay mañana y tarde"
            )
    # comp3 debe colocarse en MAR (donde sí tiene disponibilidad libre)
    comp3_slots = [s for s in resultado.asignaciones if s.componente_id == 3]
    assert len(comp3_slots) == 1
    assert comp3_slots[0].dia == "MAR"


def test_sin_aula_del_tipo_necesario():
    """Sin aulas del tipo lab requerido → infactible."""
    doc = make_docente(1)
    aula_comun = make_aula(1, tipo="comun")
    comp_lab = make_comp(1, tipo="L", horas=3, tipo_aula="lab_redes")

    resultado = generar([comp_lab], [doc], [aula_comun])

    assert not resultado.exitoso
    assert len(resultado.infactibles) == 1


def test_determinismo():
    """Dos ejecuciones con el mismo input producen el mismo output."""
    doc = make_docente(1)
    aulas = [make_aula(i) for i in range(1, 4)]
    comps = [make_comp(i, ciclo=i, horas=2) for i in range(1, 6)]

    r1 = generar(comps, [doc], aulas)
    r2 = generar(comps, [doc], aulas)

    assert len(r1.asignaciones) == len(r2.asignaciones)
    for s1, s2 in zip(r1.asignaciones, r2.asignaciones):
        assert s1.componente_id == s2.componente_id
        assert s1.dia == s2.dia
        assert s1.hora_inicio == s2.hora_inicio
        assert s1.aula_id == s2.aula_id


def test_pre_validar_detecta_sin_disponibilidad():
    doc = DocenteDomain(
        id=1, nombre="Sin disp", tipo="nombrado",
        antiguedad_anios=5, disponibilidad=tuple(), tope_horas=20,
    )
    comp = make_comp(1, docente_id=1, horas=2)
    aula = make_aula(1)

    problemas = pre_validar([comp], [doc], [aula])
    errores = [p for p in problemas if p.nivel == "error"]
    assert any(p.categoria == "sin_disponibilidad" for p in errores)


def test_pre_validar_detecta_sin_aula_tipo():
    doc = make_docente(1)
    comp = make_comp(1, tipo="L", tipo_aula="lab_ia")
    aula_comun = make_aula(1, tipo="comun")

    problemas = pre_validar([comp], [doc], [aula_comun])
    errores = [p for p in problemas if p.nivel == "error"]
    assert any(p.categoria == "sin_aulas_del_tipo" for p in errores)


def test_componente_sin_docente_no_bloquea():
    """Componentes sin docente se ignoran y no generan error."""
    doc = make_docente(1)
    aula = make_aula(1)
    comp_con = make_comp(1, docente_id=1, horas=2)
    comp_sin = make_comp(2, docente_id=None, horas=2)

    resultado = generar([comp_con, comp_sin], [doc], [aula])

    # Solo el que tiene docente se coloca
    assert resultado.componentes_colocados == 1
    assert resultado.total_componentes == 1
    assert resultado.exitoso
