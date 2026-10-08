"""Verify the agent-owned unrotated brochure fixtures' actual browser exports."""
import argparse
import json
from hashlib import sha256
from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import ContentStream

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('export', type=Path)
parser.add_argument('--report', required=True, type=Path)
parser.add_argument('--width-mm', type=float, default=210)
parser.add_argument('--height-mm', type=float, default=297)
parser.add_argument('--bleed-mm', type=float, default=3)
args = parser.parse_args()
source, exported = PdfReader(args.source), PdfReader(args.export)

def profiles(reader):
    return {sha256(intent.get_object()['/DestOutputProfile'].get_object().get_data()).hexdigest()
            for intent in reader.trailer['/Root'].get('/OutputIntents', [])}

def forms(resource, seen=None):
    seen = set() if seen is None else seen
    resource = resource.get_object() if resource else {}
    for ref in resource.get('/XObject', {}).get_object().values() if resource.get('/XObject') else []:
        stream = ref.get_object()
        if id(stream) in seen:
            continue
        seen.add(id(stream))
        if str(stream.get('/Subtype')) == '/Form':
            yield stream.get_data()
            yield from forms(stream.get('/Resources'), seen)

assert len(source.pages) == len(exported.pages), 'Changed page count'
source_icc = profiles(source)
assert source_icc and source_icc == profiles(exported), 'Changed source output profile'
proof = []
for index, page in enumerate(exported.pages):
    text = page.extract_text()
    assert f'SIDE {index + 1}' in text and f'Vector artwork {index + 1}' in text, f'Reading order {index + 1}'
    original = source.pages[index].get_contents().get_data()
    # pdf-lib may surround the unmodified original painting stream with q/Q.
    assert sum(original in data for data in forms(page.get('/Resources'))) == 1, f'Original vectors {index + 1}'
    for actual, expected in [(page.mediabox.width, args.width_mm + 2 * args.bleed_mm),
                             (page.mediabox.height, args.height_mm + 2 * args.bleed_mm),
                             (page.trimbox.width, args.width_mm), (page.trimbox.height, args.height_mm)]:
        assert abs(float(actual) * 25.4 / 72 - expected) < .001, f'Page geometry {index + 1}'
    matrix = next(operands for operands, operator in ContentStream(page.get_contents(), exported).operations if operator == b'cm')
    assert max(abs(float(actual) - expected) for actual, expected in zip(matrix[:4], [1, 0, 0, 1])) < .00001, f'Unwanted artwork scaling {index + 1}: {matrix}'
    # PDF-number serialization introduces nanometre translations, not scaling.
    assert max(abs(float(actual)) for actual in matrix[4:]) < .0001, f'Artwork translation {index + 1}: {matrix}'
    proof.append({'page': index + 1, 'originalPaintingBytesPreserved': True, 'placementMatrix': [float(n) for n in matrix]})
result = {'pages': len(exported.pages), 'bytes': args.export.stat().st_size, 'readingOrder': True,
          'exactMediaTrim': True, 'sourceOutputIccSha256': sorted(source_icc), 'originalVectorPlacementScale': 1,
          'allSourcePaintingBytesRetained': True, 'pagesVerified': proof}
args.report.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: value for key, value in result.items() if key != 'pagesVerified'}))
