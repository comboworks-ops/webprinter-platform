"""Independent exact circle equations, rational sqrt isolation and native
Taylor-limit readback. Checks every native arc pair and smooth incidence.
No source scaling, branch-interior trimming or printable topology approval.
"""
import hashlib
import json
import math
import pathlib
import sys
from fractions import Fraction as F

BASE = pathlib.Path('output/qa/roll-labels-2026-10-06')
TARGET = BASE / 'arc-contacts-025'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
sub = lambda a, b: (a[0] - b[0], a[1] - b[1])
cross = lambda a, b: a[0] * b[1] - a[1] * b[0]
dot = lambda a, b: a[0] * b[0] + a[1] * b[1]
point = lambda p: tuple(map(int, p))
sign = lambda n: (n > 0) - (n < 0)


def radical_sign(a, b, t):
    """Use an isqrt-derived rational isolating interval, not float sqrt."""
    assert t >= 0
    if b == 0 or t == 0:
        return sign(a)
    root = math.isqrt(t)
    if root * root == t:
        return sign(a + b * root)
    if a * b < 0 and a * a == b * b * t:
        return 0
    for precision in [0, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192]:
        denominator = 1 << precision
        lo = F(math.isqrt(t * denominator * denominator), denominator)
        hi = lo + F(1, denominator)
        bounds = sorted([a + b * lo, a + b * hi])
        if bounds[0] > 0:
            return 1
        if bounds[1] < 0:
            return -1
    raise AssertionError('Radical sign isolation budget exhausted')


def membership(arc, base, coefficient, denominator, t):
    center, start, end = (point(arc[k]) for k in ['center', 'startDirection', 'endDirection'])
    v = sub(base, (denominator * center[0], denominator * center[1]))
    direction = arc['sweep']
    a = direction * radical_sign(cross(start, v), cross(start, coefficient), t)
    b = direction * radical_sign(cross(v, end), cross(coefficient, end), t)
    return {'startSign': a, 'endSign': b, 'onClosedArc': a >= 0 and b >= 0}


def direction_member(arc, v):
    return (arc['sweep'] * cross(point(arc['startDirection']), v) >= 0
            and arc['sweep'] * cross(v, point(arc['endDirection'])) >= 0)


def verify_pair(a, b, pair):
    ac, bc = point(a['center']), point(b['center'])
    r, s = int(a['radius']), int(b['radius'])
    delta = sub(bc, ac); distance = dot(delta, delta)
    assert pair['segments'] == [a['afterSegment'], b['afterSegment']]
    assert pair['scale2Exponent'] == a['scale2Exponent'] == b['scale2Exponent']
    assert r > 0 and s > 0
    if distance == 0:
        assert pair['roots'] == []
        if r != s:
            assert pair['relation'] == 'concentric_disjoint'
            assert pair['status'] == 'disjoint_exact_round_arcs' and pair['contactCount'] == 0
        else:
            flags = [direction_member(b, point(a['startDirection'])), direction_member(b, point(a['endDirection'])),
                     direction_member(a, point(b['startDirection'])), direction_member(a, point(b['endDirection']))]
            assert pair['relation'] == 'coincident_circle_support' and pair['endpointMembership'] == flags
            assert pair['status'] == ('coincident_sector_contact_unresolved' if any(flags) else 'disjoint_exact_round_arcs')
            assert pair['contactCount'] == (None if any(flags) else 0)
        return
    # Classify circle support by squared distances independently of the
    # author's discriminant predicate.
    outside = distance > (r + s) ** 2 or distance < (r - s) ** 2
    if outside:
        assert pair['relation'] == 'no_real_circle_support_root'
        assert pair['status'] == 'disjoint_exact_round_arcs' and pair['contactCount'] == 0 and pair['roots'] == []
        return
    tangent = distance in ((r + s) ** 2, (r - s) ** 2)
    assert pair['relation'] == ('tangent_circle_support' if tangent else 'two_circle_support_roots')
    roots = pair['roots']
    assert [p['rootSign'] for p in roots] == ([1] if tangent else [-1, 1])
    assert int(pair['distanceSquared']) == distance
    k = r * r - s * s + distance
    assert int(pair['radicalAxisNumerator']) == k
    t = int(pair['discriminant'])
    assert t >= 0 and (t == 0) == tangent and t == 4 * r * r * distance - k * k
    contacts = 0
    for root in roots:
        p = root['point']; base, coefficient = point(p['base']), point(p['coefficient'])
        denominator = int(p['denominator'])
        assert denominator > 0 and int(p['radicand']) == t
        # The full algebraic point must satisfy BOTH original circle equations,
        # not merely the radical-axis formula copied from the writer.
        for center, radius in [(ac, r), (bc, s)]:
            u = sub(base, (denominator * center[0], denominator * center[1]))
            assert dot(u, u) + t * dot(coefficient, coefficient) == denominator * denominator * radius * radius
            assert dot(u, coefficient) == 0
        assert cross(delta, sub(base, (denominator * ac[0], denominator * ac[1]))) == 0
        assert sign(cross(delta, coefficient)) == root['rootSign']
        on_a, on_b = membership(a, base, coefficient, denominator, t), membership(b, base, coefficient, denominator, t)
        assert root['onA'] == on_a and root['onB'] == on_b
        contact = on_a['onClosedArc'] and on_b['onClosedArc']
        assert root['contact'] is contact
        contacts += contact
    if not tangent:
        p, q = (root['point'] for root in roots)
        assert p['base'] == q['base'] and p['denominator'] == q['denominator'] and p['radicand'] == q['radicand']
        assert point(p['coefficient']) == tuple(-n for n in point(q['coefficient']))
        assert point(p['coefficient']) != (0, 0)
    assert pair['contactCount'] == contacts
    assert pair['status'] == ('isolated_exact_round_arc_contacts' if contacts else 'disjoint_exact_round_arcs')


