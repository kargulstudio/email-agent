/**
 * Orthogonal connector routing for the flow canvas (world px, y down).
 * Paths leave a source's bottom port heading down and enter a target's top port
 * heading down; corners are rounded like the dashed escalation branch (r12).
 */

export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; w: number; h: number }

export const CORNER = 12
/** Clearance kept beside nodes when a route has to go around them. */
const GUTTER = 24

type RouteOptions = {
  /** Minimum length of the first (downward) leg, e.g. to keep a label on it. */
  firstLeg: number
  /** Minimum length of the last (downward) leg into the target. */
  lastLeg: number
  /** Source and target boxes, so a route that has to go around never crosses them. */
  from: Rect
  to: Rect
  /** Other node boxes the detour column should stay clear of. */
  obstacles?: Rect[]
}

/**
 * Polyline from `a` (heading down) to `b` (arriving downward).
 * - aligned: one straight segment (the same line as the untouched layout)
 * - target below: down, across at mid-height, down
 * - target above or level: down, out to a clear column, up, across, down
 */
export function routeDown(a: Point, b: Point, { firstLeg, lastLeg, from, to, obstacles = [] }: RouteOptions): Point[] {
  const dx = b.x - a.x
  if (Math.abs(dx) < 0.5 && b.y - a.y >= 0) return [a, { x: a.x, y: b.y }]

  const midY = Math.max(a.y + firstLeg, (a.y + b.y) / 2)
  if (b.y - midY >= lastLeg) {
    return [a, { x: a.x, y: midY }, { x: b.x, y: midY }, b]
  }

  // Not enough room going down: loop around through a column clear of every box it passes.
  const y1 = a.y + firstLeg
  const y2 = b.y - lastLeg
  const [top, bottom] = [Math.min(y1, y2), Math.max(y1, y2)]
  const blocking = [from, to, ...obstacles.filter((r) => r.y < bottom && r.y + r.h > top)]
  const clear = (x: number) => blocking.every((r) => x <= r.x - GUTTER / 2 || x >= r.x + r.w + GUTTER / 2)
  const gap =
    from.x + from.w + GUTTER <= to.x ? (from.x + from.w + to.x) / 2 // between source and target
    : to.x + to.w + GUTTER <= from.x ? (to.x + to.w + from.x) / 2
    : null
  let x: number
  if (gap !== null && clear(gap)) x = gap
  else {
    const right = Math.max(...blocking.map((r) => r.x + r.w)) + GUTTER
    const left = Math.min(...blocking.map((r) => r.x)) - GUTTER
    const cost = (side: number) => Math.abs(a.x - side) + Math.abs(b.x - side)
    x = cost(right) <= cost(left) ? right : left
  }
  return [a, { x: a.x, y: y1 }, { x, y: y1 }, { x, y: y2 }, { x: b.x, y: y2 }, b]
}

/** Drop repeated and collinear points so every remaining interior point is a real corner. */
function simplify(points: Point[]): Point[] {
  const out: Point[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue
    if (out.length >= 2) {
      const prev = out[out.length - 2]
      const collinear = (Math.abs(prev.x - last.x) < 0.01 && Math.abs(last.x - p.x) < 0.01) ||
        (Math.abs(prev.y - last.y) < 0.01 && Math.abs(last.y - p.y) < 0.01)
      if (collinear) out.pop()
    }
    out.push(p)
  }
  return out
}

const n = (v: number) => Math.round(v * 100) / 100

/** SVG path through an orthogonal polyline with rounded corners. */
export function roundedPath(points: Point[], radius = CORNER): string {
  const pts = simplify(points)
  if (pts.length < 2) return ""
  let d = `M${n(pts[0].x)} ${n(pts[0].y)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [p, c, q] = [pts[i - 1], pts[i], pts[i + 1]]
    const inLen = Math.hypot(c.x - p.x, c.y - p.y)
    const outLen = Math.hypot(q.x - c.x, q.y - c.y)
    const r = Math.min(radius, inLen / 2, outLen / 2)
    const u = { x: (c.x - p.x) / inLen, y: (c.y - p.y) / inLen }
    const v = { x: (q.x - c.x) / outLen, y: (q.y - c.y) / outLen }
    const sweep = u.x * v.y - u.y * v.x > 0 ? 1 : 0
    d += ` L${n(c.x - u.x * r)} ${n(c.y - u.y * r)}`
    d += ` A${n(r)} ${n(r)} 0 0 ${sweep} ${n(c.x + v.x * r)} ${n(c.y + v.y * r)}`
  }
  const end = pts[pts.length - 1]
  return `${d} L${n(end.x)} ${n(end.y)}`
}

/** Downward chevron whose tip is `p` (connector.svg's 3.18px arrowhead). */
export const arrowDown = (p: Point) =>
  `M${n(p.x - 3.18)} ${n(p.y - 3.18)} L${n(p.x)} ${n(p.y)} L${n(p.x + 3.18)} ${n(p.y - 3.18)}`

/** Axis-aligned box around a set of points. */
export function bounds(points: Point[]): Rect {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}
