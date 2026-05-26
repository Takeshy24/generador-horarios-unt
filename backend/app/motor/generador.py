"""Motor de generacion de horarios.

El motor trabaja en tres capas:
1. Intenta colocar la plantilla real del semestre, si existe.
2. Parte cada componente restante en fragmentos manejables.
3. Para cada fragmento elige el slot valido con mejor puntaje, no el primero.

La salida sigue usando HorarioBloque por bloque colocado. Un mismo componente
puede aparecer en varios bloques, como ocurre en los horarios reales.
"""

import logging
import time as _time
from collections import defaultdict
from dataclasses import dataclass, replace
from datetime import time

from .plantillas_reales import BloqueReferencial
from .tipos import (
    ComponenteDomain,
    DocenteDomain,
    AulaDomain,
    SlotAsignado,
    InfactibilidadInfo,
    ResultadoGeneracion,
    DIAS,
    ALL_STARTS,
    HORA_FIN_JORNADA,
    tipo_aula_compatible,
)
from .restricciones import verificar_todas

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _Fragmento:
    comp: ComponenteDomain
    horas: int
    origen: str = "generado"


def _candidatos_para_n_horas(n: int) -> list[tuple[str, int]]:
    """Genera candidatos continuos dentro de la jornada real."""
    candidatos = []
    ultimo_inicio = HORA_FIN_JORNADA - n + 1
    for dia in DIAS:
        for h in ALL_STARTS:
            if h <= ultimo_inicio:
                candidatos.append((dia, h))
    return candidatos


def _aulas_compatibles(comp: ComponenteDomain, aulas: list[AulaDomain]) -> list[AulaDomain]:
    """Filtra aulas por tipo/capacidad y prefiere la mas ajustada."""
    if comp.tipo_componente in ("T", "P"):
        compatibles = [
            a for a in aulas
            if a.tipo == "comun" and a.capacidad >= comp.num_alumnos
        ]
    else:
        compatibles = [
            a for a in aulas
            if tipo_aula_compatible(comp.tipo_aula_requerido, a.tipo)
            and a.capacidad >= comp.num_alumnos
        ]
    return sorted(compatibles, key=lambda a: (a.capacidad, a.id))


def _slot(start_h: int, n: int, comp_id: int, dia: str, aula_id: int) -> SlotAsignado:
    return SlotAsignado(
        componente_id=comp_id,
        dia=dia,
        hora_inicio=time(start_h, 0),
        hora_fin=time(start_h + n - 1, 50),
        aula_id=aula_id,
    )


def _horas_slot(slot: SlotAsignado) -> int:
    return slot.hora_fin.hour - slot.hora_inicio.hour + 1


def _horas_colocadas_por_comp(estado: list[SlotAsignado]) -> dict[int, int]:
    horas: dict[int, int] = defaultdict(int)
    for slot in estado:
        horas[slot.componente_id] += _horas_slot(slot)
    return horas


def _fragmentar(comp: ComponenteDomain, horas_restantes: int) -> list[_Fragmento]:
    """Divide horas semanales en sesiones realistas."""
    if horas_restantes <= 0:
        return []
    if horas_restantes <= 2:
        partes = [horas_restantes]
    elif horas_restantes == 3:
        partes = [2, 1]
    elif horas_restantes == 4:
        partes = [2, 2]
    elif horas_restantes == 5:
        partes = [3, 2]
    else:
        partes = []
        pendiente = horas_restantes
        while pendiente > 0:
            bloque = 3 if pendiente >= 3 else pendiente
            partes.append(bloque)
            pendiente -= bloque
    return [_Fragmento(comp=comp, horas=h) for h in partes]


def _comp_para_fragmento(comp: ComponenteDomain, horas: int) -> ComponenteDomain:
    """Usa horas del fragmento para validar duracion sin perder metadatos."""
    return replace(comp, horas_semanales=horas)


