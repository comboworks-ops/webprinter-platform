"""Independent certificate check using Fraction.from_float, exact rectangle
coverage and integer gap checks. No normal/chord-bound validity is inferred;
018/019 analytic enclosures are inherited assumptions, not reconstructed here.
No geometric contact is inferred from overlapping enclosing rectangles.
"""
import hashlib
import json
from fractions import Fraction
from pathlib import Path

BASE = Path('output/qa/roll-labels-2026-10-06')
TARGET = BASE / 'contact-geometry-023'


def read(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def integer(value, exponent):
    v = Fraction.from_float(value) / Fraction(2) ** exponent
    assert v.denominator == 1, 'Nonintegral common scale'
    return v.numerator


def boxes(branch, exponent):
    result = []
    for chord in branch['chords']:
        r = integer(chord['maxErrorMm'], exponent)
        a, b = [tuple(integer(v, exponent) for v in chord[k]) for k in ('start', 'end')]
        result.append((min(a[0], b[0]) - r, max(a[0], b[0]) + r,
                       min(a[1], b[1]) - r, max(a[1], b[1]) + r))
    return result


def hull(values, first, last):
    assert 0 <= first < last <= len(values)
    selected = values[first:last]
    return (min(v[0] for v in selected), max(v[1] for v in selected),
            min(v[2] for v in selected), max(v[3] for v in selected))


def certificate(a, b, leaves):
    assert leaves
    # Exact sweep of half-open INDEX rectangles, a different coverage algorithm
    # from the producer's binary tree. At each A slab, B ranges partition [0,m).
    cuts = {0, len(a)}
    for first_a, last_a, first_b, last_b, axis, direction, gap in leaves:
        assert axis in (0, 1) and direction in (-1, 1)
        aa, bb = hull(a, first_a, last_a), hull(b, first_b, last_b)
        k = axis * 2
        actual = bb[k] - aa[k + 1] if direction == 1 else aa[k] - bb[k + 1]
        assert actual > 0 and actual == int(gap), 'Invalid exact separation gap'
        cuts.update((first_a, last_a))
    ordered = sorted(cuts)
    for lo, hi in zip(ordered, ordered[1:]):
        intervals = sorted((l[2], l[3]) for l in leaves if l[0] <= lo and hi <= l[1])
        end = 0
        for first, last in intervals:
            assert first == end and first < last, 'Gap or duplicate in certificate coverage'
            end = last
        assert end == len(b), 'Incomplete Cartesian coverage'


def self_tests():
    a, b = [(0, 1, 0, 1), (0, 1, 2, 3)], [(4, 5, 0, 3)]
    valid = [[0, 2, 0, 1, 0, 1, '3']]
    certificate(a, b, valid)
    certificate(a, b, [[0, 1, 0, 1, 0, 1, '3'], [1, 2, 0, 1, 0, 1, '3']])
    for invalid in [[], [[0, 2, 0, 1, 0, 1, '4']],
                    [[0, 1, 0, 1, 0, 1, '3']], valid + valid,
                    [[0, 2, 0, 1, 1, 1, '1']]]:
        try:
            certificate(a, b, invalid)
        except AssertionError:
            pass
        else:
            raise AssertionError('Corrupt certificate was accepted')
    assert integer(float.fromhex('0x0.0000000000001p-1022'), -1074) == 1
    return 8


def main():
    packet_path = TARGET / 'contact-geometry.json'
    initial_hash = digest(packet_path)
    packet = read(packet_path)
    for path, expected in packet['inputHashes'].items():
        assert digest(Path(path)) == expected, path
    old = read(BASE / 'bounded-geometry-018/bounded-geometry.json')
    new = read(BASE / 'endpoint-geometry-019/endpoint-geometry.json')
    indexed = {c['key']: c for c in new['cases']}
    cases = {c['key']: c for c in packet['cases']}
    assert len(cases) == len(old['cases']) == 135
    verified = dict(sideCases=0, allNativeBranchPairs=0, disjointPairs=0,
                    unresolvedEnvelopePairs=0, unconstructedPairs=0, separationLeaves=0)
    for native in old['cases']:
        current, extra = cases[native['key']], indexed[native['key']]
        for k in ('articleId', 'widthMm', 'heightMm', 'sourceShapeSha256'):
            assert current[k] == native[k] == extra[k]
        for side in ('bleed', 'safe'):
            verified['sideCases'] += 1
            replacements = {b['segment']: b for b in extra[side]['branches']}
            branches = {b['segment']: replacements.get(b['segment'], b) for b in native[side]['branches']}
            g = current[side]
            assert g['boundValidityInherited'] is True
            for k in ('withinBranchInjectivityProved', 'joinsExamined', 'focalFragmentsExamined',
                      'retainedBoundaryAccepted', 'globalOffsetTopologyProved', 'scalingAuthorityProved',
                      'supplierJoinPolicyAccepted', 'sourceGeometryAccepted', 'designerAllowed', 'orderReady'):
                assert g[k] is False
            enclosures = {i: boxes(b, g['scale2Exponent']) for i, b in branches.items()}
            expected_pairs = {(a, b) for a in branches for b in branches if a < b}
            assert len(g['pairs']) == len(expected_pairs)
            for pair in g['pairs']:
                a, b = pair['segments']
                assert (a, b) in expected_pairs
                expected_pairs.remove((a, b))
                verified['allNativeBranchPairs'] += 1
                assert 0 <= pair['work'] <= g['maxWorkPerPair']
                if pair['status'] == 'disjoint_inherited_curve_envelopes':
                    assert branches[a]['status'] != 'refused' and branches[b]['status'] != 'refused'
                    assert pair['reason'] is None and pair['unresolvedChordRanges'] is None
                    certificate(enclosures[a], enclosures[b], pair['separationLeaves'])
                    verified['disjointPairs'] += 1
                    verified['separationLeaves'] += len(pair['separationLeaves'])
                else:
                    assert pair['status'] == 'unresolved' and not pair['separationLeaves']
                    if pair['reason'] == 'unconstructed_native_branch':
                        assert branches[a]['status'] == 'refused' or branches[b]['status'] == 'refused'
                        assert pair['work'] == 0 and pair['unresolvedChordRanges'] is None
                        verified['unconstructedPairs'] += 1
                    elif pair['reason'] == 'envelopes_overlap_contact_unresolved':
                        ranges = pair['unresolvedChordRanges']
                        assert all(last - first == 1 for first, last in ranges)
                        aa, bb = hull(enclosures[a], *ranges[0]), hull(enclosures[b], *ranges[1])
                        assert all(not (aa[k + 1] < bb[k] or bb[k + 1] < aa[k]) for k in (0, 2))
                        verified['unresolvedEnvelopePairs'] += 1
                    else:
                        raise AssertionError('Unexpected budget/exclusion result')
            assert not expected_pairs
    for k, v in verified.items():
        assert v == packet['counts'][k], k
    assert packet['inheritedProfileBindings'] == new['currentBindings']
    for k in ('sourceGeometryAccepted', 'globalOffsetTopologyProved', 'retainedBoundaryAccepted',
              'scalingAuthorityProved', 'supplierJoinPolicyAccepted', 'designerAllowed',
              'orderReady', 'fullCatalogueComplete', 'remoteWrites'):
        assert packet[k] is False
    for path, expected in packet['inputHashes'].items():
        assert digest(Path(path)) == expected
    assert digest(packet_path) == initial_hash
    report = dict(status='independent_exact_envelope_certificates_verified', packetSha256=initial_hash,
                  counts=verified, selfTestsPassed=self_tests(),
                  arithmetic='Fraction_from_float_and_exact_integer_sweep',
                  analyticChordBoundsReconstructed=False, joinsExamined=False,
                  retainedBoundaryAccepted=False, globalOffsetTopologyProved=False,
                  sourceGeometryAccepted=False, designerAllowed=False, orderReady=False,
                  fullCatalogueComplete=False, remoteWrites=False)
    with (TARGET / 'independent-verification.json').open('x') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
