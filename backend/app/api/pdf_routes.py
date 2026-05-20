"""
Generación de PDFs del horario con ReportLab.

GET /api/horario/pdf/ciclo/{ciclo_num}?semestre_id=X   — grilla del ciclo
GET /api/horario/pdf/docente/{docente_id}?semestre_id=X — horario personal del docente
GET /api/horario/pdf/completo?semestre_id=X             — una página por ciclo (todos)
"""

from io import BytesIO
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas as rl_canvas

from app.core.db import get_db
from app.api.auth_routes import get_current_user
from app.models import Docente, Semestre
from app.api.horario import _get_bloques_db

router = APIRouter(prefix="/horario/pdf", tags=["pdf"])

# ── Layout (A4 landscape = 841.89 × 595.28 pt) ───────────────────────────────
_W, _H = landscape(A4)

_ML = 28.0
_MR = 23.0
_HEADER_H = 66.0   # blue header block height
_MB = 18.0

_HORA_COL = 44.0
_GRID_X = _ML
_GRID_W = _W - _ML - _MR
_DAY_COL = (_GRID_W - _HORA_COL) / 5

_GRID_TOP = _H - _HEADER_H - 4.0
_GRID_BOT = _MB
_GRID_H = _GRID_TOP - _GRID_BOT

_HDR_ROW = 21.0
_BODY_H = _GRID_H - _HDR_ROW
_ROW_H = _BODY_H / 12

DIAS = ["LUN", "MAR", "MIE", "JUE", "VIE"]
DIA_LABELS = {
    "LUN": "Lunes", "MAR": "Martes", "MIE": "Miércoles",
    "JUE": "Jueves", "VIE": "Viernes",
}
HORAS = [7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19]
CICLO_ROMANO = {
    1: "I", 2: "II", 3: "III", 4: "IV", 5: "V",
    6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X",
}

_BG = [
    (0.86, 0.93, 1.0), (0.82, 0.95, 0.88), (0.93, 0.88, 1.0),
    (1.0,  0.95, 0.78), (0.99, 0.90, 0.95), (0.88, 0.90, 1.0),
    (1.0,  0.93, 0.88), (0.80, 0.98, 0.97), (0.99, 0.89, 0.89),
    (0.88, 0.95, 0.99),
]
_TIPO_RGB = {
    "T": (0.24, 0.46, 1.0),
    "P": (0.13, 0.62, 0.38),
    "L": (0.50, 0.20, 0.80),
}


def _trunc(text: str, max_w: float, font_size: float) -> str:
    chars = int(max_w / max(font_size * 0.52, 1))
    return text if len(text) <= chars else text[: chars - 1] + "…"


def _day_x(i: int) -> float:
    return _GRID_X + _HORA_COL + i * _DAY_COL


def _cell(hora_idx: int, span: int) -> tuple[float, float]:
    PAD = 1.5
    y_bot = _GRID_TOP - _HDR_ROW - (hora_idx + span) * _ROW_H + PAD
    h = span * _ROW_H - 2 * PAD
    return y_bot, h