def _score_candidato(
    fragmento: _Fragmento,
    dia: str,
    start_h: int,
    aula: AulaDomain,
    estado: list[SlotAsignado],
    componentes_map: dict[int, ComponenteDomain],
) -> tuple[int, int, int, int, int]:
    comp = fragmento.comp
    horas_ciclo_dia = 0
    horas_docente_dia = 0
    usa_misma_aula = 0
    hueco_penalty = 0

    propuestas = set(range(start_h, start_h + fragmento.horas))
    for slot in estado:
        otro = componentes_map[slot.componente_id]
        if slot.dia != dia:
            continue
        horas = set(range(slot.hora_inicio.hour, slot.hora_fin.hour + 1))
        if otro.ciclo == comp.ciclo:
            horas_ciclo_dia += len(horas)
            if min(abs(h - p) for h in horas for p in propuestas) == 1:
                hueco_penalty -= 2
        if comp.docente_id is not None and otro.docente_id == comp.docente_id:
            horas_docente_dia += len(horas)
        if otro.curso_id == comp.curso_id and slot.aula_id == aula.id:
            usa_misma_aula -= 3

    # Preferencias suaves: repartir en la semana, mantener cursos cerca,
    # usar horas reales del PDF y evitar llenar todo al inicio de la semana.
    tarde_suave = 0 if start_h <= 18 else 4
    mediodia_ok = -1 if start_h in (12, 13) else 0
    sabado_penalty = 2 if dia == "SAB" else 0
    return (
        horas_ciclo_dia * 3,
        horas_docente_dia * 2,
        tarde_suave + sabado_penalty + mediodia_ok + hueco_penalty + usa_misma_aula,
        DIAS.index(dia),
        start_h,
    )


def _intentar_colocar_fragmento(
    fragmento: _Fragmento,
    docente: DocenteDomain | None,
    aulas: list[AulaDomain],
    estado: list[SlotAsignado],
    componentes_map: dict[int, ComponenteDomain],
    *,
    validar_docente: bool = True,
) -> SlotAsignado | None:
    comp_fragmento = _comp_para_fragmento(fragmento.comp, fragmento.horas)
    aulas_ok = _aulas_compatibles(comp_fragmento, aulas)
    if not aulas_ok:
        return None

    opciones: list[tuple[tuple[int, int, int, int, int], SlotAsignado]] = []
    for dia, start_h in _candidatos_para_n_horas(fragmento.horas):
        for aula in aulas_ok:
            violaciones = verificar_todas(
                comp_fragmento,
                dia,
                start_h,
                aula,
                estado,
                docente if validar_docente else None,
                componentes_map,
            )
            if not violaciones:
                opciones.append((
                    _score_candidato(
                        fragmento, dia, start_h, aula, estado, componentes_map
                    ),
                    _slot(start_h, fragmento.horas, fragmento.comp.id, dia, aula.id),
                ))

    if not opciones:
        return None

    opciones.sort(key=lambda item: item[0])
    return opciones[0][1]


def _componentes_ordenados(
    componentes: list[ComponenteDomain],
    docentes: list[DocenteDomain],
) -> list[ComponenteDomain]:
    docentes_map = {d.id: d for d in docentes}

    def key(comp: ComponenteDomain) -> tuple[int, float, int, int, int]:
        docente = docentes_map.get(comp.docente_id) if comp.docente_id else None
        tipo_doc = 0 if docente and docente.tipo == "nombrado" else 1
        antiguedad = -(docente.antiguedad_anios if docente else 0)
        dificultad = -comp.horas_semanales
        return (tipo_doc, antiguedad, dificultad, comp.ciclo, comp.id)

    return sorted(
        [c for c in componentes if c.docente_id is not None],
        key=key,
    )


def _buscar_comp_para_plantilla(
    ref: BloqueReferencial,
    componentes: list[ComponenteDomain],
    aulas_map: dict[str, AulaDomain],
    horas_colocadas: dict[int, int],
) -> ComponenteDomain | None:
    aula = aulas_map.get(ref.aula_codigo)
    aula_es_lab = bool(aula and aula.tipo.startswith("lab_"))
    prioridad = ["L"] if aula_es_lab else ["T", "P", "L"]
    if ref.tipo_preferido:
        prioridad = [ref.tipo_preferido] + [t for t in prioridad if t != ref.tipo_preferido]

    candidatos = [
        comp for comp in componentes
        if comp.curso_codigo == ref.curso_codigo
        and horas_colocadas.get(comp.id, 0) + ref.duracion <= comp.horas_semanales
    ]
    if aula:
        candidatos = [
            comp for comp in candidatos
            if (
                (comp.tipo_componente in ("T", "P") and aula.tipo == "comun")
                or (
                    comp.tipo_componente == "L"
                    and tipo_aula_compatible(comp.tipo_aula_requerido, aula.tipo)
                )
            )
        ]

    candidatos.sort(
        key=lambda c: (
            prioridad.index(c.tipo_componente)
            if c.tipo_componente in prioridad else 99,
            c.grupo_lab_numero or 0,
            c.id,
        )
    )
    return candidatos[0] if candidatos else None


