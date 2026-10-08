"""
Genera la bitácora mensual en formato Excel o PDF.

La estructura de exportación sigue la misma lógica de la Bitácora web:
una fila por empleado y por día, agrupando Entrada y Salida.

También incorpora la identidad visual de la Fundación Liceo Comercial
Ciudad de El Bordo mediante el logo institucional.
"""

import io
from collections import defaultdict
from datetime import time
from pathlib import Path

from django.utils import timezone

from openpyxl import Workbook
from openpyxl.drawing.image import Image as ExcelImage
from openpyxl.styles import (
    Alignment,
    Border,
    Font,
    PatternFill,
    Side,
)
from openpyxl.utils import get_column_letter

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image as ReportLabImage,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.styles import (
    ParagraphStyle,
    getSampleStyleSheet,
)


# ============================================================
# CONFIGURACIÓN
# ============================================================

MESES_ES = [
    "",
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
]


HEADERS = [
    "Empleado",
    "Documento",
    "Área",
    "Sede",
    "Fecha",
    "Entrada",
    "Salida",
    "Observación",
]


# Colores tomados de la identidad visual del logo
COLOR_VERDE = "7F9415"
COLOR_VERDE_OSCURO = "687A0F"
COLOR_VERDE_CLARO = "EEF2D9"

COLOR_NARANJA = "FF6808"
COLOR_NARANJA_CLARO = "FFF0E7"

COLOR_GRIS_TEXTO = "4B5563"
COLOR_GRIS_BORDE = "D9DEE2"
COLOR_GRIS_FONDO = "F7F8F6"

COLOR_BLANCO = "FFFFFF"


# El logo está junto a este archivo:
#
# attendance/
# └── services/
#     ├── export.py
#     └── assets/
#         └── logo_fundacion.jpeg
#
LOGO_PATH = (
    Path(__file__).resolve().parent
    / "assets"
    / "logo_fundacion.jpeg"
)


# ============================================================
# UTILIDADES
# ============================================================

def _format_confidence(value):
    """Convierte una confianza 0-1 en porcentaje."""

    if value is None:
        return None

    return f"{value:.0%}"


def _format_sede(sede):
    """Convierte el valor interno de sede en su nombre visible."""

    if not sede:
        return "-"

    sede_labels = {
        "CENTRO": "Centro",
        "NORTE": "Norte",
    }

    return sede_labels.get(sede, sede)


def _format_day_filter(day):
    """
    Convierte YYYY-MM-DD a una fecha legible para el encabezado.
    """

    if not day:
        return "Todos los días"

    try:
        selected_day = timezone.datetime.strptime(
            day,
            "%Y-%m-%d",
        ).date()

        return selected_day.strftime("%d/%m/%Y")

    except (TypeError, ValueError):
        return str(day)


def _format_marking(log):
    """
    Formatea una marcación.

    Ejemplo:

    07:45
    Reconocimiento facial · 98%
    """

    if log is None:
        return "—"

    local_ts = timezone.localtime(log.timestamp)

    time_text = local_ts.strftime("%H:%M")
    method_text = log.get_method_display()
    confidence_text = _format_confidence(
        log.match_confidence
    )

    if confidence_text:
        return (
            f"{time_text}\n"
            f"{method_text} · {confidence_text}"
        )

    return (
        f"{time_text}\n"
        f"{method_text}"
    )


def _build_monthly_rows(logs):
    """
    Agrupa los registros por empleado y día.

    Una fila representa:

        Empleado + Día

    y puede contener:

        Entrada
        Salida
        Observación
    """

    grouped = defaultdict(
        lambda: {
            "employee": None,
            "document": None,
            "department": None,
            "sede": None,
            "date": None,
            "entrada": None,
            "salida": None,
            "notes": "",
        }
    )

    for log in logs:
        local_ts = timezone.localtime(log.timestamp)
        local_day = local_ts.date()

        key = (
            log.employee_id,
            local_day,
        )

        row = grouped[key]

        row["employee"] = log.employee.full_name
        row["document"] = log.employee.document_id
        row["department"] = (
            log.employee.department or "-"
        )
        row["sede"] = _format_sede(
            log.employee.sede
        )
        row["date"] = local_day

        if log.log_type == "ENTRADA":
            row["entrada"] = log

        elif log.log_type == "SALIDA":
            row["salida"] = log

        if log.notes:
            row["notes"] = log.notes

    rows = list(grouped.values())

    # Orden:
    # 1. Fecha más reciente primero.
    # 2. Dentro del día, entrada más reciente primero.
    #
    # time.min evita errores cuando una fila no tiene entrada.
    rows.sort(
        key=lambda row: (
            row["date"],
            (
                timezone.localtime(
                    row["entrada"].timestamp
                ).time()
                if row["entrada"]
                else time.min
            ),
        ),
        reverse=True,
    )

    return rows


