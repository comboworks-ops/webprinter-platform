"""Independent019 exact rational identity/winding and numerical sanity witnesses.
Does not certify interval code, true-offset topology, source scaling or templates.
"""
import json
import math
from fractions import Fraction as F
from pathlib import Path

BASE = Path('output/qa/roll-labels-2026-10-06')
target = BASE / 'endpoint-geometry-019'
packet = json.loads((target / 'endpoint-geometry.json').read_text())
previous = json.loads((BASE / 'bounded-geometry-018/bounded-geometry.json').read_text())
paths = {c['key']: c['path'] for c in previous['cases']}


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def velocity(ps, t):
    if len(ps) == 2:
        return [ps[1][k] - ps[0][k] for k in (0, 1)]
    u = 1 - t
    return [3 * (u*u*(ps[1][k]-ps[0][k])+2*u*t*(ps[2][k]-ps[1][k])+t*t*(ps[3][k]-ps[2][k])) for k in (0, 1)]


def tangent(ps, end):
    # Direct one-sided limit from native Bernstein controls, independently of
    # saved factor coefficients; never use a geometric tolerance.
    order = list(reversed(ps)) if end else ps
    for q in order[1:]:
        v = [order[0][k]-q[k] if end else q[k]-order[0][k] for k in (0, 1)]
        if any(v):
            return v
    return [F(0), F(0)]


def exact_winding(path):
    area = F(0)
    for s in path:
        ps = [[F(n) for n in p] for p in s['pointsPt']]
        xy = []
        for k in (0, 1):
            p = [q[k] for q in ps]
            xy.append([p[0], p[1]-p[0]] if len(p) == 2 else
                      [p[0], 3*(p[1]-p[0]), 3*(p[2]-2*p[1]+p[0]), p[3]-3*p[2]+3*p[1]-p[0]])
        x, y = xy
        for i in range(len(x)):
            for j in range(1, len(y)):
                area += (x[i]*j*y[j]-y[i]*j*x[j])/F(i+j)
    return 1 if area > 0 else -1 if area < 0 else 0


identities = branches = samples = joins = 0
max_residual = max_ratio = 0.0
for case in packet['cases']:
    path = paths[case['key']]
    sign = exact_winding(path)
    for side in ('bleed', 'safe'):
        g = case[side]
        assert g['exactWinding'] == sign
        d = g['signedDistanceMm']
        for b in g['branches']:
            branches += 1
            ps = [[F(n) for n in p] for p in path[b['segment']]['pointsPt']]
            cert = b['certificate']
            scale = F(2)**cert['scale2Exponent']
            ws = [[F(int(n))*scale for n in p] for p in cert['normalizedBernsteinControls']]
            # Both polynomials have degree at most two. Equality at THREE
            # distinct rational parameters proves their polynomial identity.
            for t in (F(0), F(1, 2), F(1)):
                w = ws[0] if len(ws) == 1 else [(1-t)*ws[0][k]+t*ws[1][k] for k in (0, 1)]
                f = t**cert['startOrder']*(1-t)**cert['endOrder']
                assert velocity(ps, t) == [f*n for n in w]
                identities += 1
            assert cert['startOrder'] == (2 if ps[0] == ps[1] == ps[2] else 1 if ps[0] == ps[1] else 0)
            assert cert['endOrder'] == (2 if ps[1] == ps[2] == ps[3] else 1 if ps[2] == ps[3] else 0)
            dw = [ws[-1][k]-ws[0][k] for k in (0, 1)]
            coefficient_sign = cross(ws[0], dw)*d*sign
            assert all(any(w) for w in ws)
            if b['status'] == 'refused':
                assert b['reason'] == 'offset_reverses_near_stationary_endpoint'
                assert coefficient_sign < 0
                assert not b['chords']
                continue
            assert coefficient_sign > 0  # All actual019 native cases are curved.
            floats = path[b['segment']]['pointsPt']
            for c in b['chords']:
                assert c['maxErrorMm'] <= 0.01
                for i in range(17):
                    fraction = i/16
                    t = c['t0']+(c['t1']-c['t0'])*fraction
                    u = 1-t
                    pos = [u**3*floats[0][k]+3*u*u*t*floats[1][k]+3*u*t*t*floats[2][k]+t**3*floats[3][k] for k in (0, 1)]
                    # Original derivative at interior t; endpoint limits use
                    # direct native control direction, not recorded W.
                    v = list(map(float, tangent(ps, t == 1))) if t in (0, 1) else velocity(floats, t)
                    speed = math.hypot(*v)
                    normal = [pos[0]+d*sign*v[1]/speed, pos[1]-d*sign*v[0]/speed]
                    q = [c['start'][k]+fraction*(c['end'][k]-c['start'][k]) for k in (0, 1)]
                    error = math.dist(normal, q)
                    assert error <= c['maxErrorMm']+1e-10
                    max_residual = max(error, max_residual)
                    max_ratio = max(error/c['maxErrorMm'], max_ratio)
                    samples += 1
        for j in g['joins']:
            joins += 1
            idx = j['afterSegment']
            a = tangent([[F(n) for n in p] for p in path[idx]['pointsPt']], True)
            b = tangent([[F(n) for n in p] for p in path[(idx+1) % len(path)]['pointsPt']], False)
            turn = cross(a, b)
            assert any(a) and any(b)
            kind = ('continuous_normal' if turn == 0 and sum(a[k]*b[k] for k in (0, 1)) > 0 else
                    'analytic_round_arc' if turn*sign*d > 0 else 'refused')
            assert j['kind'] == kind
            if kind == 'refused':
                assert j['start'] is None and j['end'] is None
            else:
                for point, v in zip((j['start'], j['end']), (a, b)):
                    v = list(map(float, v))
                    speed = math.hypot(*v)
                    normal = [j['center'][0]+d*sign*v[1]/speed, j['center'][1]-d*sign*v[0]/speed]
                    assert math.dist(normal, point) <= j['endpointErrorMm']+1e-10

report = {'scope': 'exact rational input polynomial/winding/join verification plus finite numerical normal witnesses; no global offset or supplier acceptance',
          'stationaryBranches': branches, 'exactRationalIdentityComparisons': identities,
          'exactRationalJoinClassifications': joins, 'independentNormalSamples': samples,
          'maxObservedResidualMm': max_residual, 'maxObservedErrorBoundRatio': max_ratio,
          'sourceGeometryAccepted': False, 'globalOffsetTopologyProved': False, 'designerAllowed': False, 'orderReady': False}
with (target / 'independent-verification.json').open('x') as f:
    json.dump(report, f, indent=2)
    f.write('\n')
print(json.dumps(report))