def power(segment):
    p = [tuple(map(F, xy)) for xy in segment['pointsPt']]
    if len(p) == 2:
        return [p[0], sub(p[1], p[0])]
    return [p[0], tuple(3 * n for n in sub(p[1], p[0])),
            tuple(3 * (p[2][k] - 2 * p[1][k] + p[0][k]) for k in range(2)),
            tuple(p[3][k] - 3 * p[2][k] + 3 * p[1][k] - p[0][k] for k in range(2))]


def tangent(segment, end):
    coefficients = power(segment)
    derivative = [tuple((j + 1) * n for n in p) for j, p in enumerate(coefficients[1:])]
    if end:
        derivative = [tuple(sum(derivative[j][axis] * math.comb(j, k) * (-1) ** k
                                for j in range(k, len(derivative))) for axis in range(2))
                      for k in range(len(derivative))]
    for k, p in enumerate(derivative):
        if p != (0, 0):
            return p, k + 1
    raise AssertionError('Collapsed native endpoint')


def native_winding(path):
    area = F(0)
    for s in path:
        p = power(s)
        for i in range(len(p)):
            for j in range(1, len(p)):
                area += F(j, i + j) * cross(p[i], p[j])
    assert area != 0
    return sign(area)


def same_forward_direction(a, b):
    return cross(a, b) == 0 and dot(a, b) > 0


def self_tests():
    import copy
    arc = lambda i, c, a, b: {'afterSegment': i, 'center': list(map(str, c)), 'radius': '1',
                             'startDirection': list(map(str, a)), 'endDirection': list(map(str, b)),
                             'sweep': 1, 'scale2Exponent': 0}
    a, b = arc(0, (0, 0), (1, 0), (0, 1)), arc(1, (1, 0), (0, 1), (-1, 0))
    roots = []
    for s in [-1, 1]:
        p = {'base': ['1', '0'], 'coefficient': ['0', str(s)], 'denominator': '2', 'radicand': '3'}
        on_a, on_b = membership(a, (1, 0), (0, s), 2, 3), membership(b, (1, 0), (0, s), 2, 3)
        roots.append({'rootSign': s, 'point': p, 'onA': on_a, 'onB': on_b,
                      'contact': on_a['onClosedArc'] and on_b['onClosedArc']})
    valid = {'segments': [0, 1], 'scale2Exponent': 0, 'distanceSquared': '1', 'radicalAxisNumerator': '1',
             'discriminant': '3', 'relation': 'two_circle_support_roots', 'status': 'isolated_exact_round_arc_contacts',
             'contactCount': 1, 'roots': roots}
    verify_pair(a, b, valid)
    bads = []
    for modify in [lambda p: p['roots'].pop(),
                   lambda p: p['roots'][1]['point'].update(base=['2', '0']),
                   lambda p: p['roots'][1].update(contact=False),
                   lambda p: p['roots'][0]['point'].update(coefficient=['0', '1']),
                   lambda p: p.update(contactCount=2),
                   lambda p: p['roots'][1]['onA'].update(startSign=0)]:
        p = copy.deepcopy(valid); modify(p); bads.append(p)
    for bad in bads:
        try:
            verify_pair(a, b, bad)
        except AssertionError:
            pass
        else:
            raise AssertionError('Corrupt or omitted root accepted')
    assert radical_sign(1 << 1000, -1, (1 << 2000) - 1) == 1
    assert radical_sign(1 << 1000, -1, (1 << 2000) + 1) == -1
    assert radical_sign(2, -1, 4) == 0
    return 10


