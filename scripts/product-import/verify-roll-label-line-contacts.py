"""Independent native line substitution and rational two-root isolation.
No boundary trimming, cubic contacts, source scaling or product approval.
"""
import copy
import hashlib
import json
import math
import pathlib
import runpy
import sys
from fractions import Fraction as F

BASE = pathlib.Path('output/qa/roll-labels-2026-10-06')
TARGET = BASE / 'line-contacts-025'
ARC_CHECKER = pathlib.Path('scripts/product-import/verify-roll-label-arc-contacts.py')
helpers = runpy.run_path(str(ARC_CHECKER))
radical_sign, native_winding = helpers['radical_sign'], helpers['native_winding']
cross, dot, sub, point, sign = (helpers[k] for k in ['cross', 'dot', 'sub', 'point', 'sign'])
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
normal = lambda v: (v[1], -v[0])


def two_root_sign(a, b, u, c, v):
    """Prove equality first; otherwise isolate BOTH roots by rational bounds."""
    assert u > 0 and v > 0
    x, y = radical_sign(a, b, u), sign(c)
    if x == y == 0:
        return 0
    if x * y < 0 and radical_sign(a * a + b * b * u - c * c * v, 2 * a * b, u) == 0:
        return 0
    for precision in [0, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192]:
        den = 1 << precision
        lo, hi = F(a), F(a)
        for coefficient, radicand in [(b, u), (c, v)]:
            integer = math.isqrt(radicand * den * den)
            lower = F(integer, den)
            upper = lower if integer * integer == radicand * den * den else lower + F(1, den)
            bounds = sorted([coefficient * lower, coefficient * upper])
            lo += bounds[0]; hi += bounds[1]
        if lo > 0:
            return 1
        if hi < 0:
            return -1
        if lo == hi == 0:
            return 0
    raise AssertionError('Two-root isolation budget exhausted')


def parameter(p, da, db):
    assert int(p['firstRadicand']) == da and int(p['secondRadicand']) == db
    den = int(p['denominator']); assert den > 0
    a, b, c = (int(p[k]) for k in ['constant', 'firstCoefficient', 'secondCoefficient'])
    membership = {'startSign': two_root_sign(a, b, da, c, db),
                  'endSign': two_root_sign(a - den, b, da, c, db)}
    membership['onClosedBranch'] = membership['startSign'] >= 0 and membership['endSign'] <= 0
    return [F(n, den) for n in [a, b, c]], membership


