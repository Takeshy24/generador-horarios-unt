"""
Algoritmo greedy de generación de horarios.

Estrategia:
1. Ordena docentes por prelación: nombrados (antigüedad desc) → contratados (antigüedad desc).
2. Para cada docente, intenta colocar sus componentes (los de mayor carga primero).
3. Para cada componente, prueba todos los (día, hora_inicio, aula) en orden determinista.
4. Usa el primer slot que pase las 11 restricciones duras.
5. Si ningún slot funciona: marca el componente como infactible y continúa.

No implementa backtracking entre docentes (trabajo futuro: OR-Tools).
El algoritmo es determinista: mismo input → mismo output.
"""

import logging
import time as _time
from datetime import time

from .tipos import (
    ComponenteDomain, DocenteDomain, AulaDomain,
    SlotAsignado, InfactibilidadInfo, ResultadoGeneracion,
    DIAS,
)
from .restricciones import verificar_todas

logger = logging.getLogger(__name__)


def _candidatos_para_n_horas(n: int) -> list[tuple[str, int]]:
    """
    Genera todos los (dia, hora_inicio) válidos para un bloque de n horas consecutivas.
    Orden: lunes→sábado, mañana (7-12) antes que tarde (14-19).
    """
    candidatos = []
    for dia in DIAS:
        for h in range(7, 14 - n):      # mañana: termina a las 13-n:50
            candidatos.append((dia, h))
        for h in range(14, 21 - n):     # tarde: termina a las 20-n:50
            candidatos.append((dia, h))
    return candidatos


def _aulas_compatibles(comp: ComponenteDomain, aulas: list[AulaDomain]) -> list[AulaDomain]:
    """
    Filtra aulas por tipo y capacidad mínima.
    Ordena por capacidad ascendente (preferir la más ajustada que alcanza)
    para no desperdiciar aulas grandes.
    """
    if comp.tipo_componente in ("T", "P"):
        tipo_req = "comun"
    else:
        tipo_req = comp.tipo_aula_requerido

    compatibles = [
        a for a in aulas
        if a.tipo == tipo_req and a.capacidad >= comp.num_alumnos
    ]
    return sorted(compatibles, key=lambda a: (a.capacidad, a.id))


def _intentar_colocar(
    comp: ComponenteDomain,
    docente: DocenteDomain | None,
    aulas: list[AulaDomain],
    estado: list[SlotAsignado],
    componentes_map: dict[int, ComponenteDomain],
) -> SlotAsignado | None:
    """
    Intenta colocar el componente en algún slot válido.
    Retorna el SlotAsignado si tiene éxito, None si es infactible.
    """
    candidatos = _candidatos_para_n_horas(comp.horas_semanales)
    aulas_ok = _aulas_compatibles(comp, aulas)

    if not aulas_ok:
        logger.debug(
            "  Sin aulas compatibles para %s-%s (tipo=%s, alumnos=%d)",
            comp.curso_nombre, comp.tipo_componente,
            comp.tipo_aula_requerido, comp.num_alumnos,
        )
        return None

    n = comp.horas_semanales
    for dia, start_h in candidatos:
        for aula in aulas_ok:
            violaciones = verificar_todas(
                comp, dia, start_h, aula, estado, docente, componentes_map
            )
            if not violaciones:
                slot = SlotAsignado(
                    componente_id=comp.id,
                    dia=dia,
                    hora_inicio=time(start_h, 0),
                    hora_fin=time(start_h + n - 1, 50),
                    aula_id=aula.id,
                )
                logger.debug(
                    "  [OK] %s-%s ciclo%d → %s %d:00-%d:50 aula %s",
                    comp.curso_nombre, comp.tipo_componente, comp.ciclo,
                    dia, start_h, start_h + n - 1, aula.codigo,
                )
                return slot

    logger.debug(
        "  [FAIL] %s-%s ciclo%d — ningún slot válido",
        comp.curso_nombre, comp.tipo_componente, comp.ciclo,
    )
    return None


def generar(
    componentes: list[ComponenteDomain],
    docentes: list[DocenteDomain],
    aulas: list[AulaDomain],
) -> ResultadoGeneracion:
    """
    Genera el horario para todos los componentes dados.
    Retorna ResultadoGeneracion con asignaciones y lista de infactibles.
    """
    t0 = _time.perf_counter()

    # Solo componentes que tienen docente asignado
    comps_con_docente = [c for c in componentes if c.docente_id is not None]

    # Índices para búsqueda O(1)
    componentes_map: dict[int, ComponenteDomain] = {c.id: c for c in componentes}
    docentes_map: dict[int, DocenteDomain] = {d.id: d for d in docentes}

    # Prelación: nombrados (antigüedad desc) → contratados (antigüedad desc)
    docentes_ordenados = sorted(
        docentes,
        key=lambda d: (0 if d.tipo == "nombrado" else 1, -d.antiguedad_anios),
    )

    # Componentes de cada docente, ordenados por dificultad desc:
    # más horas primero (más difícil de colocar), luego por ciclo y id para determinismo
    def comps_de_docente(doc_id: int) -> list[ComponenteDomain]:
        return sorted(
            [c for c in comps_con_docente if c.docente_id == doc_id],
            key=lambda c: (-c.horas_semanales, c.ciclo, c.id),
        )

    estado: list[SlotAsignado] = []
    infactibles: list[InfactibilidadInfo] = []

    for docente in docentes_ordenados:
        comps = comps_de_docente(docente.id)
        if not comps:
            continue

        logger.info(
            "Procesando: %s (%s, %.0f años, tope=%dh) — %d componentes",
            docente.nombre, docente.tipo, docente.antiguedad_anios,
            docente.tope_horas, len(comps),
        )

        for comp in comps:
            slot = _intentar_colocar(comp, docente, aulas, estado, componentes_map)
            if slot is not None:
                estado.append(slot)
            else:
                logger.warning(
                    "  INFACTIBLE: %s-%s ciclo%d",
                    comp.curso_nombre, comp.tipo_componente, comp.ciclo,
                )
                infactibles.append(InfactibilidadInfo(
                    componente_id=comp.id,
                    curso_nombre=comp.curso_nombre,
                    ciclo=comp.ciclo,
                    tipo_componente=comp.tipo_componente,
                    causa="No se encontró slot válido (ver reporte detallado)",
                    sugerencias=[],
                ))

    tiempo = _time.perf_counter() - t0
    exitoso = len(infactibles) == 0

    logger.info(
        "Generación completada: %d/%d colocados en %.3fs — %s",
        len(estado), len(comps_con_docente), tiempo,
        "EXITOSO" if exitoso else f"{len(infactibles)} INFACTIBLES",
    )

    return ResultadoGeneracion(
        exitoso=exitoso,
        asignaciones=estado,
        infactibles=infactibles,
        tiempo_segundos=round(tiempo, 3),
        total_componentes=len(comps_con_docente),
        componentes_colocados=len(estado),
    )