def _get_summary(rows):
    """
    Calcula estadísticas para el encabezado del reporte.
    """

    employees = {
        row["document"]
        for row in rows
        if row["document"]
    }

    entries = sum(
        1
        for row in rows
        if row["entrada"] is not None
    )

    exits = sum(
        1
        for row in rows
        if row["salida"] is not None
    )

    still_inside = sum(
        1
        for row in rows
        if row["entrada"] is not None
        and row["salida"] is None
    )

    return {
        "rows": len(rows),
        "employees": len(employees),
        "entries": entries,
        "exits": exits,
        "still_inside": still_inside,
    }


def _get_filter_text(sede="", day=""):
    """
    Genera el texto de los filtros utilizados.
    """

    sede_text = (
        _format_sede(sede.upper())
        if sede
        else "Todas las sedes"
    )

    day_text = _format_day_filter(day)

    return sede_text, day_text


# ============================================================
# EXCEL
# ============================================================

def build_monthly_excel(
    logs,
    year: int,
    month: int,
    sede="",
    day="",
) -> bytes:
    """
    Genera el Excel mensual agrupado por empleado y día.
    """

    rows = _build_monthly_rows(logs)
    summary = _get_summary(rows)

    sede_text, day_text = _get_filter_text(
        sede,
        day,
    )

    wb = Workbook()
    ws = wb.active
    ws.title = "Bitácora"

    ws.sheet_view.showGridLines = False

    # ========================================================
    # LOGO
    # ========================================================

    if LOGO_PATH.exists():
        logo = ExcelImage(str(LOGO_PATH))

        # El logo original es cuadrado.
        logo.width = 105
        logo.height = 105

        ws.add_image(logo, "A1")

    # ========================================================
    # ENCABEZADO
    # ========================================================

    last_column = get_column_letter(
        len(HEADERS)
    )

    ws.merge_cells(
        f"B1:{last_column}1"
    )

    ws["B1"] = (
        "BITÁCORA DE ENTRADA Y SALIDA "
        "DE PERSONAL"
    )

    ws["B1"].font = Font(
        size=17,
        bold=True,
        color=COLOR_VERDE_OSCURO,
    )

    ws["B1"].alignment = Alignment(
        horizontal="center",
        vertical="center",
    )

    ws.merge_cells(
        f"B2:{last_column}2"
    )

    ws["B2"] = (
        f"{MESES_ES[month]} {year}"
    )

    ws["B2"].font = Font(
        size=12,
        bold=True,
        color=COLOR_NARANJA,
    )

    ws["B2"].alignment = Alignment(
        horizontal="center",
        vertical="center",
    )

    ws.merge_cells(
        f"B3:{last_column}3"
    )

    ws["B3"] = (
        f"Sede: {sede_text}    |    "
        f"Fecha: {day_text}"
    )

    ws["B3"].font = Font(
        size=10,
        color=COLOR_GRIS_TEXTO,
    )

    ws["B3"].alignment = Alignment(
        horizontal="center",
        vertical="center",
    )

    # ========================================================
    # RESUMEN
    # ========================================================

    summary_row = 5

    summary_data = [
        (
            "Registros",
            summary["rows"],
        ),
        (
            "Empleados",
            summary["employees"],
        ),
        (
            "Entradas",
            summary["entries"],
        ),
        (
            "Salidas",
            summary["exits"],
        ),
        (
            "Siguen adentro",
            summary["still_inside"],
        ),
    ]

    summary_start_col = 1

    for index, (label, value) in enumerate(
        summary_data
    ):
        label_col = summary_start_col + (
            index * 2
        )

        value_col = label_col + 1

        label_cell = ws.cell(
            row=summary_row,
            column=label_col,
            value=label,
        )

        value_cell = ws.cell(
            row=summary_row,
            column=value_col,
            value=value,
        )

        label_cell.font = Font(
            bold=True,
            color=COLOR_BLANCO,
            size=9,
        )

        label_cell.fill = PatternFill(
            start_color=COLOR_VERDE,
            end_color=COLOR_VERDE,
            fill_type="solid",
        )

        value_cell.font = Font(
            bold=True,
            color=COLOR_VERDE_OSCURO,
            size=10,
        )

        value_cell.fill = PatternFill(
            start_color=COLOR_VERDE_CLARO,
            end_color=COLOR_VERDE_CLARO,
            fill_type="solid",
        )

        label_cell.alignment = Alignment(
            horizontal="center",
            vertical="center",
        )

        value_cell.alignment = Alignment(
            horizontal="center",
            vertical="center",
        )

    # ========================================================
    # ENCABEZADOS DE TABLA
    # ========================================================

    header_row = 7

    header_fill = PatternFill(
        start_color=COLOR_VERDE,
        end_color=COLOR_VERDE,
        fill_type="solid",
    )

    header_font = Font(
        bold=True,
        color=COLOR_BLANCO,
    )

    thin_border = Border(
        left=Side(
            style="thin",
            color=COLOR_GRIS_BORDE,
        ),
        right=Side(
            style="thin",
            color=COLOR_GRIS_BORDE,
        ),
        top=Side(
            style="thin",
            color=COLOR_GRIS_BORDE,
        ),
        bottom=Side(
            style="thin",
            color=COLOR_GRIS_BORDE,
        ),
    )

    for col, header in enumerate(
        HEADERS,
        start=1,
    ):
        cell = ws.cell(
            row=header_row,
            column=col,
            value=header,
        )

        cell.font = header_font
        cell.fill = header_fill
        cell.border = thin_border

        cell.alignment = Alignment(
            horizontal="center",
            vertical="center",
        )

    # ========================================================
    # DATOS
    # ========================================================

    for row_index, row in enumerate(
        rows,
        start=header_row + 1,
    ):
        entrada = row["entrada"]
        salida = row["salida"]

        if salida:
            salida_value = _format_marking(
                salida
            )

        elif entrada:
            salida_value = "Sigue adentro"

        else:
            salida_value = "—"

        observacion = (
            row["notes"]
            or "Sin observación"
        )

        values = [
            row["employee"],
            row["document"],
            row["department"],
            row["sede"],
            row["date"],
            _format_marking(entrada),
            salida_value,
            observacion,
        ]

        for col, value in enumerate(
            values,
            start=1,
        ):
            cell = ws.cell(
                row=row_index,
                column=col,
                value=value,
            )

            cell.border = thin_border

            cell.alignment = Alignment(
                horizontal="center",
                vertical="center",
                wrap_text=True,
            )

        # Fecha
        ws.cell(
            row=row_index,
            column=5,
        ).number_format = "dd/mm/yyyy"

        # Columna Entrada
        entrada_cell = ws.cell(
            row=row_index,
            column=6,
        )

        if entrada:
            entrada_cell.fill = PatternFill(
                start_color=COLOR_NARANJA_CLARO,
                end_color=COLOR_NARANJA_CLARO,
                fill_type="solid",
            )

            entrada_cell.font = Font(
                bold=True,
                color=COLOR_NARANJA,
            )

        # Columna Salida
        salida_cell = ws.cell(
            row=row_index,
            column=7,
        )

        if salida:
            salida_cell.fill = PatternFill(
                start_color=COLOR_VERDE_CLARO,
                end_color=COLOR_VERDE_CLARO,
                fill_type="solid",
            )

            salida_cell.font = Font(
                bold=True,
                color=COLOR_VERDE_OSCURO,
            )

        elif entrada:
            salida_cell.fill = PatternFill(
                start_color="FFF4E8",
                end_color="FFF4E8",
                fill_type="solid",
            )

            salida_cell.font = Font(
                bold=True,
                color=COLOR_NARANJA,
            )

        ws.row_dimensions[row_index].height = 38

    # ========================================================
    # ANCHOS
    # ========================================================

    column_widths = {
        "A": 28,
        "B": 18,
        "C": 24,
        "D": 13,
        "E": 14,
        "F": 31,
        "G": 31,
        "H": 38,
    }

    for column, width in column_widths.items():
        ws.column_dimensions[
            column
        ].width = width

    # ========================================================
    # AJUSTES
    # ========================================================

    ws.row_dimensions[1].height = 30
    ws.row_dimensions[2].height = 22
    ws.row_dimensions[3].height = 22
    ws.row_dimensions[5].height = 24
    ws.row_dimensions[7].height = 25

    ws.freeze_panes = "A8"

    if rows:
        last_row = (
            header_row + len(rows)
        )

        ws.auto_filter.ref = (
            f"A{header_row}:"
            f"{last_column}{last_row}"
        )

    # ========================================================
    # GENERAR ARCHIVO
    # ========================================================

    buffer = io.BytesIO()

    wb.save(buffer)

    return buffer.getvalue()


