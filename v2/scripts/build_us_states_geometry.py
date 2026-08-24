#!/usr/bin/env python3
"""Build the committed US states SVG geometry for the by-state map.

Primary source: the US Census cartographic boundary file (1:20m), the same
agency whose TIGERweb service the client-site maps use. Fetched ONCE here,
projected through Albers USA (the standard composite that tucks AK/HI under
the Southwest), simplified, and committed as a TypeScript artifact - so the
app ships no geo dependency and the geometry cannot drift at runtime.

Run:  python3 scripts/build_us_states_geometry.py
Out:  src/lib/usStatesGeometry.ts

Doctrine (site-forge maps): real geometry through ONE projection; every
downstream consumer reads this artifact; a build-time assert on bounds.
"""
from __future__ import annotations

import io
import json
import math
import sys
import urllib.request
import zipfile
from pathlib import Path

URL = "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_20m.zip"
OUT = Path(__file__).resolve().parents[1] / "src" / "lib" / "usStatesGeometry.ts"

# Contiguous-48 Albers (EPSG:5070 parameters), plus scaled insets for AK/HI.
def albers(lam0, phi0, phi1, phi2):
    n = 0.5 * (math.sin(phi1) + math.sin(phi2))
    C = math.cos(phi1) ** 2 + 2 * n * math.sin(phi1)
    rho0 = math.sqrt(C - 2 * n * math.sin(phi0)) / n

    def proj(lon, lat):
        lam, phi = math.radians(lon), math.radians(lat)
        rho = math.sqrt(C - 2 * n * math.sin(phi)) / n
        theta = n * (lam - lam0)
        return rho * math.sin(theta), rho0 - rho * math.cos(theta)

    return proj

LOWER48 = albers(math.radians(-96), math.radians(37.5), math.radians(29.5), math.radians(45.5))
AK = albers(math.radians(-154), math.radians(50), math.radians(55), math.radians(65))
HI = albers(math.radians(-157), math.radians(20), math.radians(19), math.radians(21))

SKIP = {"72", "78", "60", "66", "69"}  # PR/VI/AS/GU/MP: no polygon slot on this map


def project(fips: str, lon: float, lat: float):
    """Group-local projection; composition into one canvas happens later."""
    if fips == "02":
        return AK(lon, lat)
    if fips == "15":
        return HI(lon, lat)
    return LOWER48(lon, lat)


def rings_of(geom):
    if geom["type"] == "Polygon":
        yield geom["coordinates"][0]
    elif geom["type"] == "MultiPolygon":
        for poly in geom["coordinates"]:
            yield poly[0]


