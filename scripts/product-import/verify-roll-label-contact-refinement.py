"""Independent Fraction readback of025 certificates and full023 pair coverage.
No interval-bound reconstruction, actual contact, join or retained-loop proof.
"""
import copy
import hashlib
import json
import pathlib
import sys
from collections import defaultdict
from fractions import Fraction as F

BASE = pathlib.Path('output/qa/roll-labels-2026-10-06')
TARGET = BASE / 'contact-refinement-025'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def chord_box(chord):
    r = F(chord['maxErrorMm'])
    a, b = chord['start'], chord['end']
    return [min(F(a[0]), F(b[0])) - r, max(F(a[0]), F(b[0])) + r,
            min(F(a[1]), F(b[1])) - r, max(F(a[1]), F(b[1])) + r]


def hull(chords, first, last):
    assert 0 <= first < last <= len(chords)
    boxes = [chord_box(c) for c in chords[first:last]]
    return [min(b[0] for b in boxes), max(b[1] for b in boxes),
            min(b[2] for b in boxes), max(b[3] for b in boxes)]


def exact_cover(rectangles, width, height):
    events = defaultdict(list)
    for index, (a0, a1, b0, b1) in enumerate(rectangles):
        assert 0 <= a0 < a1 <= width and 0 <= b0 < b1 <= height
        events[a0].append((index, (b0, b1)))
        events[a1].append((index, None))
    assert events and min(events) == 0 and max(events) == width
    active, prior = {}, 0
    for x in sorted(events):
        if x > prior:
            end = 0
            for lo, hi in sorted(active.values()):
                assert lo == end, 'Duplicate or missing Cartesian coverage'
                end = hi
            assert end == height, 'Incomplete Cartesian coverage'
        for index, interval in events[x]:
            if interval is None:
                assert index in active
                del active[index]
            else:
                assert index not in active
                active[index] = interval
        prior = x
    assert not active


def verify_leaves(a, b, leaves, exponent):
    scale = F(2) ** exponent
    rectangles = []
    for leaf in leaves:
        if leaf[0] == 'box':
            assert len(leaf) == 8
            _, a0, a1, b0, b1, axis, direction, integer_gap = leaf
            assert axis in (0, 1) and direction in (-1, 1)
            aa, bb = hull(a, a0, a1), hull(b, b0, b1)
            k = axis * 2
            gap = bb[k] - aa[k + 1] if direction == 1 else aa[k] - bb[k + 1]
            assert gap > 0 and gap == int(integer_gap) * scale
            rectangles.append((a0, a1, b0, b1))
        else:
            assert leaf[0] == 'tube' and len(leaf) == 7
            _, i, j, nx, ny, integer_gap, integer_radius = leaf
            assert 0 <= i < len(a) and 0 <= j < len(b)
            nx, ny = int(nx), int(ny)
            assert nx != 0 or ny != 0
            project = lambda p: nx * F(p[0]) + ny * F(p[1])
            aa = [project(a[i][key]) for key in ('start', 'end')]
            bb = [project(b[j][key]) for key in ('start', 'end')]
            gap = min(bb) - max(aa)
            radius = F(a[i]['maxErrorMm']) + F(b[j]['maxErrorMm'])
            assert gap == int(integer_gap) * scale and gap > 0
            assert radius == int(integer_radius) * scale and radius > 0
            assert gap * gap > radius * radius * (nx * nx + ny * ny), 'Not strictly separated'
            rectangles.append((i, i + 1, j, j + 1))
    exact_cover(rectangles, len(a), len(b))


def self_tests():
    # Point tubes have overlapping coordinate boxes but an exact diagonal gap.
    c = lambda x, y: {'start': [x, y], 'end': [x, y], 'maxErrorMm': 1 / 64}
    a, b = [c(0, 0)], [c(1 / 32, 1 / 32)]
    valid = [['tube', 0, 0, '2', '2', '8', '2']]
    verify_leaves(a, b, valid, -6)
    count = 1
    for bad in [[], valid * 2, [['tube', 0, 0, '2', '2', '9', '2']],
                [['tube', 0, 0, '2', '2', '8', '1']],
                [['tube', 0, 0, '0', '0', '8', '2']]]:
        try:
            verify_leaves(a, b, bad, -6)
        except AssertionError:
            count += 1
        else:
            raise AssertionError('Corrupt certificate accepted')
    touching = [c(1 / 32, 0)]
    try:
        verify_leaves(a, touching, [['tube', 0, 0, '2', '0', '4', '2']], -6)
    except AssertionError:
        count += 1
    else:
        raise AssertionError('Equality accepted')
    exact_cover([(0, 1, 0, 2), (1, 2, 0, 1), (1, 2, 1, 2)], 2, 2)
    count += 1
    return count