def _draw_page(
    c: rl_canvas.Canvas,
    bloques: list[dict],
    title: str,
    subtitle: str,
    semestre_codigo: str,
) -> None:
    """Dibuja una página del horario en el canvas. No llama showPage()."""

    # ── Encabezado azul ───────────────────────────────────────────────────────
    c.setFillColorRGB(0.09, 0.30, 0.62)
    c.rect(0, _H - _HEADER_H, _W, _HEADER_H, fill=1, stroke=0)

    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(_ML, _H - 21, title)
    c.setFont("Helvetica", 10)
    c.drawString(_ML, _H - 38, subtitle)
    c.setFont("Helvetica", 8)
    c.drawString(_ML, _H - 52, f"Semestre {semestre_codigo}  ·  {date_type.today().strftime('%d/%m/%Y')}")

    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(_W - _MR, _H - 24, "Universidad Nacional de Trujillo")
    c.setFont("Helvetica", 8)
    c.drawRightString(_W - _MR, _H - 38, "Escuela de Ingeniería de Sistemas")

    # ── Fila de encabezados de días ───────────────────────────────────────────
    hdr_y = _GRID_TOP - _HDR_ROW
    c.setFillColorRGB(0.93, 0.96, 1.0)
    c.rect(_GRID_X, hdr_y, _GRID_W, _HDR_ROW, fill=1, stroke=0)

    c.setFillColorRGB(0.09, 0.30, 0.62)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawCentredString(_GRID_X + _HORA_COL / 2, hdr_y + 6, "Hora")
    for i, dia in enumerate(DIAS):
        c.drawCentredString(_day_x(i) + _DAY_COL / 2, hdr_y + 6, DIA_LABELS[dia])

    # ── Filas de horas ────────────────────────────────────────────────────────
    for i, hora in enumerate(HORAS):
        y_row = _GRID_TOP - _HDR_ROW - (i + 1) * _ROW_H
        if i % 2 == 0:
            c.setFillColorRGB(0.972, 0.972, 0.972)
        else:
            c.setFillColorRGB(1.0, 1.0, 1.0)
        c.rect(_GRID_X, y_row, _GRID_W, _ROW_H, fill=1, stroke=0)

        c.setFillColorRGB(0.40, 0.40, 0.40)
        c.setFont("Helvetica", 7.5)
        c.drawCentredString(
            _GRID_X + _HORA_COL / 2,
            y_row + _ROW_H / 2 - 3.5,
            f"{hora:02d}:00",
        )

    # ── Bloques del horario ───────────────────────────────────────────────────
    for bloque in bloques:
        dia = bloque["dia"]
        if dia not in DIAS:
            continue

        start_h = int(bloque["hora_inicio"][:2])
        end_h = int(bloque["hora_fin"][:2])
        if start_h not in HORAS:
            continue

        hora_idx = HORAS.index(start_h)
        span = max(1, end_h - start_h + 1)
        span = min(span, len(HORAS) - hora_idx)

        dia_idx = DIAS.index(dia)
        PAD_X = 2.0
        x = _day_x(dia_idx) + PAD_X
        w = _DAY_COL - 2 * PAD_X
        y_bot, h = _cell(hora_idx, span)

        curso_id = bloque["componente"]["seccion"]["curso"]["id"]
        tipo = bloque["componente"]["tipo"]
        stroke = _TIPO_RGB.get(tipo, (0.5, 0.5, 0.5))

        # Fondo pastel
        c.setFillColorRGB(*_BG[curso_id % len(_BG)])
        c.roundRect(x, y_bot, w, h, radius=2.5, fill=1, stroke=0)

        # Borde por tipo
        c.setStrokeColorRGB(*stroke)
        c.setLineWidth(1.2)
        c.roundRect(x, y_bot, w, h, radius=2.5, fill=0, stroke=1)

        # Badge de tipo (T/P/L)
        bw, bh = 18, 9
        bx, by = x + 3, y_bot + h - bh - 2
        c.setFillColorRGB(*stroke)
        c.roundRect(bx, by, bw, bh, radius=1.5, fill=1, stroke=0)
        c.setFillColorRGB(1, 1, 1)
        c.setFont("Helvetica-Bold", 5.5)
        c.drawCentredString(bx + bw / 2, by + 2, tipo)

        # Nombre del curso
        curso_nombre = bloque["componente"]["seccion"]["curso"]["nombre"]
        c.setFillColorRGB(0.07, 0.12, 0.30)
        c.setFont("Helvetica-Bold", 6.5)
        name_y = by - 9.5
        c.drawString(x + 3, name_y, _trunc(curso_nombre, w - 6, 6.5))

        # Apellido del docente (celdas de ≥2h)
        if h >= 44:
            docente = bloque["componente"]["docente"]
            if docente:
                doc_ape = docente["nombre"].split(",")[0].strip()
                c.setFillColorRGB(0.25, 0.28, 0.50)
                c.setFont("Helvetica", 5.5)
                c.drawString(x + 3, name_y - 9, _trunc(doc_ape, w - 6, 5.5))

        # Sección + aula (celdas de ≥3h)
        if h >= 58:
            sec = bloque["componente"]["seccion"]["letra"]
            aula = bloque["aula"]["codigo"]
            c.setFillColorRGB(0.30, 0.30, 0.50)
            c.setFont("Helvetica", 5.0)
            c.drawString(x + 3, y_bot + 4, f"Sec.{sec}  {aula}")

    # ── Líneas de la grilla ───────────────────────────────────────────────────
    c.setLineWidth(0.35)
    c.setStrokeColorRGB(0.75, 0.75, 0.82)

    # Verticales
    for i in range(6):
        xv = _GRID_X + _HORA_COL + i * _DAY_COL
        c.line(xv, _GRID_BOT, xv, _GRID_TOP)
    c.line(_GRID_X, _GRID_BOT, _GRID_X, _GRID_TOP)

    # Horizontales
    for i in range(len(HORAS) + 1):
        y = _GRID_TOP - _HDR_ROW - i * _ROW_H
        c.line(_GRID_X, y, _GRID_X + _GRID_W, y)

    # Separador de encabezado (más grueso)
    c.setLineWidth(0.9)
    c.setStrokeColorRGB(0.50, 0.55, 0.72)
    c.line(_GRID_X, _GRID_TOP - _HDR_ROW, _GRID_X + _GRID_W, _GRID_TOP - _HDR_ROW)

    # Borde exterior
    c.setLineWidth(0.7)
    c.setStrokeColorRGB(0.40, 0.45, 0.62)
    c.rect(_GRID_X, _GRID_BOT, _GRID_W, _GRID_H, fill=0, stroke=1)

    # ── Pie de página ─────────────────────────────────────────────────────────
    c.setFont("Helvetica", 6.0)
    c.setFillColorRGB(0.55, 0.55, 0.55)
    c.drawCentredString(
        _W / 2, 7.0,
        "Sistema de Generación de Horarios  ·  Escuela de Ingeniería de Sistemas  ·  Universidad Nacional de Trujillo",
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/ciclo/{ciclo_num}")
async def pdf_ciclo(
    ciclo_num: int,
    semestre_id: int = Query(...),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """PDF con la grilla del ciclo especificado."""
    sem_res = await db.execute(select(Semestre).where(Semestre.id == semestre_id))
    semestre = sem_res.scalar_one_or_none()
    if not semestre:
        raise HTTPException(status_code=404, detail="Semestre no encontrado")

    bloques = await _get_bloques_db(db, semestre_id, ciclo=ciclo_num)
    if not bloques:
        raise HTTPException(status_code=404, detail=f"No hay bloques para el ciclo {ciclo_num}")

    num_romano = CICLO_ROMANO.get(ciclo_num, str(ciclo_num))
    title = f"Horario de Clases — Ciclo {num_romano}"
    subtitle = "Ingeniería de Sistemas  ·  Facultad de Ingeniería"

    buf = BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=landscape(A4))
    _draw_page(c, bloques, title, subtitle, semestre.codigo)
    c.showPage()
    c.save()
    buf.seek(0)

    filename = f"horario_ciclo{ciclo_num}_{semestre.codigo}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/docente/{docente_id}")