def simplify(pts, tol):
    """Douglas-Peucker, iterative."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dmax, idx = 0.0, -1
        dx, dy = bx - ax, by - ay
        seg2 = dx * dx + dy * dy or 1e-12
        for i in range(a + 1, b):
            px, py = pts[i]
            t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg2))
            qx, qy = ax + t * dx, ay + t * dy
            d = (px - qx) ** 2 + (py - qy) ** 2
            if d > dmax:
                dmax, idx = d, i
        if dmax > tol * tol:
            keep[idx] = True
            stack.append((a, idx))
            stack.append((idx, b))
    return [p for p, k in zip(pts, keep) if k]


def main() -> int:
    print(f"fetching {URL}")
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        blob = r.read()
    print(f"  {len(blob)/1024:.0f} KB")
    zf = zipfile.ZipFile(io.BytesIO(blob))

    try:
        import shapefile  # pyshp
    except ImportError:
        sys.exit("FATAL: needs pyshp (pip install pyshp) - run with the miniconda python")

    shp = io.BytesIO(zf.read([n for n in zf.namelist() if n.endswith(".shp")][0]))
    dbf = io.BytesIO(zf.read([n for n in zf.namelist() if n.endswith(".dbf")][0]))
    rdr = shapefile.Reader(shp=shp, dbf=dbf)
    fields = [f[0] for f in rdr.fields[1:]]

    states = []
    for sr in rdr.shapeRecords():
        rec = dict(zip(fields, sr.record))
        fips, abbr, name = rec["STATEFP"], rec["STUSPS"], rec["NAME"]
        if fips in SKIP:
            continue
        geom = sr.shape.__geo_interface__
        parts = []
        for ring in rings_of(geom):
            pts = [project(fips, lon, lat) for lon, lat in ring]
            # Tolerance scaled to the ring: a fixed tol erases DC (a 10-point
            # ring smaller than the tolerance) while barely touching Texas.
            ew = max(x for x, _ in pts) - min(x for x, _ in pts)
            eh = max(y for _, y in pts) - min(y for _, y in pts)
            tol = min(0.0035, max(ew, eh) / 60)
            pts = simplify(pts, tol)
            if len(pts) >= 4:
                parts.append(pts)
        # Alaska's Aleutians cross the antimeridian; the projection handles the
        # west-of-180 islands, tiny slivers just get dropped by the size floor.
        if not parts:
            continue
        states.append((fips, abbr, name, parts))

    assert len(states) == 51, f"expected 50 states + DC, got {len(states)}"

    # Compose: lower 48 fills the canvas; AK and HI are tucked bottom-left,
    # each scaled and placed in PIXEL space so nothing depends on the raw
    # projected units lining up (they never do across three projections).
    W = 975.0

    def bounds(group):
        gxs = [x for _, _, _, ps in group for ring in ps for x, _ in ring]
        gys = [y for _, _, _, ps in group for ring in ps for _, y in ring]
        return min(gxs), max(gxs), min(gys), max(gys)

    lower = [st for st in states if st[0] not in ("02", "15")]
    ak = [st for st in states if st[0] == "02"]
    hi = [st for st in states if st[0] == "15"]

    # Alaska: drop the Aleutian islands west of the antimeridian (they project
    # far off to one side and the canonical map clips them too).
    fips_, abbr_, name_, parts_ = ak[0]
    ak = [(fips_, abbr_, name_, [r for r in parts_ if all(x < 0.55 for x, _ in r)])]

    lx0, lx1, ly0, ly1 = bounds(lower)
    lscale = W / (lx1 - lx0)
    LH = (ly1 - ly0) * lscale
    H = round(LH + 8)

    def fit(group, box_x, box_y, box_w, box_h):
        gx0, gx1, gy0, gy1 = bounds(group)
        gs = min(box_w / (gx1 - gx0), box_h / (gy1 - gy0))
        return gx0, gy1, gs, box_x, box_y

    # Canonical tuck: AK bottom-left, HI right of it, below the SW coast.
    ak_fit = fit(ak, 4, LH - 210, 260, 215)
    hi_fit = fit(hi, 285, LH - 100, 150, 100)

    def to_px(fips, x, y):
        if fips == "02":
            gx0, gy1, gs, bx, by = ak_fit
            return bx + (x - gx0) * gs, by + (gy1 - y) * gs
        if fips == "15":
            gx0, gy1, gs, bx, by = hi_fit
            return bx + (x - gx0) * gs, by + (gy1 - y) * gs
        return (x - lx0) * lscale, (ly1 - y) * lscale

    lines = [
        "// GENERATED by scripts/build_us_states_geometry.py - do not hand-edit.",
        "// Source: US Census cartographic boundary file (1:20m, 2023), Albers USA",
        "// composite projection, Douglas-Peucker simplified. AK and HI are inset.",
        "",
        "export interface StateShape {",
        "  fips: string;",
        "  abbr: string;",
        "  name: string;",
        "  /** SVG path in the shared 975-wide viewBox. */",
        "  d: string;",
        "  /** Label anchor (largest ring centroid), same coordinates. */",
        "  cx: number;",
        "  cy: number;",
        "}",
        "",
        f"export const US_MAP_VIEWBOX = {{ w: {W:.0f}, h: {H} }};",
        "",
        "export const US_STATES: StateShape[] = [",
    ]

    for fips, abbr, name, parts in sorted(lower + ak + hi, key=lambda s: s[1]):
        ds = []
        best, best_area = None, -1.0
        for ring in parts:
            pts = [to_px(fips, x, y) for x, y in ring]
            d = "M" + "L".join(f"{px:.1f} {py:.1f}" for px, py in pts) + "Z"
            ds.append(d)
            # shoelace for label anchor
            a = 0.0
            cx = cy = 0.0
            for (px, py), (qx, qy) in zip(pts, pts[1:] + pts[:1]):
                cross = px * qy - qx * py
                a += cross
                cx += (px + qx) * cross
                cy += (py + qy) * cross
            if abs(a) > best_area and abs(a) > 1e-6:
                best_area = abs(a)
                best = (cx / (3 * a), cy / (3 * a))
        assert best is not None
        d_attr = "".join(ds).replace('"', "")
        lines.append(
            f'  {{ fips: "{fips}", abbr: "{abbr}", name: {json.dumps(name)}, d: "{d_attr}", cx: {best[0]:.1f}, cy: {best[1]:.1f} }},'
        )
    lines.append("];")
    lines.append("")

    OUT.write_text("\n".join(lines))
    kb = OUT.stat().st_size / 1024
    print(f"wrote {OUT} ({kb:.0f} KB, {len(states)} shapes, viewBox 975x{H})")
    if kb > 220:
        sys.exit("FATAL: artifact too heavy; raise the simplify tolerance")
    return 0


if __name__ == "__main__":
    sys.exit(main())
