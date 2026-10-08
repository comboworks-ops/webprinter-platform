#!/usr/bin/env python3
"""No-write template review from verified rectangle bleed/safety facts.

The supplier's placeholder examples are not scaled. Rectangular geometry is
reconstructed from each declared finished size. Special contours stay blocked.
"""
import hashlib
import io
import json
import html
from urllib.parse import urlencode, quote
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase.pdfmetrics import stringWidth, registerFont
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, FloatObject, NameObject, TextStringObject

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf/gulvfolie-template-review-2026-10-01'
SOURCE = ROOT / 'output/supplier-imports/wmd-gulvfolie-2026-09-30'
PT = 72 / 25.4
SHAPE_ID = '0b12150e-5a26-4c91-a152-d376729b78cf'
FONT = 'WebprinterGuide'
registerFont(TTFont(FONT, str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/fonts/DejaVuSans.ttf')))


def name(value):
    return NameObject('/' + value)


def generate(width, height):
    data_w, data_h = (width + 6) * PT, (height + 6) * PT
    stream = io.BytesIO()
    c = canvas.Canvas(stream, pagesize=(data_w, data_h), invariant=1, pageCompression=1)
    c._code.append('/OC /Geometry BDC')
    c.setLineWidth(0.65)
    c.setStrokeColor(HexColor('#374151'))
    c.rect(0.35, 0.35, data_w - 0.7, data_h - 0.7, stroke=1, fill=0)
    c.setStrokeColor(HexColor('#EC008C'))
    c.setDash(5, 3)
    c.rect(3 * PT, 3 * PT, width * PT, height * PT, stroke=1, fill=0)
    c.setDash()
    c.setStrokeColor(HexColor('#2F80ED'))
    c.rect(6 * PT, 6 * PT, (width - 6) * PT, (height - 6) * PT, stroke=1, fill=0)
    c._code.append('EMC')
    c._code.append('/OC /Information BDC')
    panel_w = min(330, data_w - 20 * PT)
    panel_h = 166
    x, y = 10 * PT, data_h - 10 * PT - panel_h
    c.setFillColor(HexColor('#0EA5E9'))
    c.setStrokeColor(HexColor('#0284C7'))
    c.rect(x, y, panel_w, panel_h, fill=1, stroke=1)
    lines = [
        ('Gulvfolie - rektangel', 14),
        (f'Færdigt format: {width} x {height} mm', 10),
        (f'Dataformat: {width + 6} x {height + 6} mm', 10),
        ('3 mm udfald og 3 mm sikkerhedsafstand.', 10),
        ('Mørkegrå: dataformat inkl. udfald.', 10),
        ('Magenta stiplet: beskæring / færdigt format.', 10),
        ('Blå: hold tekst inden for sikkerhedslinjen.', 10),
        ('Læg baggrund helt ud til dataformatets kant.', 10),
        ('Hjælpelag er slået fra ved tryk og eksport.', 10),
        ('Til gennemgang - ikke tilknyttet produktet.', 10),
    ]
    text_y = y + panel_h - 23
    checks = []
    for text, size in lines:
        # Deterministic word wrap; every actual line is measured before output.
        words, wrapped = text.split(), []
        for word in words:
            trial = ' '.join(wrapped + [word])
            if wrapped and stringWidth(trial, FONT, size) > panel_w - 24:
                line = ' '.join(wrapped)
                checks.append((line, size, text_y))
                text_y -= size + 4
                wrapped = [word]
            else:
                wrapped.append(word)
        checks.append((' '.join(wrapped), size, text_y))
        text_y -= size + 4
    assert min(v[2] for v in checks) >= y + 12, 'Legend text overflow'
    for text, size, baseline in checks:
        assert stringWidth(text, FONT, size) <= panel_w - 24
        c.setFont(FONT, size)
        c.setFillColor(HexColor('#FFFFFF'))
        c.drawString(x + 12, baseline, text)
    c._code.append('EMC')
    c.showPage()
    c.save()
    reader = PdfReader(stream)
    writer = PdfWriter()
    writer.add_page(reader.pages[0])
    writer._info = None
    page = writer.pages[0]
    groups = []
    properties = DictionaryObject()
    for key, label in [('Geometry', 'Tekniske hjælpelinjer'), ('Information', 'Webprinter information')]:
        group = DictionaryObject({name('Type'): name('OCG'), name('Name'): TextStringObject(label),
            name('Usage'): DictionaryObject({name('View'): DictionaryObject({name('ViewState'): name('ON')}),
                name('Print'): DictionaryObject({name('PrintState'): name('OFF')}),
                name('Export'): DictionaryObject({name('ExportState'): name('OFF')})})})
        ref = writer._add_object(group)
        groups.append(ref)
        properties[name(key)] = ref
    page['/Resources'][name('Properties')] = properties
    events = ArrayObject([DictionaryObject({name('Event'): name(event), name('OCGs'): ArrayObject(groups),
        name('Category'): ArrayObject([name(event)])}) for event in ['View', 'Print', 'Export']])
    writer._root_object[name('OCProperties')] = DictionaryObject({name('OCGs'): ArrayObject(groups),
        name('D'): DictionaryObject({name('Order'): ArrayObject(groups), name('ON'): ArrayObject(groups), name('AS'): events})})
    trim = ArrayObject([FloatObject(v) for v in [3 * PT, 3 * PT, (width + 3) * PT, (height + 3) * PT]])
    page[name('TrimBox')] = trim
    page[name('ArtBox')] = trim
    page[name('BleedBox')] = page.mediabox
    page[name('CropBox')] = page.mediabox
    path = OUT / f'gulvfolie-rektangel-{width}x{height}mm.pdf'
    with path.open('wb') as f:
        writer.write(f)
    checked = PdfReader(path)
    assert not checked.metadata and not checked.pages[0].images
    assert '/Metadata' not in checked.trailer['/Root'] and '/Annots' not in checked.pages[0]
    contents = checked.pages[0].get_contents().get_data()
    assert b'/Geometry BDC' in contents and b'/Information BDC' in contents and b' re' in contents
    return {'name': path.name, 'localPath': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'widthMm': width, 'heightMm': height, 'bleedMm': 3, 'safeMm': 3,
        'selectionConstraints': {'shape-section': SHAPE_ID},
        'templateConstruction': 'rectangle reconstructed from verified measurements; source example not scaled',
        'vectorGeometry': True, 'fullPageRasterImages': 0, 'metadataRemoved': True, 'textContainment': 'passed',
        'helperLayersPrintAndExport': 'OFF', 'designerTemplateId': None, 'bindingStatus': 'local_review_only'}


def main():
    source = json.loads((SOURCE / 'documents/inspection.json').read_text())
    rectangle = next(d for d in source['documents'] if 'rechteckig_2.pdf' in d['sourceUrl'])
    assert rectangle['guideFacts'] == {'bleedMm': 3, 'safeAreaMm': 3}
    source_pdf = SOURCE / rectangle['path']
    assert hashlib.sha256(source_pdf.read_bytes()).hexdigest() == rectangle['sha256']
    OUT.mkdir(parents=True, exist_ok=True)
    documents = [generate(*size) for size in [(370, 610), (800, 600), (1000, 1000)]]
    report = {'schemaVersion': 1, 'productId': '5fb73e74-2df2-4e59-a460-c3d95786059d',
        'sourceSha256': rectangle['sha256'], 'sourceUrl': rectangle['sourceUrl'], 'documents': documents,
        'writes': {'database': False, 'storage': False, 'publishing': False},
        'remaining': ['Parameterised rectangle generation for arbitrary selected dimensions needs review.',
            'Round, oval and special shapes need verified exact contour geometry and size handling.',
            'Fri form needs customer-specific cutting contour; no invented fixed contour.',
            'Public storage, exact designer_templates records and product template_files binding are pending.',
            'Storefront-to-Designer return and production export acceptance remain pending.']}
    (OUT / 'review.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    cards = []
    for document in documents:
        pdf_url = '/@fs' + quote(document['localPath'])
        launch = '/designer?' + urlencode({'templatePdfUrl': pdf_url, 'templatePdfName': document['name'],
            'templatePdfSha256': document['sha256'], 'widthMm': document['widthMm'], 'heightMm': document['heightMm'],
            'bleedMm': 3, 'safeMm': 3, 'designerMode': 'pdf_template'})
        document['localDesignerReviewUrl'] = 'http://127.0.0.1:8160' + launch
        cards.append(f'''<article><h2>{document['widthMm'] / 10:g} x {document['heightMm'] / 10:g} cm</h2>
            <p>Færdigt format {document['widthMm']} x {document['heightMm']} mm.<br>3 mm udfald og sikkerhedsafstand.</p>
            <a href="{pdf_url}" target="_blank">Download PDF til gennemgang</a>
            <a href="{html.escape(launch)}" target="_blank">Åbn i Designer til kontrol</a>
            <code>{document['sha256']}</code></article>''')
    (OUT / 'review.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'review.html').write_text('''<!doctype html><html lang="da"><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1"><title>Gulvfolie - PDF-skabeloner til gennemgang</title>
        <style>body{font:16px/1.6 system-ui;color:#102a43;background:#f5f9fc;margin:0;padding:32px}main{max-width:1100px;margin:auto}
        h1{line-height:1.2}header,article,section{background:white;border:1px solid #dae5ed;border-radius:12px;padding:24px;margin-bottom:24px}
        .status{background:#fff4d9;padding:16px;border-left:4px solid #d99b13}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
        a{display:block;color:#0369a1;margin:12px 0;min-height:44px}code{display:block;font-size:11px;overflow-wrap:anywhere}
        h2{font-size:20px;margin-top:0}li{margin:10px 0}@media(max-width:400px){body{padding:12px}header,article,section{padding:18px}}</style>
        <main><header><h1>Gulvfolie: PDF-skabeloner</h1><p class="status"><b>Lokal gennemgang.</b> Disse filer er ikke tilknyttet det publicerede produkt.</p>
        <p>Det eksisterende produkt har 0 PDF-skabeloner. Leverandørens 34 dokumenter er eksempler med XXX-mål.
        Her er tre rektangler med kontrollerede mål og danske hjælpelag. Prisberegning og udgivelse er uændret.</p></header>
        <div class="cards">''' + ''.join(cards) + '''</div><section><h2>Det mangler før alle valg er dækket</h2><ul>
        <li>Fri størrelse: en skabelon, der genereres til kundens præcise bredde og højde.</li>
        <li>Runde og særlige former: verificeret skærekontur med korrekt udfald og sikkerhedsafstand ved hvert mål.</li>
        <li>Fri form: kundens egen skærekontur; en fast eksempelkontur er ikke tilstrækkelig.</li>
        <li>Produktbindinger, Designer-retur og eksporttest gennem det faktiske produktflow.</li></ul>
        <p>Den lokale rettelse bruger storformatets valgte form og kræver et præcist størrelsesmatch. Download kan vises, når en korrekt skabelon er tilknyttet.</p>
        </section></main></html>''')
    print(json.dumps({'documents': len(documents), 'output': str(OUT), 'writes': report['writes']}))


if __name__ == '__main__':
    main()