def main():
    tests = self_tests()
    packet = json.loads((TARGET / 'arc-contacts.json').read_text())
    assert packet['version'] == 1 and packet['status'] == 'offline_exact_native_round_arc_contacts'
    for p, h in packet['inputHashes'].items():
        assert sha(pathlib.Path(p)) == h, p
    old = json.loads((BASE / 'bounded-geometry-018/bounded-geometry.json').read_text())
    endpoint = {c['key']: c for c in json.loads((BASE / 'endpoint-geometry-019/endpoint-geometry.json').read_text())['cases']}
    refinement_packet = json.loads((BASE / 'contact-refinement-025/contact-refinement.json').read_text())
    refinement = {c['key']: c for c in refinement_packet['cases']}
    assert packet['inheritedSourceProfileBindingsSha256'] == refinement_packet['sourceProfileBindingsSha256']
    assert [c['key'] for c in packet['cases']] == [c['key'] for c in old['cases']]
    counts = {k: 0 for k in packet['counts']}; counts['remainingBoundedBranchPairs'] = 4344
    closed = ['sourceGeometryAccepted', 'supplierJoinPolicyAccepted', 'globalOffsetTopologyProved', 'designerAllowed', 'orderReady']
    for flag in closed + ['branchInteriorContactsExamined', 'allContactsIsolated', 'focalFragmentsExamined',
                           'retainedBoundaryAccepted', 'scalingAuthorityProved', 'fullCatalogueComplete', 'remoteWrites']:
        assert packet[flag] is False
    for c, source in zip(packet['cases'], old['cases']):
        extra, prior = endpoint[c['key']], refinement[c['key']]
        for k in ['key', 'articleId', 'widthMm', 'heightMm', 'sourceShapeSha256']:
            assert c[k] == source[k] == extra[k] == prior[k]
        path = source['path']; n = len(path); winding = native_winding(path)
        for i, segment in enumerate(path):
            assert segment['pointsPt'][-1] == path[(i + 1) % n]['pointsPt'][0]
        counts['sizeCases'] += 1
        for side, signed_distance in [('bleed', 3), ('safe', -3)]:
            counts['sideCases'] += 1
            data = c[side]; scale = F(2) ** data['scale2Exponent']
            assert data['winding'] == winding and data['arithmetic'] == 'exact_native_bernstein_tangent_limits'
            for flag in closed + ['branchInteriorContactsExamined', 'retainedBoundaryAccepted']:
                assert data[flag] is False
            supplement = {j['afterSegment']: j for j in extra[side]['joins']}
            joins = [supplement.get(j['afterSegment'], j) for j in source[side]['joins']]
            branches = {b['segment']: b for b in source[side]['branches']}
            branches.update({b['segment']: b for b in extra[side]['branches']})
            assert [j['afterSegment'] for j in joins] == list(range(n))
            arcs, smooth = data['arcs'], data['continuousJoins']
            assert [a['afterSegment'] for a in arcs] == [j['afterSegment'] for j in joins if j['kind'] == 'analytic_round_arc']
            assert [a['afterSegment'] for a in smooth] == [j['afterSegment'] for j in joins if j['kind'] == 'continuous_normal']
            refused = sum(j['kind'] == 'refused' for j in joins)
            assert data['refusedJoins'] == refused
            counts['nativeJoins'] += n; counts['roundArcs'] += len(arcs); counts['continuousJoins'] += len(smooth); counts['refusedJoins'] += refused
            for entry in arcs + smooth:
                i = entry['afterSegment']; j = (i + 1) % n
                incoming, order_a = tangent(path[i], True); outgoing, order_b = tangent(path[j], False)
                normal_sign = winding * sign(signed_distance)
                normals = [(normal_sign * v[1], -normal_sign * v[0]) for v in [incoming, outgoing]]
                assert entry['scale2Exponent'] == data['scale2Exponent']
                assert tuple(v * scale for v in point(entry['center'])) == tuple(map(F, path[i]['pointsPt'][-1]))
                if 'radius' in entry:
                    assert F(int(entry['radius'])) * scale == abs(signed_distance)
                    assert same_forward_direction(point(entry['startDirection']), normals[0])
                    assert same_forward_direction(point(entry['endDirection']), normals[1])
                    assert entry['incomingLeadingOrder'] == order_a and entry['outgoingLeadingOrder'] == order_b
                    turn = sign(cross(incoming, outgoing))
                    assert entry['sweep'] == turn and turn * winding * signed_distance > 0
                    assert joins[i]['sweep'] == (1 if turn > 0 else 0)
                    assert turn * cross(point(entry['startDirection']), point(entry['endDirection'])) > 0
                    counts['stationaryEndpointArcLimits'] += order_a > 1 or order_b > 1
                else:
                    assert same_forward_direction(incoming, outgoing)
                    assert same_forward_direction(point(entry['direction']), normals[0])
            expected_ids = [[a['afterSegment'], b['afterSegment']] for i, a in enumerate(arcs) for b in arcs[i + 1:]]
            assert [p['segments'] for p in data['pairs']] == expected_ids
            by_id = {a['afterSegment']: a for a in arcs}
            for p in data['pairs']:
                verify_pair(*(by_id[i] for i in p['segments']), p)
                counts['arcPairs'] += 1; counts['supportRootsChecked'] += len(p['roots'])
                if p['status'] == 'disjoint_exact_round_arcs':
                    counts['disjointArcPairs'] += 1
                elif p['status'] == 'coincident_sector_contact_unresolved':
                    counts['coincidentSectorUnresolvedPairs'] += 1
                else:
                    counts['isolatedArcContactPairs'] += 1; counts['isolatedArcContacts'] += p['contactCount']
                    if p['relation'] == 'tangent_circle_support':
                        counts['tangentArcContacts'] += p['contactCount']
            expected_smooth = []
            smooth_by_id = {j['afterSegment']: j for j in smooth}
            for p in prior[side]['pairs']:
                if p['status'] != 'unresolved':
                    continue
                a, b = p['segments']
                after = a if (a + 1) % n == b else b if (b + 1) % n == a else None
                if after in smooth_by_id:
                    expected_smooth.append((p['segments'], after))
            assert [(p['sourcePairSegments'], p['afterSegment']) for p in data['smoothEndpointContacts']] == expected_smooth
            for p in data['smoothEndpointContacts']:
                i, j = p['branches']
                assert i == p['afterSegment'] and j == (i + 1) % n and p['nativeParameters'] == [1, 0]
                assert branches[i]['status'] != 'refused' and branches[j]['status'] != 'refused'
                assert p['signedDistanceMm'] == signed_distance and p['exactEndpointContactProved'] is True
                assert p['wholePairContactsIsolated'] is False and p['branchInteriorContactsExamined'] is False
                for field in ['center', 'direction', 'scale2Exponent']:
                    assert p[field] == smooth_by_id[i][field]
                counts['knownSmoothBranchEndpointContacts'] += 1
    assert counts == packet['counts'], counts
    assert counts['arcPairs'] == 49326 and counts['isolatedArcContacts'] == 318 and counts['knownSmoothBranchEndpointContacts'] == 325
    for p, h in packet['inputHashes'].items():
        assert sha(pathlib.Path(p)) == h, p
    report = {'scope': 'independent_native_taylor_circle_equation_and_rational_root_isolation', 'counts': counts,
              'selfTests': tests, 'packetSha256': sha(TARGET / 'arc-contacts.json'), 'checkerSha256': sha(pathlib.Path(__file__)),
              'sourceInputsUnchanged': len(packet['inputHashes']), 'nativeEndpointLimitsIndependentlyReconstructed': True,
              'allCircleSupportRootsVerified': True, 'fullArcPairInventoryVerified': True,
              'branchInteriorContactsExamined': False, 'allContactsIsolated': False,
              'retainedBoundaryAccepted': False, 'globalOffsetTopologyProved': False, 'sourceGeometryAccepted': False,
              'designerAllowed': False, 'orderReady': False, 'remoteWrites': False, 'fullGoalComplete': False}
    if '--write' in sys.argv:
        with (TARGET / 'independent-verification.json').open('x') as handle:
            json.dump(report, handle, indent=2); handle.write('\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