def verify_pair(a, b, result):
    pa, pb, u, v = (point(x) for x in [a['origin'], b['origin'], a['direction'], b['direction']])
    da, db, uv = dot(u, u), dot(v, v), dot(u, v)
    assert da > 0 and db > 0 and a['radius'] == b['radius'] and a['normalSign'] == b['normalSign']
    assert result['segments'] == [a['segment'], b['segment']]
    assert result['scale2Exponent'] == a['scale2Exponent'] == b['scale2Exponent']
    r = int(a['radius']) * a['normalSign']; delta = sub(pb, pa)
    if cross(u, v) != 0:
        assert result['relation'] == 'nonparallel_support_intersection'
        ta, ma = parameter(result['parameters']['onA'], da, db)
        tb, mb = parameter(result['parameters']['onB'], da, db)
        # Substitute the supplied parameters into the two ORIGINAL lines.
        # Each rational/radical coefficient of QA(tA)-QB(tB) must vanish.
        for axis in range(2):
            assert pa[axis] - pb[axis] + u[axis] * ta[0] - v[axis] * tb[0] == 0
            assert F(r * normal(u)[axis], da) + u[axis] * ta[1] - v[axis] * tb[1] == 0
            assert -F(r * normal(v)[axis], db) + u[axis] * ta[2] - v[axis] * tb[2] == 0
        assert result['membership'] == {'onA': ma, 'onB': mb}
        contact = ma['onClosedBranch'] and mb['onClosedBranch']
        assert result['status'] == ('isolated_exact_line_contact' if contact else 'disjoint_exact_line_branches')
        return
    # Project the independently constructed support displacement onto a
    # normal. This handles same-facing and opposing normals uniformly.
    separation = two_root_sign(db * cross(delta, u), -r * db, da, r * uv, db)
    if separation:
        assert result['relation'] == 'parallel_distinct_supports'
        assert result['status'] == 'disjoint_exact_line_branches'
        return
    start, end = F(dot(delta, u), da), F(dot(delta, u) + uv, da)
    lo, hi = max(F(0), min(start, end)), min(F(1), max(start, end))
    if lo > hi:
        assert result['relation'] == 'coincident_disjoint_intervals'
        assert result['status'] == 'disjoint_exact_line_branches'
        return
    endpoints = []
    for t in [lo, hi]:
        on_b = (t - start) / (end - start)
        assert 0 <= t <= 1 and 0 <= on_b <= 1
        endpoints.append({'onA': {'numerator': str(t.numerator), 'denominator': str(t.denominator)},
                          'onB': {'numerator': str(on_b.numerator), 'denominator': str(on_b.denominator)}})
    assert result['endpoints'] == endpoints
    assert result['relation'] == ('coincident_single_endpoint' if lo == hi else 'coincident_interval_overlap')
    assert result['status'] == ('isolated_exact_line_contact' if lo == hi else 'exact_coincident_line_overlap')


def verify_inventory(actual, expected):
    assert [p['segments'] for p in actual] == expected


def self_tests():
    count = 0
    for args, expected in [((0, 1, 2, -1, 2), 0), ((-2, 1, 1, 1, 1), 0),
                           ((0, 1, 2, -1, 3), -1), ((0, 1, 3, -1, 2), 1),
                           ((-(1 << 1000), 1, (1 << 2000) + 1, 0, 1), 1)]:
        assert two_root_sign(*args) == expected; count += 1
    line = lambda i, p, u: {'segment': i, 'origin': list(map(str, p)), 'direction': list(map(str, u)),
                            'radius': '1', 'normalSign': 1, 'scale2Exponent': 0}
    a, b = line(0, (0, 0), (4, 0)), line(1, (2, -2), (0, 4))
    param = lambda value, first, second: {'constant': str(value), 'firstCoefficient': str(first),
                                         'secondCoefficient': str(second), 'firstRadicand': '16',
                                         'secondRadicand': '16', 'denominator': '16'}
    valid = {'segments': [0, 1], 'scale2Exponent': 0, 'relation': 'nonparallel_support_intersection',
             'status': 'isolated_exact_line_contact', 'parameters': {'onA': param(8, 0, 1), 'onB': param(8, -1, 0)},
             'membership': {'onA': {'startSign': 1, 'endSign': -1, 'onClosedBranch': True},
                            'onB': {'startSign': 1, 'endSign': -1, 'onClosedBranch': True}}}
    verify_pair(a, b, valid); count += 1
    for modify in [lambda p: p['parameters']['onA'].update(constant='9'),
                   lambda p: p['parameters']['onA'].update(denominator='-16'),
                   lambda p: p['parameters']['onB'].update(firstRadicand='17'),
                   lambda p: p['membership']['onA'].update(endSign=0),
                   lambda p: p.update(status='disjoint_exact_line_branches')]:
        bad = copy.deepcopy(valid); modify(bad)
        try:
            verify_pair(a, b, bad)
        except AssertionError:
            count += 1
        else:
            raise AssertionError('Corrupt line certificate accepted')
    for p, u, relation, status, endpoints in [((2, 0), (4, 0), 'coincident_interval_overlap', 'exact_coincident_line_overlap', [('1', '2', '0', '1'), ('1', '1', '1', '2')]),
                                             ((4, 0), (4, 0), 'coincident_single_endpoint', 'isolated_exact_line_contact', [('1', '1', '0', '1')] * 2),
                                             ((0, -2), (-4, 0), 'coincident_single_endpoint', 'isolated_exact_line_contact', [('0', '1', '0', '1')] * 2),
                                             ((5, 0), (4, 0), 'coincident_disjoint_intervals', 'disjoint_exact_line_branches', None),
                                             ((0, 1), (4, 0), 'parallel_distinct_supports', 'disjoint_exact_line_branches', None)]:
        result = {'segments': [0, 1], 'scale2Exponent': 0, 'relation': relation, 'status': status}
        if endpoints:
            result['endpoints'] = [{'onA': {'numerator': t[0], 'denominator': t[1]},
                                    'onB': {'numerator': t[2], 'denominator': t[3]}} for t in endpoints]
        verify_pair(a, line(1, p, u), result); count += 1
        if endpoints:
            bad = copy.deepcopy(result); bad['endpoints'][0]['onA']['numerator'] = '7'
            try:
                verify_pair(a, line(1, p, u), bad)
            except AssertionError:
                count += 1
            else:
                raise AssertionError('Corrupt overlap accepted')
    for actual in [[], [{'segments': [0, 1]}, {'segments': [0, 1]}], [{'segments': [0, 2]}]]:
        try:
            verify_inventory(actual, [[0, 1]])
        except AssertionError:
            count += 1
        else:
            raise AssertionError('Incomplete or foreign pair inventory accepted')
    return count