# ============================================================
# PDF
# ============================================================

def build_monthly_pdf(
    logs,
    year: int,
    month: int,
    sede="",
    day="",
) -> bytes:
    """
    Genera el PDF mensual agrupado por empleado y día.
    """

    rows = _build_monthly_rows(logs)
    summary = _get_summary(rows)

    sede_text, day_text = _get_filter_text(
        sede,
        day,
    )

    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        topMargin=1.0 * cm,
        bottomMargin=1.2 * cm,
        leftMargin=1.2 * cm,
        rightMargin=1.2 * cm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "BitacoraTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        alignment=1,
        textColor=colors.HexColor(
            f"#{COLOR_VERDE_OSCURO}"
        ),
        spaceAfter=3,
    )

    subtitle_style = ParagraphStyle(
        "BitacoraSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        alignment=1,
        textColor=colors.HexColor(
            f"#{COLOR_NARANJA}"
        ),
    )

    filter_style = ParagraphStyle(
        "BitacoraFilter",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        alignment=1,
        textColor=colors.HexColor(
            f"#{COLOR_GRIS_TEXTO}"
        ),
    )

    cell_style = ParagraphStyle(
        "BitacoraCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=6.8,
        leading=8,
        alignment=1,
    )

    cell_left_style = ParagraphStyle(
        "BitacoraCellLeft",
        parent=cell_style,
        alignment=0,
    )

    header_style = ParagraphStyle(
        "BitacoraHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=8,
        textColor=colors.white,
        alignment=1,
    )

    # ========================================================
    # ENCABEZADO CON LOGO
    # ========================================================

    header_elements = []

    if LOGO_PATH.exists():
        logo = ReportLabImage(
            str(LOGO_PATH),
            width=2.6 * cm,
            height=2.6 * cm,
        )

        title_block = [
            Paragraph(
                "BITÁCORA DE ENTRADA Y SALIDA "
                "DE PERSONAL",
                title_style,
            ),
            Paragraph(
                f"{MESES_ES[month]} {year}",
                subtitle_style,
            ),
            Spacer(1, 3),
            Paragraph(
                f"Sede: {sede_text} &nbsp;&nbsp;|&nbsp;&nbsp; "
                f"Fecha: {day_text}",
                filter_style,
            ),
        ]

        header_table = Table(
            [
                [
                    logo,
                    title_block,
                ]
            ],
            colWidths=[
                3.5 * cm,
                21.7 * cm,
            ],
        )

        header_table.setStyle(
            TableStyle(
                [
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "MIDDLE",
                    ),
                    (
                        "ALIGN",
                        (0, 0),
                        (0, 0),
                        "CENTER",
                    ),
                    (
                        "LEFTPADDING",
                        (0, 0),
                        (-1, -1),
                        2,
                    ),
                    (
                        "RIGHTPADDING",
                        (0, 0),
                        (-1, -1),
                        2,
                    ),
                    (
                        "TOPPADDING",
                        (0, 0),
                        (-1, -1),
                        2,
                    ),
                    (
                        "BOTTOMPADDING",
                        (0, 0),
                        (-1, -1),
                        2,
                    ),
                ]
            )
        )

        header_elements.append(
            header_table
        )

    else:
        header_elements.extend(
            [
                Paragraph(
                    "BITÁCORA DE ENTRADA Y SALIDA "
                    "DE PERSONAL",
                    title_style,
                ),
                Paragraph(
                    f"{MESES_ES[month]} {year}",
                    subtitle_style,
                ),
                Paragraph(
                    f"Sede: {sede_text} &nbsp;&nbsp;|&nbsp;&nbsp; "
                    f"Fecha: {day_text}",
                    filter_style,
                ),
            ]
        )

    elements = header_elements

    elements.append(
        Spacer(1, 8)
    )

    # ========================================================
    # RESUMEN PDF
    # ========================================================

    summary_data = [
        [
            Paragraph(
                "Registros",
                header_style,
            ),
            Paragraph(
                "Empleados",
                header_style,
            ),
            Paragraph(
                "Entradas",
                header_style,
            ),
            Paragraph(
                "Salidas",
                header_style,
            ),
            Paragraph(
                "Siguen adentro",
                header_style,
            ),
        ],
        [
            str(summary["rows"]),
            str(summary["employees"]),
            str(summary["entries"]),
            str(summary["exits"]),
            str(summary["still_inside"]),
        ],
    ]

    summary_table = Table(
        summary_data,
        colWidths=[
            4.5 * cm,
            4.5 * cm,
            4.5 * cm,
            4.5 * cm,
            4.5 * cm,
        ],
    )

    summary_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor(
                        f"#{COLOR_VERDE}"
                    ),
                ),
                (
                    "BACKGROUND",
                    (0, 1),
                    (-1, 1),
                    colors.HexColor(
                        f"#{COLOR_VERDE_CLARO}"
                    ),
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, 0),
                    colors.white,
                ),
                (
                    "TEXTCOLOR",
                    (0, 1),
                    (-1, 1),
                    colors.HexColor(
                        f"#{COLOR_VERDE_OSCURO}"
                    ),
                ),
                (
                    "FONTNAME",
                    (0, 1),
                    (-1, 1),
                    "Helvetica-Bold",
                ),
                (
                    "FONTSIZE",
                    (0, 1),
                    (-1, 1),
                    9,
                ),
                (
                    "ALIGN",
                    (0, 0),
                    (-1, -1),
                    "CENTER",
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.HexColor(
                        f"#{COLOR_GRIS_BORDE}"
                    ),
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.3,
                    colors.HexColor(
                        f"#{COLOR_GRIS_BORDE}"
                    ),
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    4,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    4,
                ),
            ]
        )
    )

    elements.append(
        summary_table
    )

    elements.append(
        Spacer(1, 8)
    )

    # ========================================================
    # TABLA PRINCIPAL
    # ========================================================

    data = [
        [
            Paragraph(
                header,
                header_style,
            )
            for header in HEADERS
        ]
    ]

    for row in rows:
        entrada = row["entrada"]
        salida = row["salida"]

        if salida:
            salida_value = _format_marking(
                salida
            )

        elif entrada:
            salida_value = "Sigue adentro"

        else:
            salida_value = "—"

        observacion = (
            row["notes"]
            or "Sin observación"
        )

        entrada_value = _format_marking(
            entrada
        )

        data.append(
            [
                Paragraph(
                    str(row["employee"]),
                    cell_left_style,
                ),
                Paragraph(
                    str(row["document"]),
                    cell_style,
                ),
                Paragraph(
                    str(row["department"]),
                    cell_left_style,
                ),
                Paragraph(
                    str(row["sede"]),
                    cell_style,
                ),
                Paragraph(
                    row["date"].strftime(
                        "%d/%m/%Y"
                    ),
                    cell_style,
                ),
                Paragraph(
                    entrada_value.replace(
                        "\n",
                        "<br/>",
                    ),
                    cell_style,
                ),
                Paragraph(
                    str(salida_value).replace(
                        "\n",
                        "<br/>",
                    ),
                    cell_style,
                ),
                Paragraph(
                    str(observacion),
                    cell_left_style,
                ),
            ]
        )

    col_widths = [
        4.0 * cm,   # Empleado
        2.5 * cm,   # Documento
        3.2 * cm,   # Área
        1.8 * cm,   # Sede
        2.2 * cm,   # Fecha
        3.5 * cm,   # Entrada
        3.5 * cm,   # Salida
        4.5 * cm,   # Observación
    ]

    table = Table(
        data,
        colWidths=col_widths,
        repeatRows=1,
    )

    table_style_commands = [
        (
            "BACKGROUND",
            (0, 0),
            (-1, 0),
            colors.HexColor(
                f"#{COLOR_VERDE}"
            ),
        ),
        (
            "TEXTCOLOR",
            (0, 0),
            (-1, 0),
            colors.white,
        ),
        (
            "VALIGN",
            (0, 0),
            (-1, -1),
            "MIDDLE",
        ),
        (
            "GRID",
            (0, 0),
            (-1, -1),
            0.4,
            colors.HexColor(
                f"#{COLOR_GRIS_BORDE}"
            ),
        ),
        (
            "ROWBACKGROUNDS",
            (0, 1),
            (-1, -1),
            [
                colors.white,
                colors.HexColor(
                    f"#{COLOR_GRIS_FONDO}"
                ),
            ],
        ),
        (
            "LEFTPADDING",
            (0, 0),
            (-1, -1),
            4,
        ),
        (
            "RIGHTPADDING",
            (0, 0),
            (-1, -1),
            4,
        ),
        (
            "TOPPADDING",
            (0, 0),
            (-1, -1),
            4,
        ),
        (
            "BOTTOMPADDING",
            (0, 0),
            (-1, -1),
            4,
        ),
    ]

    # ========================================================
    # COLORES DE ENTRADA / SALIDA
    # ========================================================

    for row_index, row in enumerate(
        rows,
        start=1,
    ):
        if row["entrada"]:
            table_style_commands.extend(
                [
                    (
                        "BACKGROUND",
                        (5, row_index),
                        (5, row_index),
                        colors.HexColor(
                            f"#{COLOR_NARANJA_CLARO}"
                        ),
                    ),
                    (
                        "TEXTCOLOR",
                        (5, row_index),
                        (5, row_index),
                        colors.HexColor(
                            f"#{COLOR_NARANJA}"
                        ),
                    ),
                ]
            )

        if row["salida"]:
            table_style_commands.extend(
                [
                    (
                        "BACKGROUND",
                        (6, row_index),
                        (6, row_index),
                        colors.HexColor(
                            f"#{COLOR_VERDE_CLARO}"
                        ),
                    ),
                    (
                        "TEXTCOLOR",
                        (6, row_index),
                        (6, row_index),
                        colors.HexColor(
                            f"#{COLOR_VERDE_OSCURO}"
                        ),
                    ),
                ]
            )

        elif row["entrada"]:
            table_style_commands.extend(
                [
                    (
                        "BACKGROUND",
                        (6, row_index),
                        (6, row_index),
                        colors.HexColor(
                            "#FFF4E8"
                        ),
                    ),
                    (
                        "TEXTCOLOR",
                        (6, row_index),
                        (6, row_index),
                        colors.HexColor(
                            f"#{COLOR_NARANJA}"
                        ),
                    ),
                ]
            )

    table.setStyle(
        TableStyle(
            table_style_commands
        )
    )

    elements.append(table)

    elements.append(
        Spacer(1, 6)
    )

    # ========================================================
    # PIE DEL REPORTE
    # ========================================================

    generated_at = timezone.localtime().strftime(
        "%d/%m/%Y %H:%M"
    )

    footer_style = ParagraphStyle(
        "BitacoraFooter",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=6.5,
        leading=8,
        alignment=1,
        textColor=colors.HexColor(
            f"#{COLOR_GRIS_TEXTO}"
        ),
    )

    elements.append(
        Paragraph(
            (
                "Reporte generado por Bitácora de Entrada "
                "y Salida de Personal · "
                f"Generado el {generated_at}"
            ),
            footer_style,
        )
    )

    # ========================================================
    # GENERAR PDF
    # ========================================================

    doc.build(elements)

    return buffer.getvalue()