async def pdf_docente(
    docente_id: int,
    semestre_id: int = Query(...),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """PDF con el horario personal del docente."""
    sem_res = await db.execute(select(Semestre).where(Semestre.id == semestre_id))
    semestre = sem_res.scalar_one_or_none()
    if not semestre:
        raise HTTPException(status_code=404, detail="Semestre no encontrado")

    doc_res = await db.execute(select(Docente).where(Docente.id == docente_id))
    docente = doc_res.scalar_one_or_none()
    if not docente:
        raise HTTPException(status_code=404, detail="Docente no encontrado")

    bloques = await _get_bloques_db(db, semestre_id, docente_id=docente_id)
    if not bloques:
        raise HTTPException(status_code=404, detail="No hay bloques para este docente")

    title = f"Horario Personal — {docente.nombre_completo}"
    subtitle = "Ingeniería de Sistemas  ·  Facultad de Ingeniería"

    buf = BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=landscape(A4))
    _draw_page(c, bloques, title, subtitle, semestre.codigo)
    c.showPage()
    c.save()
    buf.seek(0)

    safe_name = docente.nombre_completo.replace(",", "").replace(" ", "_")[:30]
    filename = f"horario_{safe_name}_{semestre.codigo}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/completo")
async def pdf_completo(
    semestre_id: int = Query(...),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """PDF con una página por ciclo (todos los ciclos con bloques)."""
    sem_res = await db.execute(select(Semestre).where(Semestre.id == semestre_id))
    semestre = sem_res.scalar_one_or_none()
    if not semestre:
        raise HTTPException(status_code=404, detail="Semestre no encontrado")

    buf = BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=landscape(A4))

    pages_drawn = 0
    for ciclo_num in range(1, 11):
        bloques = await _get_bloques_db(db, semestre_id, ciclo=ciclo_num)
        if not bloques:
            continue
        num_romano = CICLO_ROMANO.get(ciclo_num, str(ciclo_num))
        _draw_page(
            c,
            bloques,
            f"Horario de Clases — Ciclo {num_romano}",
            "Ingeniería de Sistemas  ·  Facultad de Ingeniería",
            semestre.codigo,
        )
        c.showPage()
        pages_drawn += 1

    if pages_drawn == 0:
        raise HTTPException(status_code=404, detail="No hay horario generado para este semestre")

    c.save()
    buf.seek(0)

    filename = f"horario_completo_{semestre.codigo}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