def main():
    checks = self_tests()
    packet = json.loads((TARGET / 'contact-refinement.json').read_text())
    assert packet['version'] == 1 and packet['status'] == 'offline_conditional_chord_tube_refinement'
    for name, expected in packet['inputHashes'].items():
        assert sha(pathlib.Path(name)) == expected, name
    old = json.loads((BASE / 'bounded-geometry-018/bounded-geometry.json').read_text())
    next_packet = json.loads((BASE / 'endpoint-geometry-019/endpoint-geometry.json').read_text())
    prior = json.loads((BASE / 'contact-geometry-023/contact-geometry.json').read_text())
    by_key = {c['key']: c for c in old['cases']}
    endpoints = {c['key']: c for c in next_packet['cases']}
    assert len(packet['cases']) == len(prior['cases']) == 135
    assert [c['key'] for c in packet['cases']] == [c['key'] for c in prior['cases']]
    bindings = json.dumps(prior['inheritedProfileBindings'], separators=(',', ':'), ensure_ascii=False)
    assert hashlib.sha256(bindings.encode()).hexdigest() == packet['sourceProfileBindingsSha256']
    counts = {k: 0 for k in ['sizeCases', 'sideCases', 'candidatePairs', 'newlyDisjointPairs', 'stillUnresolvedPairs',
                              'budgetPairs', 'boxLeaves', 'tubeLeaves', 'treeComparisons', 'tubeTests']}
    closed = ['actualContactsIsolated', 'joinsExamined', 'focalFragmentsExamined', 'retainedBoundaryAccepted',
              'globalOffsetTopologyProved', 'scalingAuthorityProved', 'supplierJoinPolicyAccepted',
              'sourceGeometryAccepted', 'designerAllowed', 'orderReady']
    for flag in closed + ['fullCatalogueComplete', 'remoteWrites']:
        assert packet[flag] is False
    for c, previous in zip(packet['cases'], prior['cases']):
        original, extra = by_key[c['key']], endpoints[c['key']]
        for key in ['key', 'articleId', 'widthMm', 'heightMm', 'sourceShapeSha256']:
            assert c[key] == previous[key] == original[key] == extra[key]
        counts['sizeCases'] += 1
        for side in ['bleed', 'safe']:
            counts['sideCases'] += 1
            replacements = {b['segment']: b for b in extra[side]['branches']}
            branches = {b['segment']: replacements.get(b['segment'], b) for b in original[side]['branches']}
            r = c[side]
            assert r['arithmetic'] == 'exact_integer_dyadic_projection_separation'
            assert r['boundValidityInherited'] is True and r['withinBranchInjectivityProved'] is False
            assert r['maxWorkPerPair'] == 100000
            for flag in closed:
                assert r[flag] is False
            expected_pairs = [p['segments'] for p in previous[side]['pairs']
                              if p['reason'] == 'envelopes_overlap_contact_unresolved']
            assert [p['segments'] for p in r['pairs']] == expected_pairs
            assert len({tuple(p) for p in expected_pairs}) == len(expected_pairs)
            for p in r['pairs']:
                counts['candidatePairs'] += 1
                x, y = (branches[s] for s in p['segments'])
                assert x['status'] != 'refused' and y['status'] != 'refused'
                assert 0 < p['work'] <= r['maxWorkPerPair'] and 0 <= p['tubeTests'] <= p['work']
                counts['treeComparisons'] += p['work']; counts['tubeTests'] += p['tubeTests']
                if p['status'] == 'disjoint_inherited_curve_tubes':
                    assert p['reason'] is None and p['unresolvedChordRanges'] is None
                    verify_leaves(x['chords'], y['chords'], p['separationLeaves'], r['scale2Exponent'])
                    counts['newlyDisjointPairs'] += 1
                    for leaf in p['separationLeaves']:
                        counts['boxLeaves' if leaf[0] == 'box' else 'tubeLeaves'] += 1
                else:
                    assert p['status'] == 'unresolved' and p['separationLeaves'] == []
                    if p['reason'] == 'contact_work_budget':
                        counts['budgetPairs'] += 1
                    else:
                        assert p['reason'] == 'chord_tubes_overlap_contact_unresolved'
                        for chord_range, b in zip(p['unresolvedChordRanges'], [x, y]):
                            assert 0 <= chord_range[0] < chord_range[1] <= len(b['chords'])
                        counts['stillUnresolvedPairs'] += 1
    for key in ['disjointPairs', 'unconstructedPairs', 'allNativeBranchPairs']:
        name = 'inherited' + key[0].upper() + key[1:]
        # The packet names the full native inventory explicitly.
        if key == 'allNativeBranchPairs':
            name = 'inheritedAllNativeBranchPairs'
        counts[name] = prior['counts'][key]
    assert counts == packet['counts']
    assert counts['candidatePairs'] == 4517 and counts['newlyDisjointPairs'] == 173
    assert counts['stillUnresolvedPairs'] == 4344 and counts['budgetPairs'] == 0
    for name, expected in packet['inputHashes'].items():
        assert sha(pathlib.Path(name)) == expected, name
    report = {'scope': 'independent_fraction_certificate_and_full_candidate_coverage', 'counts': counts,
              'selfTests': checks, 'packetSha256': sha(TARGET / 'contact-refinement.json'),
              'checkerSha256': sha(pathlib.Path(__file__)), 'sourceInputsUnchanged': len(packet['inputHashes']),
              'analyticErrorBoundsReconstructed': False, 'actualContactsIsolated': False,
              'sourceGeometryAccepted': False, 'designerAllowed': False, 'orderReady': False,
              'remoteWrites': False, 'fullGoalComplete': False}
    if '--write' in sys.argv:
        with (TARGET / 'independent-verification.json').open('x') as handle:
            json.dump(report, handle, indent=2); handle.write('\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
