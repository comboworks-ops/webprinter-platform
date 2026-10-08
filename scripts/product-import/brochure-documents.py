#!/usr/bin/env python3
"""Exact supplier geometry -> clean vector non-printing page guides. No DB writes."""
import hashlib, json, re, subprocess, io
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, ArrayObject, TextStringObject, RectangleObject
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth

ROOT = Path('output/brochure-2026-10-06')
representatives = json.loads((ROOT / 'format-representatives.json').read_text())
result = []
for key, article in representatives.items():
    width, height = article['widthMm'], article['heightMm']
    sources = article['pdfs']
    if len(sources) != 1: raise ValueError(f'Ambiguous supplier guide {key}')
    source = ROOT / 'documents/source' / f'{key}.pdf'
    source.parent.mkdir(parents=True, exist_ok=True)
    if not source.exists():
        subprocess.run(['curl','--fail','--silent','--show-error','--location',sources[0],'--output',str(source)],check=True)
    pdf = PdfReader(source)
    text = pdf.pages[0].extract_text()
    bleed_match = re.search(r'(\d+(?:[.,]\d+)?)\s*mm\s*Beschnitt', text)
    safe_match = re.search(r'Sicherheitsabstand:\s*(\d+(?:[.,]\d+)?)\s*mm',text)
    if not bleed_match or not safe_match: raise ValueError(f'Unverified margins {key}')
    bleed = float(bleed_match[1].replace(',','.')); safe = float(safe_match[1].replace(',','.'))
    pt = 72 / 25.4
    page_w, page_h = float(pdf.pages[0].mediabox.width), float(pdf.pages[0].mediabox.height)
    media_conflict = abs(page_w/pt-width-2*bleed)>.15 or abs(page_h/pt-height-2*bleed)>.15
    if media_conflict:
        printed = re.search(r'Datenformat:\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*mm',text)
        if not printed or abs(float(printed[1].replace(',','.'))-width-2*bleed)>.01 or abs(float(printed[2].replace(',','.'))-height-2*bleed)>.01: raise ValueError(f'Supplier dimensions mismatch {key}')
        print(f'Source MediaBox conflict {key}; using corroborated printed data-format specification',flush=True)
        page_w,page_h=(width+2*bleed)*pt,(height+2*bleed)*pt
    # Use the source MediaBox, or its corroborated printed specification when
    # the source's own box conflicts. Helpers never enter production output.
    stream = io.BytesIO(); draw = canvas.Canvas(stream, pagesize=(page_w,page_h))
    draw.setStrokeColorRGB(.90,.08,.52); draw.setLineWidth(.45)
    draw.rect(bleed*pt,bleed*pt,width*pt,height*pt,fill=0,stroke=1)
    draw.setStrokeColorRGB(.145,.39,.92); draw.setDash(3,2); draw.rect((bleed+safe)*pt,(bleed+safe)*pt,(width-2*safe)*pt,(height-2*safe)*pt,fill=0,stroke=1)
    draw.setDash(); draw.setStrokeColorRGB(.59,.75,.85); draw.rect(.3,.3,page_w-.6,page_h-.6,fill=0,stroke=1)
    draw.setFillColorRGB(.29,.57,.76)
    # Two fitted legend lines remain inside the bottom bleed margin, including
    # A8. The overlay is visible on screen but non-printing and export-excluded.
    legend = [f'Webprinter | {width} x {height} mm | {bleed:g} mm udfald', 'Lys blå: data | Magenta: snit | Stiplet blå: sikkerhedszone']
    for index, line in enumerate(legend):
        font_size = min(3.2, (page_w-2*bleed*pt)/stringWidth(line,'Helvetica',1))
        draw.setFont('Helvetica',font_size)
        baseline = .8 + (1-index)*3.6
        if baseline+font_size > bleed*pt or stringWidth(line,'Helvetica',font_size)>page_w-2*bleed*pt+.01: raise ValueError(f'Legend overflow {key}')
        draw.drawString(bleed*pt,baseline,line)
    draw.showPage(); draw.save()
    writer = PdfWriter(); writer.add_page(PdfReader(io.BytesIO(stream.getvalue())).pages[0])
    layer = DictionaryObject({NameObject('/Type'):NameObject('/OCG'),NameObject('/Name'):TextStringObject('Webprinter teknisk vejledning'),
        NameObject('/Usage'):DictionaryObject({NameObject('/Print'):DictionaryObject({NameObject('/PrintState'):NameObject('/OFF')}),NameObject('/Export'):DictionaryObject({NameObject('/ExportState'):NameObject('/OFF')})})})
    layer_ref = writer._add_object(layer)
    page = writer.pages[0]; resource = page['/Resources']
    resource[NameObject('/Properties')] = DictionaryObject({NameObject('/WPGuide'):layer_ref})
    from pypdf.generic import DecodedStreamObject
    content = DecodedStreamObject(); content.set_data(b'/OC /WPGuide BDC\n'+page.get_contents().get_data()+b'\nEMC\n')
    page[NameObject('/Contents')] = writer._add_object(content)
    writer._root_object[NameObject('/OCProperties')] = DictionaryObject({NameObject('/OCGs'):ArrayObject([layer_ref]),NameObject('/D'):DictionaryObject({NameObject('/ON'):ArrayObject([layer_ref]),NameObject('/Order'):ArrayObject([layer_ref]),NameObject('/AS'):ArrayObject([DictionaryObject({NameObject('/Event'):NameObject('/Print'),NameObject('/Category'):ArrayObject([NameObject('/Print')]),NameObject('/OCGs'):ArrayObject([layer_ref])}),DictionaryObject({NameObject('/Event'):NameObject('/Export'),NameObject('/Category'):ArrayObject([NameObject('/Export')]),NameObject('/OCGs'):ArrayObject([layer_ref])})])})})
    page.trimbox = RectangleObject([bleed*pt,bleed*pt,(bleed+width)*pt,(bleed+height)*pt])
    writer.add_metadata({'/Title':f'Webprinter brochure {width} x {height} mm','/Creator':'Webprinter','/Producer':'Webprinter'})
    target = Path('public/brochure/templates') / f'{key}.pdf'; target.parent.mkdir(parents=True,exist_ok=True)
    with target.open('wb') as f: writer.write(f)
    reread = PdfReader(target)
    if len(reread.pages)!=1 or 'WIRmachenDRUCK' in (reread.pages[0].extract_text() or ''): raise ValueError('Guide sanitation failed')
    result.append({'key':key,'widthMm':width,'heightMm':height,'bleedMm':bleed,'safeMm':safe,'sourceUrl':sources[0],'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'templateUrl':'/brochure/templates/'+target.name,'templatePdfSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'nonPrintingOverlay':True,'sourcePageCount':len(pdf.pages),'factsReviewed':True,'sourceMediaBoxConflict':media_conflict,'geometryBasis':'printed_data_format' if media_conflict else 'source_media_box'})
    print(f'Verified page guide {key}',flush=True)
(ROOT/'documents/templates.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
