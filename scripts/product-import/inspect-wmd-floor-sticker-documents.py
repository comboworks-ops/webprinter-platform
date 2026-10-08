#!/usr/bin/env python3
"""Inspect supplier examples; never promote placeholder geometry to exact templates."""
import argparse,json,re
from pathlib import Path
from pypdf import PdfReader

parser=argparse.ArgumentParser();parser.add_argument('--run',default='output/supplier-imports/wmd-gulvfolie-2026-09-30');args=parser.parse_args();root=Path(args.run)
source=json.loads((root/'raw/pricing-source.json').read_text()); results=[]
for binding in source['documents']:
    reader=PdfReader(root/binding['path'])
    text='\n'.join(page.extract_text() or '' for page in reader.pages)
    placeholder=bool(re.search(r'XXX|Beispiel(?:vorlage|\s+(?:Höhe|Breite))',text,re.I))
    bleed=bool(re.search(r'3\s*mm\s*Beschnitt',text))
    safe=bool(re.search(r'Sicherheitsabstand:\s*3\s*mm',text))
    results.append({**binding,'pageCount':len(reader.pages),'pageBoxesPt':[[float(v) for v in page.mediabox] for page in reader.pages],
                    'isExampleWithPlaceholderDimensions':placeholder,'exactDesignerBindingAllowed':False,
                    'guideFacts':{'bleedMm':3 if bleed else None,'safeAreaMm':3 if safe else None},
                    'text':text,'blocker':'Placeholder dimensions: requires an exact size-specific template' if placeholder else 'Production geometry requires review'})
report={'schemaVersion':1,'sourceDocumentBindings':len(results),'uniquePdfCount':len(set(x['sha256'] for x in results)),
        'exampleBindingCount':sum(x['isExampleWithPlaceholderDimensions'] for x in results),'exactTemplates':0,
        'missingDocumentPages':[page['url'] for page in source['pages'] if not page['documentUrls']], 'documents':results}
(root/'documents/inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({key:value for key,value in report.items() if key!='documents'},ensure_ascii=False))
