from pathlib import Path
import sys

from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
from reportlab.lib.colors import CMYKColorSep
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


PAGE_WIDTH_MM = 204
PAGE_HEIGHT_MM = 216
BLEED_MM = 3
TRIM_WIDTH_MM = 198
TRIM_HEIGHT_MM = 210
SAFE_OFFSET_FROM_DATA_EDGE_MM = 6
FOLD_POSITION_MM = 102

TRIM_GUIDE = CMYKColorSep(0, 1, 0, 0, spotName="TemplateTrim")
FOLD_GUIDE = CMYKColorSep(0, 1, 0, 0, spotName="TemplateFold")
SAFE_GUIDE = CMYKColorSep(1, 0.45, 0, 0, spotName="TemplateSafe")


def draw_page(pdf: canvas.Canvas, bookmark: str) -> None:
    page_width = PAGE_WIDTH_MM * mm
    page_height = PAGE_HEIGHT_MM * mm

    pdf.bookmarkPage(bookmark)
    pdf.addOutlineEntry(bookmark, bookmark)
    pdf.setStrokeOverprint(True)
    pdf.setFillOverprint(True)
    pdf.setOverprintMask(True)

    pdf.setStrokeColor(TRIM_GUIDE)
    pdf.setLineWidth(0.35)
    pdf.setDash(3, 3)
    pdf.rect(
        BLEED_MM * mm,
        BLEED_MM * mm,
        TRIM_WIDTH_MM * mm,
        TRIM_HEIGHT_MM * mm,
        stroke=1,
        fill=0,
    )

    pdf.setStrokeColor(SAFE_GUIDE)
    pdf.setLineWidth(0.3)
    pdf.setDash()
    safe_offset = SAFE_OFFSET_FROM_DATA_EDGE_MM * mm
    pdf.rect(
        safe_offset,
        safe_offset,
        page_width - 2 * safe_offset,
        page_height - 2 * safe_offset,
        stroke=1,
        fill=0,
    )

    pdf.setStrokeColor(FOLD_GUIDE)
    pdf.setLineWidth(0.35)
    pdf.setDash(4, 3)
    fold_x = FOLD_POSITION_MM * mm
    pdf.line(fold_x, 0, fold_x, page_height)
    pdf.showPage()


def set_production_boxes(pdf_path: Path) -> None:
    reader = PdfReader(pdf_path)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    writer.pdf_header = "%PDF-1.5"

    media_box = RectangleObject([0, 0, PAGE_WIDTH_MM * mm, PAGE_HEIGHT_MM * mm])
    trim_box = RectangleObject(
        [
            BLEED_MM * mm,
            BLEED_MM * mm,
            (BLEED_MM + TRIM_WIDTH_MM) * mm,
            (BLEED_MM + TRIM_HEIGHT_MM) * mm,
        ]
    )
    safe_box = RectangleObject(
        [
            SAFE_OFFSET_FROM_DATA_EDGE_MM * mm,
            SAFE_OFFSET_FROM_DATA_EDGE_MM * mm,
            (PAGE_WIDTH_MM - SAFE_OFFSET_FROM_DATA_EDGE_MM) * mm,
            (PAGE_HEIGHT_MM - SAFE_OFFSET_FROM_DATA_EDGE_MM) * mm,
        ]
    )

    for page in writer.pages:
        page.mediabox = media_box
        page.cropbox = media_box
        page.bleedbox = media_box
        page.trimbox = trim_box
        page.artbox = safe_box

    writer.add_metadata(
        {
            "/Title": "DIN Lang folder - 4 sider - midterfalset",
            "/Subject": "Ren linjeskabelon med 3 mm beskæring og midterfals",
            "/Keywords": "DIN Lang, folder, 4 sider, midterfalset, 204 x 216 mm",
            "/Author": "Webprinter Craft",
            "/Creator": "Webprinter Craft",
            "/Producer": "Webprinter Craft PDF template generator",
        }
    )

    with pdf_path.open("wb") as output_stream:
        writer.write(output_stream)


def build(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(
        str(output_path),
        pagesize=(PAGE_WIDTH_MM * mm, PAGE_HEIGHT_MM * mm),
        pageCompression=1,
        pdfVersion=(1, 5),
    )
    pdf.setTitle("DIN Lang folder - 4 sider - midterfalset")
    pdf.setSubject("Ren vektorskabelon uden leverandørgrafik")
    pdf.setAuthor("Webprinter Craft")
    pdf.setCreator("Webprinter Craft")

    draw_page(pdf, "Yderside")
    draw_page(pdf, "Inderside")
    pdf.save()
    set_production_boxes(output_path)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: build-din-lang-4pp-midterfalset-template.py OUTPUT.pdf")
    build(Path(sys.argv[1]))
