"""Independent original line/circle substitution and nested root isolation.
Every native line/arc pair is retained; cubic/trim/physical gates stay closed.
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
TARGET = BASE / 'line-arc-contacts-025'
helpers = runpy.run_path('scripts/product-import/verify-roll-label-line-contacts.py')
radical_sign, cross, dot, sub, point, sign = (helpers[k] for k in ['radical_sign', 'cross', 'dot', 'sub', 'point', 'sign'])
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
normal = lambda u: (u[1], -u[0])


def sqrt_bounds(value, precision):
    assert value >= 0
    den = 1 << precision
    integer = math.isqrt(value.numerator * den * den // value.denominator)
    lo = F(integer, den)
    hi = lo if lo * lo == value else lo + F(1, den)
    assert lo * lo <= value <= hi * hi
    return lo, hi


def nested_sign(a, b, d, c, q, s):
    """Rational brackets for sqrt(d) AND sqrt(q+s sqrt(d))."""
    assert d > 0
    h_sign = radical_sign(q, s, d); assert h_sign >= 0
    x = radical_sign(a, b, d)
    if h_sign == 0 or c == 0:
        return x
    if x * sign(c) < 0 and radical_sign(a * a + b * b * d - c * c * q, 2 * a * b - c * c * s, d) == 0:
        return 0
    for precision in [0, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192]:
        base_lo, base_hi = sqrt_bounds(F(d), precision)
        h_lo, h_hi = sorted([q + s * base_lo, q + s * base_hi])
        assert h_hi >= 0
        nested_lo = sqrt_bounds(max(F(0), h_lo), precision)[0]
        nested_hi = sqrt_bounds(h_hi, precision)[1]
        first = sorted([b * base_lo, b * base_hi])
        second = sorted([c * nested_lo, c * nested_hi])
        lo, hi = a + first[0] + second[0], a + first[1] + second[1]
        if lo > 0:
            return 1
        if hi < 0:
            return -1
        if lo == hi == 0:
            return 0
    raise AssertionError('Nested-root isolation budget exhausted')


def verify_pair(line, arc, result):
    p, u, center, start, end = (point(x) for x in [line['origin'], line['direction'], arc['center'], arc['startDirection'], arc['endDirection']])
    d, radius = dot(u, u), int(line['radius']); r = radius * line['normalSign']
    assert d > 0 and radius > 0 and line['radius'] == arc['radius']
    assert line['scale2Exponent'] == arc['scale2Exponent'] == result['scale2Exponent']
    assert result['lineSegment'] == line['segment'] and result['arcAfterSegment'] == arc['afterSegment']
    assert arc['sweep'] * cross(start, end) > 0
    delta = sub(center, p); h = cross(delta, u)
    # The squared original normal distance minus circle radius squared,
    # multiplied by |u|². Positive means no real line/circle support root.
    distance_difference = radical_sign(h * h, -2 * r * h, d)
    if distance_difference > 0:
        assert result['relation'] == 'no_real_line_circle_root'
        assert result['roots'] == [] and result['contactCount'] == 0 and result['status'] == 'disjoint_exact_line_arc'
        return
    q, s = -h * h, 2 * r * h
    assert result['radical'] == {'baseRadicand': str(d), 'nestedConstant': str(q), 'nestedCoefficient': str(s)}
    tangent = distance_difference == 0
    assert result['relation'] == ('tangent_line_circle_support' if tangent else 'two_line_circle_support_roots')
    assert [root['rootSign'] for root in result['roots']] == ([1] if tangent else [-1, 1])
    contacts = 0
    for root in result['roots']:
        parameter = root['parameter']; expression = root['point']
        den = int(expression['denominator']); assert den == d and int(parameter['denominator']) == d
        constant = int(parameter['constant']); coefficient = int(parameter['nestedCoefficient'])
        assert coefficient == root['rootSign']
        base, first, nested = (point(expression[k]) for k in ['base', 'firstCoefficient', 'nestedCoefficient'])
        # The full supplied point must lie on the ORIGINAL offset line at
        # the supplied native parameter. Check each extension coefficient.
        for axis in range(2):
            assert base[axis] == den * p[axis] + u[axis] * constant
            assert first[axis] == r * normal(u)[axis]
            assert nested[axis] == u[axis] * coefficient
        v = sub(base, (den * center[0], den * center[1]))
        # Substitute in |point-center|²=R². After reducing nestedRoot²=q+s√d,
        # all four coefficients vanish independently. No float point check.
        assert dot(v, v) + d * dot(first, first) + q * dot(nested, nested) == den * den * radius * radius
        assert 2 * dot(v, first) + s * dot(nested, nested) == 0
        assert dot(v, nested) == 0 and dot(first, nested) == 0
        on_line = {'startSign': nested_sign(constant, 0, d, coefficient, q, s),
                   'endSign': nested_sign(constant - den, 0, d, coefficient, q, s)}
        on_line['onClosedBranch'] = on_line['startSign'] >= 0 and on_line['endSign'] <= 0
        on_arc = {'startSign': arc['sweep'] * nested_sign(cross(start, v), cross(start, first), d, cross(start, nested), q, s),
                  'endSign': arc['sweep'] * nested_sign(cross(v, end), cross(first, end), d, cross(nested, end), q, s)}
        on_arc['onClosedArc'] = on_arc['startSign'] >= 0 and on_arc['endSign'] >= 0
        assert root['onLine'] == on_line and root['onArc'] == on_arc
        contact = on_line['onClosedBranch'] and on_arc['onClosedArc']
        assert root['contact'] is contact
        contacts += contact
    assert result['contactCount'] == contacts
    assert result['status'] == ('isolated_exact_line_arc_contacts' if contacts else 'disjoint_exact_line_arc')


def verify_inventory(pairs, lines, arcs):
    assert [(p['lineSegment'], p['arcAfterSegment']) for p in pairs] == [(l['segment'], a['afterSegment']) for l in lines for a in arcs]


def self_tests():
    count = 0
    for args, expected in [((-1, 1, 2, -1, 3, -2), 0), ((1, -1, 2, 1, 3, -2), 0),
                           ((-3, 0, 2, 1, 8, 0), -1), ((0, 0, 2, 1, 3, -2), 1),
                           ((-(1 << 1000), 0, 2, 1, (1 << 2000) + 1, 0), 1)]:
        assert nested_sign(*args) == expected; count += 1
    line = {'segment': 0, 'origin': ['0', '0'], 'direction': ['4', '0'], 'radius': '1', 'normalSign': 1, 'scale2Exponent': 0}
    arc = {'afterSegment': 0, 'center': ['2', '-1'], 'radius': '1', 'startDirection': ['0', '-1'], 'endDirection': ['1', '1'], 'sweep': 1, 'scale2Exponent': 0}
    result = {'lineSegment': 0, 'arcAfterSegment': 0, 'scale2Exponent': 0, 'relation': 'two_line_circle_support_roots',
              'radical': {'baseRadicand': '16', 'nestedConstant': '-16', 'nestedCoefficient': '8'},
              'status': 'isolated_exact_line_arc_contacts', 'contactCount': 1, 'roots': []}
    for r in [-1, 1]:
        result['roots'].append({'rootSign': r, 'parameter': {'constant': '8', 'nestedCoefficient': str(r), 'denominator': '16'},
                                'point': {'base': ['32', '0'], 'firstCoefficient': ['0', '-4'], 'nestedCoefficient': [str(4 * r), '0'], 'denominator': '16'},
                                'onLine': {'startSign': 1, 'endSign': -1, 'onClosedBranch': True},
                                'onArc': {'startSign': r, 'endSign': r, 'onClosedArc': r == 1}, 'contact': r == 1})
    verify_pair(line, arc, result); count += 1
    for modify in [lambda p: p['roots'].pop(), lambda p: p['roots'].append(copy.deepcopy(p['roots'][0])),
                   lambda p: p['roots'][0]['point'].update(firstCoefficient=['0', '-5']),
                   lambda p: p['roots'][0]['point'].update(base=['31', '0']),
                   lambda p: p['roots'][0]['parameter'].update(constant='7'),
                   lambda p: p['radical'].update(nestedCoefficient='7'),
                   lambda p: p['roots'][1]['onArc'].update(startSign=0),
                   lambda p: p['roots'][1]['onLine'].update(endSign=0),
                   lambda p: p['roots'][1].update(contact=False), lambda p: p.update(contactCount=2)]:
        bad = copy.deepcopy(result); modify(bad)
        try:
            verify_pair(line, arc, bad)
        except AssertionError:
            count += 1
        else:
            raise AssertionError('Corrupt line/arc contact accepted')
    tangent_arc = {**arc, 'center': ['0', '0']}
    tangent = {**copy.deepcopy(result), 'relation': 'tangent_line_circle_support',
               'radical': {'baseRadicand': '16', 'nestedConstant': '0', 'nestedCoefficient': '0'},
               'roots': [{'rootSign': 1, 'parameter': {'constant': '0', 'nestedCoefficient': '1', 'denominator': '16'},
                          'point': {'base': ['0', '0'], 'firstCoefficient': ['0', '-4'], 'nestedCoefficient': ['4', '0'], 'denominator': '16'},
                          'onLine': {'startSign': 0, 'endSign': -1, 'onClosedBranch': True},
                          'onArc': {'startSign': 0, 'endSign': 1, 'onClosedArc': True}, 'contact': True}]}
    verify_pair(line, tangent_arc, tangent); count += 1
    no_root = {'lineSegment': 0, 'arcAfterSegment': 0, 'scale2Exponent': 0, 'relation': 'no_real_line_circle_root',
               'status': 'disjoint_exact_line_arc', 'contactCount': 0, 'roots': []}
    verify_pair(line, {**arc, 'center': ['0', '2']}, no_root); count += 1
    for pairs in [[], [{'lineSegment': 0, 'arcAfterSegment': 0}] * 2, [{'lineSegment': 1, 'arcAfterSegment': 0}]]:
        try:
            verify_inventory(pairs, [line], [arc])
        except AssertionError:
            count += 1
        else:
            raise AssertionError('Incomplete/duplicate/foreign line/arc inventory accepted')
    return count


def main():
    tests = self_tests()
    packet = json.loads((TARGET / 'line-arc-contacts.json').read_text())
    assert packet['version'] == 1 and packet['status'] == 'offline_exact_native_line_arc_contacts'
    for p, h in packet['inputHashes'].items():
        assert sha(pathlib.Path(p)) == h, p
    parents = {}
    for name, required in [('arc', ['nativeEndpointLimitsIndependentlyReconstructed', 'allCircleSupportRootsVerified', 'fullArcPairInventoryVerified']),
                           ('line', ['nativeLinesIndependentlyReconstructed', 'bothOriginalLineEquationsVerified', 'fullStraightPairInventoryVerified'])]:
        parent = BASE / (name + '-contacts-025') / (name + '-contacts.json')
        report = json.loads((parent.parent / 'independent-verification.json').read_text())
        assert report['packetSha256'] == sha(parent)
        assert report['checkerSha256'] == sha(pathlib.Path('scripts/product-import/verify-roll-label-' + name + '-contacts.py'))
        assert all(report[k] is True for k in required)
        parents[name] = json.loads(parent.read_text())
        assert packet['inheritedSourceProfileBindingsSha256'] == parents[name]['inheritedSourceProfileBindingsSha256']
    arc_cases, line_cases = ({c['key']: c for c in parents[name]['cases']} for name in ['arc', 'line'])
    assert [c['key'] for c in packet['cases']] == [c['key'] for c in parents['line']['cases']]
    closed = ['retainedBoundaryAccepted', 'globalOffsetTopologyProved', 'sourceGeometryAccepted', 'designerAllowed', 'orderReady', 'cubicBranchContactsExamined']
    for flag in closed + ['allContactsIsolated', 'focalFragmentsExamined', 'scalingAuthorityProved', 'supplierJoinPolicyAccepted', 'fullCatalogueComplete', 'remoteWrites']:
        assert packet[flag] is False
    counts = {k: 0 for k in packet['counts']}
    for c in packet['cases']:
        a, l = arc_cases[c['key']], line_cases[c['key']]
        for k in ['key', 'articleId', 'widthMm', 'heightMm', 'sourceShapeSha256']:
            assert c[k] == a[k] == l[k]
        counts['sizeCases'] += 1
        for side in ['bleed', 'safe']:
            data = c[side]; counts['sideCases'] += 1
            for flag in closed:
                assert data[flag] is False
            assert data['scale2Exponent'] == a[side]['scale2Exponent'] == l[side]['scale2Exponent']
            lines, arcs = l[side]['lines'], a[side]['arcs']
            verify_inventory(data['pairs'], lines, arcs)
            by_line, by_arc = {x['segment']: x for x in lines}, {x['afterSegment']: x for x in arcs}
            for pair in data['pairs']:
                verify_pair(by_line[pair['lineSegment']], by_arc[pair['arcAfterSegment']], pair)
                counts['lineArcPairs'] += 1; counts['supportRootsChecked'] += len(pair['roots'])
                if pair['status'] == 'disjoint_exact_line_arc':
                    counts['disjointPairs'] += 1
                else:
                    counts['isolatedContactPairs'] += 1; counts['isolatedContacts'] += pair['contactCount']
                if pair['relation'] == 'tangent_line_circle_support':
                    counts['tangentSupportPairs'] += 1; counts['tangentContacts'] += pair['contactCount']
                counts['closedLineEndpointContacts'] += sum(root['contact'] and (root['onLine']['startSign'] == 0 or root['onLine']['endSign'] == 0) for root in pair['roots'])
    assert counts == packet['counts'], counts
    assert counts['lineArcPairs'] == 85227 and counts['isolatedContacts'] == 2148 and counts['closedLineEndpointContacts'] == 1930
    for p, h in packet['inputHashes'].items():
        assert sha(pathlib.Path(p)) == h, p
    report = {'scope': 'independent_original_line_circle_substitution_and_rational_nested_root_isolation', 'counts': counts,
              'selfTests': tests, 'packetSha256': sha(TARGET / 'line-arc-contacts.json'), 'checkerSha256': sha(pathlib.Path(__file__)),
              'sourceInputsUnchanged': len(packet['inputHashes']), 'bothOriginalLineAndCircleEquationsVerified': True,
              'closedLineAndArcMembershipVerified': True, 'fullNativeLineArcPairInventoryVerified': True,
              'cubicBranchContactsExamined': False, 'allContactsIsolated': False, 'retainedBoundaryAccepted': False,
              'globalOffsetTopologyProved': False, 'sourceGeometryAccepted': False, 'designerAllowed': False,
              'orderReady': False, 'remoteWrites': False, 'fullGoalComplete': False}
    if '--write' in sys.argv:
        with (TARGET / 'independent-verification.json').open('x') as handle:
            json.dump(report, handle, indent=2); handle.write('\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