def _aplicar_plantilla(
    plantilla: tuple[BloqueReferencial, ...],
    componentes: list[ComponenteDomain],
    docentes_map: dict[int, DocenteDomain],
    aulas: list[AulaDomain],
    estado: list[SlotAsignado],
    componentes_map: dict[int, ComponenteDomain],
) -> int:
    aulas_map = {a.codigo: a for a in aulas}
    colocados = 0

    for ref in plantilla:
        horas_colocadas = _horas_colocadas_por_comp(estado)
        comp = _buscar_comp_para_plantilla(ref, componentes, aulas_map, horas_colocadas)
        aula = aulas_map.get(ref.aula_codigo)
        if comp is None or aula is None:
            continue

        fragmento = _Fragmento(comp=comp, horas=ref.duracion, origen="plantilla")
        comp_fragmento = _comp_para_fragmento(comp, ref.duracion)
        violaciones = verificar_todas(
            comp_fragmento,
            ref.dia,
            ref.hora_inicio,
            aula,
            estado,
            None,  # La plantilla real funciona como asignacion manual autorizada.
            componentes_map,
        )
        if violaciones:
            logger.debug(
                "Plantilla omitida %s %s %s %s: %s",
                ref.curso_codigo, ref.dia, ref.hora_inicio, ref.aula_codigo,
                ", ".join(v.restriccion for v in violaciones),
            )
            continue

        estado.append(_slot(ref.hora_inicio, fragmento.horas, comp.id, ref.dia, aula.id))
        colocados += 1

    return colocados


def generar(
    componentes: list[ComponenteDomain],
    docentes: list[DocenteDomain],
    aulas: list[AulaDomain],
    plantilla: tuple[BloqueReferencial, ...] | None = None,
) -> ResultadoGeneracion:
    """Genera el horario para los componentes dados."""
    t0 = _time.perf_counter()

    comps_con_docente = [c for c in componentes if c.docente_id is not None]
    componentes_map: dict[int, ComponenteDomain] = {c.id: c for c in componentes}
    docentes_map: dict[int, DocenteDomain] = {d.id: d for d in docentes}

    estado: list[SlotAsignado] = []
    infactibles: list[InfactibilidadInfo] = []

    if plantilla:
        n = _aplicar_plantilla(
            plantilla, comps_con_docente, docentes_map, aulas, estado, componentes_map
        )
        logger.info("Plantilla referencial aplicada: %d bloques", n)

    for comp in _componentes_ordenados(comps_con_docente, docentes):
        horas_actuales = _horas_colocadas_por_comp(estado).get(comp.id, 0)
        pendientes = comp.horas_semanales - horas_actuales
        if pendientes <= 0:
            continue

        docente = docentes_map.get(comp.docente_id) if comp.docente_id else None
        fragmentos = _fragmentar(comp, pendientes)

        for fragmento in fragmentos:
            slot = _intentar_colocar_fragmento(
                fragmento,
                docente,
                aulas,
                estado,
                componentes_map,
                validar_docente=True,
            )
            if slot is not None:
                estado.append(slot)
            else:
                infactibles.append(InfactibilidadInfo(
                    componente_id=comp.id,
                    curso_nombre=comp.curso_nombre,
                    ciclo=comp.ciclo,
                    tipo_componente=comp.tipo_componente,
                    causa=(
                        f"No se encontro slot valido para un fragmento de "
                        f"{fragmento.horas}h"
                    ),
                    sugerencias=[],
                ))
                break

    horas_colocadas = _horas_colocadas_por_comp(estado)
    ids_infactibles = {inf.componente_id for inf in infactibles}
    for comp in comps_con_docente:
        colocadas = horas_colocadas.get(comp.id, 0)
        if colocadas < comp.horas_semanales and comp.id not in ids_infactibles:
            infactibles.append(InfactibilidadInfo(
                componente_id=comp.id,
                curso_nombre=comp.curso_nombre,
                ciclo=comp.ciclo,
                tipo_componente=comp.tipo_componente,
                causa=f"Componente parcialmente colocado: {colocadas}/{comp.horas_semanales}h",
                sugerencias=[],
            ))

    tiempo = _time.perf_counter() - t0
    componentes_colocados = sum(
        1 for comp in comps_con_docente
        if horas_colocadas.get(comp.id, 0) >= comp.horas_semanales
    )
    exitoso = len(infactibles) == 0

    logger.info(
        "Generacion completada: %d/%d componentes completos, %d bloques en %.3fs",
        componentes_colocados, len(comps_con_docente), len(estado), tiempo,
    )

    return ResultadoGeneracion(
        exitoso=exitoso,
        asignaciones=estado,
        infactibles=infactibles,
        tiempo_segundos=round(tiempo, 3),
        total_componentes=len(comps_con_docente),
        componentes_colocados=componentes_colocados,
    )
