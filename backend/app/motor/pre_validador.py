"""
Pre-validación de factibilidad antes de correr el motor.
Detecta problemas obvios que harían fallar la generación total o parcialmente.
"""

from dataclasses import dataclass, field

from .tipos import ComponenteDomain, DocenteDomain, AulaDomain


@dataclass
class ProblemaPotencial:
    nivel: str          # 'error' | 'advertencia'
    categoria: str
    mensaje: str
    sugerencias: list[str] = field(default_factory=list)


def pre_validar(
    componentes: list[ComponenteDomain],
    docentes: list[DocenteDomain],
    aulas: list[AulaDomain],
) -> list[ProblemaPotencial]:
    """
    Detecta infactibilidades antes de correr el motor greedy.
    Retorna lista de problemas; 'error' bloquea la generación, 'advertencia' no.
    """
    problemas: list[ProblemaPotencial] = []

    # ── Por docente ───────────────────────────────────────────────────────────
    for docente in docentes:
        comps = [c for c in componentes if c.docente_id == docente.id]
        if not comps:
            continue

        horas_asignadas = sum(c.horas_semanales for c in comps)
        horas_disponibles = sum(
            d.hora_fin.hour - d.hora_inicio.hour
            for d in docente.disponibilidad
        )

        if horas_disponibles == 0:
            problemas.append(ProblemaPotencial(
                nivel="error",
                categoria="sin_disponibilidad",
                mensaje=(
                    f"Docente '{docente.nombre}' no tiene disponibilidad declarada "
                    f"y tiene {horas_asignadas}h asignadas"
                ),
                sugerencias=[
                    f"Registrar disponibilidad semanal del docente {docente.nombre}",
                ],
            ))
        elif horas_asignadas > horas_disponibles:
            problemas.append(ProblemaPotencial(
                nivel="error",
                categoria="disponibilidad_insuficiente",
                mensaje=(
                    f"Docente '{docente.nombre}': {horas_asignadas}h asignadas "
                    f"vs {horas_disponibles}h disponibles declaradas"
                ),
                sugerencias=[
                    f"Ampliar disponibilidad del docente {docente.nombre}",
                    "Reasignar algún curso a otro docente",
                ],
            ))

        if horas_asignadas > docente.tope_horas:
            # Advertencia (no error): el motor aplica R9 en tiempo real y reporta los infactibles.
            # Solo es error si la diferencia es grande (>4h), que indica un problema de asignación
            # severo en Fase 3.
            nivel_tope = "error" if (horas_asignadas - docente.tope_horas) > 4 else "advertencia"
            problemas.append(ProblemaPotencial(
                nivel=nivel_tope,
                categoria="carga_excede_tope",
                mensaje=(
                    f"Docente '{docente.nombre}': {horas_asignadas}h asignadas "
                    f"supera el tope reglamentario de {docente.tope_horas}h "
                    f"(exceso: {horas_asignadas - docente.tope_horas}h)"
                ),
                sugerencias=[
                    "Reasignar cursos a otro docente",
                    "Verificar régimen y cargos administrativos del docente",
                ],
            ))

    # ── Por tipo de aula ──────────────────────────────────────────────────────
    demanda_por_tipo: dict[str, int] = {}
    for c in componentes:
        if c.docente_id is not None:  # solo componentes que se intentarán programar
            demanda_por_tipo[c.tipo_aula_requerido] = (
                demanda_por_tipo.get(c.tipo_aula_requerido, 0) + c.horas_semanales
            )

    slots_por_tipo: dict[str, int] = {}
    for aula in aulas:
        # 12 slots/día × 6 días (L-S) = 72 slots por aula
        slots_por_tipo[aula.tipo] = slots_por_tipo.get(aula.tipo, 0) + 72

    for tipo, horas in demanda_por_tipo.items():
        oferta = slots_por_tipo.get(tipo, 0)
        if oferta == 0:
            problemas.append(ProblemaPotencial(
                nivel="error",
                categoria="sin_aulas_del_tipo",
                mensaje=(
                    f"No hay aulas de tipo '{tipo}' disponibles en el semestre "
                    f"({horas}h demandadas)"
                ),
                sugerencias=[
                    f"Agregar aulas de tipo '{tipo}' al pool del semestre",
                ],
            ))
        elif horas > oferta * 0.85:
            problemas.append(ProblemaPotencial(
                nivel="advertencia",
                categoria="alta_ocupacion_aulas",
                mensaje=(
                    f"Alta demanda de aulas tipo '{tipo}': "
                    f"{horas}h demandadas de {oferta} slots disponibles "
                    f"({round(100 * horas / oferta)}% ocupación teórica)"
                ),
                sugerencias=[
                    f"Considerar añadir más aulas de tipo '{tipo}'",
                ],
            ))

    # ── Componentes sin docente ───────────────────────────────────────────────
    sin_docente = [c for c in componentes if c.docente_id is None]
    if sin_docente:
        nombres = ", ".join(
            f"{c.curso_nombre} ({c.tipo_componente})"
            for c in sin_docente[:5]
        )
        extra = f" y {len(sin_docente) - 5} más" if len(sin_docente) > 5 else ""
        problemas.append(ProblemaPotencial(
            nivel="advertencia",
            categoria="componentes_sin_docente",
            mensaje=(
                f"{len(sin_docente)} componentes no tienen docente asignado "
                f"y no se programarán: {nombres}{extra}"
            ),
            sugerencias=[
                "Completar la asignación de cursos a docentes (Fase 3)",
            ],
        ))

    return problemas