def main():
    tests = self_tests()
    packet = json.loads((TARGET / 'line-contacts.json').read_text())
    assert packet['version'] == 1 and packet['status'] == 'offline_exact_native_straight_branch_contacts'
    for p, h in packet['inputHashes'].items():
        assert sha(pathlib.Path(p)) == h, p
    arc = json.loads((BASE / 'arc-contacts-025/arc-contacts.json').read_text())
    arc_report = json.loads((BASE / 'arc-contacts-025/independent-verification.json').read_text())
    assert arc_report['checkerSha256'] == sha(ARC_CHECKER)
    assert arc_report['packetSha256'] == sha(BASE / 'arc-contacts-025/arc-contacts.json')
    assert all(arc_report[k] is True for k in ['nativeEndpointLimitsIndependentlyReconstructed', 'allCircleSupportRootsVerified', 'fullArcPairInventoryVerified'])
    assert packet['inheritedSourceProfileBindingsSha256'] == arc['inheritedSourceProfileBindingsSha256']
    old = json.loads((BASE / 'bounded-geometry-018/bounded-geometry.json').read_text())
    endpoint = {c['key']: c for c in json.loads((BASE / 'endpoint-geometry-019/endpoint-geometry.json').read_text())['cases']}
    refinement = {c['key']: c for c in json.loads((BASE / 'contact-refinement-025/contact-refinement.json').read_text())['cases']}
    arcs = {c['key']: c for c in arc['cases']}
    counts = {k: 0 for k in packet['counts']}; counts['priorUnresolvedBoundedPairs'] = 4344
    closed = ['retainedBoundaryAccepted', 'globalOffsetTopologyProved', 'sourceGeometryAccepted', 'designerAllowed', 'orderReady']
    for flag in closed + ['allContactsIsolated', 'focalFragmentsExamined', 'scalingAuthorityProved', 'supplierJoinPolicyAccepted', 'fullCatalogueComplete', 'remoteWrites']:
        assert packet[flag] is False
    assert [c['key'] for c in packet['cases']] == [c['key'] for c in old['cases']]
    for c, source in zip(packet['cases'], old['cases']):
        extra, prior, native = endpoint[c['key']], refinement[c['key']], arcs[c['key']]
        for k in ['key', 'articleId', 'widthMm', 'heightMm', 'sourceShapeSha256']:
            assert c[k] == source[k] == extra[k] == prior[k] == native[k]
        path = source['path']; winding = native_winding(path)
        assert all(s['pointsPt'][-1] == path[(i + 1) % len(path)]['pointsPt'][0] for i, s in enumerate(path))
        counts['sizeCases'] += 1
        for side, distance in [('bleed', 3), ('safe', -3)]:
            data = c[side]; scale = F(2) ** data['scale2Exponent']
            assert data['scale2Exponent'] == native[side]['scale2Exponent']
            assert data['winding'] == native[side]['winding'] == winding and data['signedDistanceMm'] == distance
            for flag in closed + ['otherPolynomialBranchesExamined']:
                assert data[flag] is False
            counts['sideCases'] += 1
            assert [l['segment'] for l in data['lines']] == [i for i, s in enumerate(path) if s['operator'] == 'l']
            for line in data['lines']:
                segment = path[line['segment']]
                assert line['scale2Exponent'] == data['scale2Exponent'] and F(int(line['radius'])) * scale == abs(distance)
                assert line['normalSign'] == winding * sign(distance)
                assert tuple(n * scale for n in point(line['origin'])) == tuple(map(F, segment['pointsPt'][0]))
                assert tuple(n * scale for n in point(line['direction'])) == sub(tuple(map(F, segment['pointsPt'][1])), tuple(map(F, segment['pointsPt'][0])))
            counts['exactNativeLines'] += len(data['lines'])
            by_id = {l['segment']: l for l in data['lines']}
            branches = {b['segment']: b for b in source[side]['branches']}
            branches.update({b['segment']: b for b in extra[side]['branches']})
            expected = []
            for p in prior[side]['pairs']:
                if p['status'] != 'unresolved':
                    continue
                if all(i in by_id for i in p['segments']):
                    assert all(branches[i]['status'] != 'refused' for i in p['segments'])
                    expected.append(p['segments'])
                else:
                    counts['remainingNonlinearPairs'] += 1
            verify_inventory(data['pairs'], expected)
            for p in data['pairs']:
                verify_pair(*(by_id[i] for i in p['segments']), p)
                counts['straightPairsExamined'] += 1
                if p['status'] == 'disjoint_exact_line_branches':
                    counts['disjointPairs'] += 1
                elif p['status'] == 'exact_coincident_line_overlap':
                    counts['coincidentOverlapPairs'] += 1
                else:
                    counts['isolatedContactPairs'] += 1
                    if p['relation'] == 'nonparallel_support_intersection' and all(p['membership'][k]['startSign'] > 0 and p['membership'][k]['endSign'] < 0 for k in ['onA', 'onB']):
                        counts['interiorOnBothContactPairs'] += 1
    assert counts == packet['counts'], counts
    assert counts['straightPairsExamined'] == 616 and counts['remainingNonlinearPairs'] == 3728
    for p, h in packet['inputHashes'].items():
        assert sha(pathlib.Path(p)) == h, p
    report = {'scope': 'independent_native_line_substitution_and_rational_two_root_isolation', 'counts': counts,
              'selfTests': tests, 'packetSha256': sha(TARGET / 'line-contacts.json'), 'checkerSha256': sha(pathlib.Path(__file__)),
              'sourceInputsUnchanged': len(packet['inputHashes']), 'nativeLinesIndependentlyReconstructed': True,
              'bothOriginalLineEquationsVerified': True, 'closedParameterMembershipVerified': True, 'fullStraightPairInventoryVerified': True,
              'allContactsIsolated': False, 'retainedBoundaryAccepted': False, 'globalOffsetTopologyProved': False,
              'sourceGeometryAccepted': False, 'designerAllowed': False, 'orderReady': False, 'remoteWrites': False, 'fullGoalComplete': False}
    if '--write' in sys.argv:
        with (TARGET / 'independent-verification.json').open('x') as handle:
            json.dump(report, handle, indent=2); handle.write('\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
