"""
Generación de PDFs del horario con ReportLab.

GET /api/horario/pdf/ciclo/{ciclo_num}?semestre_id=X   — grilla + tabla de carga del ciclo
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

# ── Layout grilla (A4 landscape = 841.89 × 595.28 pt) ────────────────────────
_W, _H = landscape(A4)

_ML = 28.0
_MR = 23.0
_HEADER_H = 66.0
_MB = 18.0

_HORA_COL = 44.0
_GRID_X = _ML
_GRID_W = _W - _ML - _MR
_DAY_COL = (_GRID_W - _HORA_COL) / 6

_GRID_TOP = _H - _HEADER_H - 4.0
_GRID_BOT = _MB
_GRID_H = _GRID_TOP - _GRID_BOT

_HDR_ROW = 21.0
_BODY_H = _GRID_H - _HDR_ROW
_ROW_H = _BODY_H / 14

# ── Layout carga docente (A4 portrait = 595.28 × 841.89 pt) ──────────────────
_PW, _PH = A4

DIAS = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB"]
DIA_LABELS = {
    "LUN": "Lunes", "MAR": "Martes", "MIE": "Miércoles",
    "JUE": "Jueves", "VIE": "Viernes", "SAB": "Sábado",
}
HORAS = list(range(7, 21))
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

_DEPT_PALETTE = [
    (1.00, 1.00, 0.84), (0.84, 0.95, 1.00), (0.87, 1.00, 0.87),
    (1.00, 0.87, 0.87), (0.94, 0.84, 1.00), (1.00, 0.93, 0.80),
    (0.84, 1.00, 0.95), (0.95, 0.95, 0.80),
]


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

        c.setFillColorRGB(*_BG[curso_id % len(_BG)])
        c.roundRect(x, y_bot, w, h, radius=2.5, fill=1, stroke=0)

        c.setStrokeColorRGB(*stroke)
        c.setLineWidth(1.2)
        c.roundRect(x, y_bot, w, h, radius=2.5, fill=0, stroke=1)

        bw, bh = 18, 9
        bx, by = x + 3, y_bot + h - bh - 2
        c.setFillColorRGB(*stroke)
        c.roundRect(bx, by, bw, bh, radius=1.5, fill=1, stroke=0)
        c.setFillColorRGB(1, 1, 1)
        c.setFont("Helvetica-Bold", 5.5)
        c.drawCentredString(bx + bw / 2, by + 2, tipo)

        curso_nombre = bloque["componente"]["seccion"]["curso"]["nombre"]
        c.setFillColorRGB(0.07, 0.12, 0.30)
        c.setFont("Helvetica-Bold", 6.5)
        name_y = by - 9.5
        c.drawString(x + 3, name_y, _trunc(curso_nombre, w - 6, 6.5))

        if h >= 44:
            docente = bloque["componente"]["docente"]
            if docente:
                doc_ape = docente["nombre"].split(",")[0].strip()
                c.setFillColorRGB(0.25, 0.28, 0.50)
                c.setFont("Helvetica", 5.5)
                c.drawString(x + 3, name_y - 9, _trunc(doc_ape, w - 6, 5.5))

        if h >= 58:
            sec = bloque["componente"]["seccion"]["letra"]
            aula = bloque["aula"]["codigo"]
            c.setFillColorRGB(0.30, 0.30, 0.50)
            c.setFont("Helvetica", 5.0)
            c.drawString(x + 3, y_bot + 4, f"Sec.{sec}  {aula}")

    # ── Líneas de la grilla ───────────────────────────────────────────────────
    c.setLineWidth(0.35)
    c.setStrokeColorRGB(0.75, 0.75, 0.82)

    for i in range(6):
        xv = _GRID_X + _HORA_COL + i * _DAY_COL
        c.line(xv, _GRID_BOT, xv, _GRID_TOP)
    c.line(_GRID_X, _GRID_BOT, _GRID_X, _GRID_TOP)

    for i in range(len(HORAS) + 1):
        y = _GRID_TOP - _HDR_ROW - i * _ROW_H
        c.line(_GRID_X, y, _GRID_X + _GRID_W, y)

    c.setLineWidth(0.9)
    c.setStrokeColorRGB(0.50, 0.55, 0.72)
    c.line(_GRID_X, _GRID_TOP - _HDR_ROW, _GRID_X + _GRID_W, _GRID_TOP - _HDR_ROW)

    c.setLineWidth(0.7)
    c.setStrokeColorRGB(0.40, 0.45, 0.62)
    c.rect(_GRID_X, _GRID_BOT, _GRID_W, _GRID_H, fill=0, stroke=1)

    c.setFont("Helvetica", 6.0)
    c.setFillColorRGB(0.55, 0.55, 0.55)
    c.drawCentredString(
        _W / 2, 7.0,
        "Sistema de Generación de Horarios  ·  Escuela de Ingeniería de Sistemas  ·  Universidad Nacional de Trujillo",
    )


def _draw_carga_page(
    c: rl_canvas.Canvas,
    bloques: list[dict],
    ciclo_num: int,
    semestre: Semestre,
) -> None:
    """Dibuja la tabla oficial de carga docente en portrait A4. No llama showPage()."""
    c.setPageSize(A4)

    ML, MR = 28.0, 23.0
    AW = _PW - ML - MR  # ≈ 544.28 pt

    # ── Agregar filas por (docente, curso), deduplicando por componente ───────
    seen: set[int] = set()
    carga: dict = {}

    for b in bloques:
        comp = b["componente"]
        cid = comp["id"]
        if cid in seen:
            continue
        seen.add(cid)
        doc = comp["docente"]
        if not doc:
            continue
        curso = comp["seccion"]["curso"]
        key = (doc["nombre"], doc.get("departamento", "—"), curso["nombre"])
        if key not in carga:
            carga[key] = {"T": 0, "P": 0, "L": 0, "G": 0}
        carga[key][comp["tipo"]] = comp["horas_semanales"]

    data_rows: list = sorted(
        [
            {
                "docente": k[0], "dpto": k[1], "curso": k[2],
                "T": v["T"], "P": v["P"], "L": v["L"], "G": v["G"],
                "total": v["T"] + v["P"] + v["L"] + v["G"],
            }
            for k, v in carga.items()
        ],
        key=lambda r: r["docente"],
    )

    # Filas en blanco para completar el formato oficial (mínimo 13)
    while len(data_rows) < 13:
        data_rows.append(None)

    # Asignar un color pastel por departamento
    depts = sorted({r["dpto"] for r in data_rows if r})
    dept_color = {d: _DEPT_PALETTE[i % len(_DEPT_PALETTE)] for i, d in enumerate(depts)}

    # ── Meta del semestre ─────────────────────────────────────────────────────
    parts = semestre.codigo.split("-")
    año, sem_num = (parts[0], parts[1]) if len(parts) == 2 else (semestre.codigo, "")
    ciclo_romano = CICLO_ROMANO.get(ciclo_num, str(ciclo_num))
    secciones_str = (
        ", ".join(sorted({b["componente"]["seccion"]["letra"] for b in bloques})) or "—"
    )

    # ── Encabezado institucional ──────────────────────────────────────────────
    y = _PH - 22

    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(_PW / 2, y, "UNIVERSIDAD NACIONAL DE TRUJILLO")
    y -= 14
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(_PW / 2, y, "FACULTAD DE INGENIERÍA")
    y -= 12
    c.setFont("Helvetica", 8)
    c.drawCentredString(_PW / 2, y, "TRUJILLO")
    y -= 10

    c.setStrokeColorRGB(0.20, 0.20, 0.20)
    c.setLineWidth(0.8)
    c.line(ML, y, _PW - MR, y)
    y -= 12

    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(ML, y, "ESCUELA: INGENIERÍA DE SISTEMAS")
    y -= 11
    c.drawString(ML, y, f"CICLO: {ciclo_romano}")
    c.drawString(ML + 180, y, f"SECCIÓN: {secciones_str}")
    y -= 11
    c.drawString(ML, y, f"AÑO ACADÉMICO: {año}")
    c.drawString(ML + 180, y, f"SEMESTRE: {sem_num}")
    y -= 11
    c.drawString(ML, y, f"Inicio del Ciclo: {semestre.fecha_inicio.strftime('%d/%m/%Y')}")
    c.drawString(ML + 230, y, f"Término Ciclo: {semestre.fecha_fin.strftime('%d/%m/%Y')}")
    y -= 16

    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(_PW / 2, y, "DISTRIBUCIÓN DE CARGA DOCENTE")
    y -= 14

    # ── Tabla ─────────────────────────────────────────────────────────────────
    # Anchos de columna; el último (DEPARTAMENTO) toma el espacio restante
    CW = [20, 133, 137, 22, 22, 22, 22, 40, 0]
    CW[8] = AW - sum(CW[:8])

    COLS = ["Nº", "PROFESOR", "ASIGNATURA", "T", "P", "L", "G", "T. HORAS", "DEPARTAMENTO"]
    HDR_H, ROW_H = 22, 15

    YELLOW = (0.97, 0.95, 0.74)
    NAVY   = (0.13, 0.22, 0.46)

    # ── Encabezado de columnas ────────────────────────────────────────────────
    hdr_top = y
    x = ML
    for ci, (label, cw) in enumerate(zip(COLS, CW)):
        is_text_col = ci in (1, 2)
        bg = YELLOW if is_text_col else NAVY
        fc = (0.10, 0.10, 0.10) if is_text_col else (1.0, 1.0, 1.0)
        c.setFillColorRGB(*bg)
        c.rect(x, hdr_top - HDR_H, cw, HDR_H, fill=1, stroke=0)
        c.setFillColorRGB(*fc)
        c.setFont("Helvetica-Bold", 6.5 if ci == 7 else 7.5)
        c.drawCentredString(x + cw / 2, hdr_top - HDR_H / 2 - 3.5, label)
        x += cw

    # Borde exterior del header
    c.setStrokeColorRGB(0.20, 0.26, 0.48)
    c.setLineWidth(0.9)
    c.rect(ML, hdr_top - HDR_H, AW, HDR_H, fill=0, stroke=1)

    # Líneas internas verticales del header
    x = ML
    for cw in CW[:-1]:
        x += cw
        c.setStrokeColorRGB(0.55, 0.58, 0.68)
        c.setLineWidth(0.4)
        c.line(x, hdr_top, x, hdr_top - HDR_H)

    # ── Filas de datos ────────────────────────────────────────────────────────
    def _fmt(v: int) -> str:
        return str(v) if v else "—"

    row_y = hdr_top - HDR_H

    for i, row in enumerate(data_rows):
        bg = dept_color.get(row["dpto"], (1, 1, 1)) if row else (1.0, 1.0, 1.0)
        c.setFillColorRGB(*bg)
        c.rect(ML, row_y - ROW_H, AW, ROW_H, fill=1, stroke=0)

        if row:
            ty = row_y - ROW_H / 2 - 3
            c.setFillColorRGB(0.07, 0.07, 0.10)

            # Nº
            c.setFont("Helvetica-Bold", 7.5)
            c.drawCentredString(ML + CW[0] / 2, ty, str(i + 1))

            # PROFESOR
            c.setFont("Helvetica", 7)
            px = ML + CW[0]
            c.drawString(px + 2, ty, _trunc(row["docente"], CW[1] - 4, 7))

            # ASIGNATURA
            px += CW[1]
            c.drawString(px + 2, ty, _trunc(row["curso"], CW[2] - 4, 7))

            # T P L G T.HORAS (centrados)
            px += CW[2]
            for key, cw in zip(["T", "P", "L", "G", "total"], CW[3:8]):
                c.drawCentredString(px + cw / 2, ty, _fmt(row[key]))
                px += cw

            # DEPARTAMENTO
            c.drawString(px + 2, ty, _trunc(row["dpto"], CW[8] - 4, 7))

        # Borde de la fila y líneas internas verticales
        c.setStrokeColorRGB(0.55, 0.55, 0.65)
        c.setLineWidth(0.3)
        c.rect(ML, row_y - ROW_H, AW, ROW_H, fill=0, stroke=1)
        x = ML
        for cw in CW[:-1]:
            x += cw
            c.line(x, row_y, x, row_y - ROW_H)

        row_y -= ROW_H

    # Borde exterior de toda la tabla (más grueso)
    total_h = HDR_H + ROW_H * len(data_rows)
    c.setStrokeColorRGB(0.18, 0.23, 0.44)
    c.setLineWidth(1.0)
    c.rect(ML, hdr_top - total_h, AW, total_h, fill=0, stroke=1)

    # ── Pie de página ─────────────────────────────────────────────────────────
    c.setFont("Helvetica", 6)
    c.setFillColorRGB(0.50, 0.50, 0.50)
    c.drawCentredString(
        _PW / 2, 12,
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
    """PDF con la grilla del ciclo + tabla de carga docente."""
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

    # Página 1: grilla del horario
    _draw_page(c, bloques, title, subtitle, semestre.codigo)
    c.showPage()

    # Página 2: tabla de carga docente
    _draw_carga_page(c, bloques, ciclo_num, semestre)
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
    """PDF completo: grilla + tabla de carga por cada ciclo con bloques."""
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

        # Grilla del ciclo
        c.setPageSize(landscape(A4))
        _draw_page(
            c,
            bloques,
            f"Horario de Clases — Ciclo {num_romano}",
            "Ingeniería de Sistemas  ·  Facultad de Ingeniería",
            semestre.codigo,
        )
        c.showPage()

        # Tabla de carga docente del ciclo
        _draw_carga_page(c, bloques, ciclo_num, semestre)
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
