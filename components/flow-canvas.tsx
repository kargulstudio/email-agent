"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { cn } from "@/lib/utils"
import type { FlowNode } from "@/lib/data"
import { ZERO, sameOffset, type Offset, type Offsets } from "@/lib/use-flow-history"
import { arrowDown, bounds, roundedPath, routeDown, type Point, type Rect } from "@/lib/flow-routing"
import { useMediaQuery } from "@/lib/use-media-query"
import { Asset, Chip, Tip } from "./primitives"
import { CanvasToolbar } from "./canvas-toolbar"

export type Viewport = { x: number; y: number; z: number }
export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, z: 1 }
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100))
const clampZoomSmooth = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

/** Space kept clear around the flow when fitting it to a small screen (toolbar sits at the bottom). */
const FIT_PAD = { x: 16, top: 24, bottom: 88 }

/** Viewport that shows the whole flow (never zooming in past 100%). Null if nothing is rendered. */
function fitViewport(canvas: HTMLElement, world: HTMLElement, v: Viewport): Viewport | null {
  const c = canvas.getBoundingClientRect()
  if (c.width < 1 || c.height < 1) return null // not laid out yet (hidden / background tab)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  // Rects include node offsets (transforms); routed connector lines are tagged data-fit
  world.querySelectorAll("button, img, [data-fit]").forEach((el) => {
    if (getComputedStyle(el).visibility === "hidden") return
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    minX = Math.min(minX, r.left)
    minY = Math.min(minY, r.top)
    maxX = Math.max(maxX, r.right)
    maxY = Math.max(maxY, r.bottom)
  })
  if (!Number.isFinite(minX)) return null
  // screen → world: sx = c.left + width/2 + x + wx·z
  const toWX = (sx: number) => (sx - c.left - c.width / 2 - v.x) / v.z
  const toWY = (sy: number) => (sy - c.top - v.y) / v.z
  const [wx0, wx1, wy0, wy1] = [toWX(minX), toWX(maxX), toWY(minY), toWY(maxY)]
  const z = clampZoomSmooth(
    Math.min(1, (c.width - FIT_PAD.x * 2) / (wx1 - wx0), (c.height - FIT_PAD.top - FIT_PAD.bottom) / (wy1 - wy0)),
  )
  return { z, x: -((wx0 + wx1) / 2) * z, y: FIT_PAD.top - wy0 * z }
}

type Gesture = {
  /** pointers currently down on the canvas, in canvas-local pixels */
  pointers: Map<number, Point>
  /** began on empty canvas (a tap there clears the selection) */
  onEmpty: boolean
  /** moved past the tap slop, or pinched — suppresses the click/deselect that would follow */
  moved: boolean
  start: Point
  last: Point
  /** previous two-finger distance + midpoint while pinching */
  pinch: { dist: number; mid: Point } | null
}

const pinchOf = (pointers: Map<number, Point>) => {
  const [a, b] = [...pointers.values()]
  return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
}

/* ---------------------------------------------------------------------------
 * Moving nodes
 * ------------------------------------------------------------------------ */

/** Dot-grid pitch (world px). Node moves snap to multiples of it, so aligned nodes stay aligned. */
export const GRID = 18
/** Touch: press and hold this long on a node to pick it up (a plain drag pans). */
const HOLD_MS = 300
/** Undo / redo glide nodes (and their connectors) to their new place. */
const SETTLE_MS = 240
/** Pressing these parts of a node selects it but never starts a drag. */
const NO_DRAG = ".ea-chip, .ea-app-icon, [data-no-drag]"

const snap = (v: number) => Math.round(v / GRID) * GRID || 0
const shift = (o: Offset): CSSProperties | undefined =>
  o.x || o.y ? { transform: `translate(${o.x}px, ${o.y}px)` } : undefined
const easeOut = (t: number) => 1 - (1 - t) ** 3
const ARROWS: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

function lerpOffsets(from: Offsets, to: Offsets, k: number): Offsets {
  const out: Record<string, Offset> = {}
  for (const id of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const a = from[id] ?? ZERO
    const b = to[id] ?? ZERO
    out[id] = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
  }
  return out
}

type Drag = {
  id: string
  pointerId: number
  /** pointer at the start / now, canvas px */
  start: Point
  at: Point
  /** node's offset when picked up */
  origin: Offset
  /** mouse: moved past 3px; touch: the hold fired */
  active: boolean
  /** Alt/Option held: no snapping */
  free: boolean
  offset: Offset
}
/** The node under the pointer, rendered at `offset` until the move is committed. */
type Live = { id: string; offset: Offset; released?: boolean }
type Settle = { from: Offsets; to: Offsets; t: number; start: number | null }

/** Untransformed layout boxes in world px (offsets not applied). */
type Layout = { frames: Record<string, Rect>; branch: Point | null }

/** Layout position relative to the world origin; ignores transforms (offsets, pop-in). */
function worldBox(el: HTMLElement, world: HTMLElement): Rect | null {
  let x = 0
  let y = 0
  for (let cur: HTMLElement | null = el; cur !== world; cur = cur.offsetParent as HTMLElement | null) {
    if (!cur) return null
    const cs = getComputedStyle(cur)
    // absolute boxes sit at fractional Figma positions (172.33px…) that offsetTop would round
    if (cs.position === "absolute") {
      x += parseFloat(cs.left) || 0
      y += parseFloat(cs.top) || 0
    } else {
      x += cur.offsetLeft
      y += cur.offsetTop
    }
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight }
}

function sameLayout(a: Layout | null, b: Layout) {
  return !!a && JSON.stringify(a) === JSON.stringify(b)
}

const moved = (r: Rect, o: Offset): Rect => ({ ...r, x: r.x + o.x, y: r.y + o.y })

/** Escalation "+" relative to the Branch box (branch.svg's plus-circle; stack starts at 160/55). */
const BRANCH_PLUS = { x: 178.5, y: 35.5, size: 20 }
const BRANCH_PORT = { x: 188, y: 55 }
/** Branch steps' connector meets the card 28px in (under the icon). */
const BRANCH_INSET = 28

/**
 * Connector lines that no longer match the static assets (their two ends moved apart).
 * Each starts under the source's output handle and, for main-column edges, ends in an arrow
 * 8px above the target, exactly where connector.svg / vector-1598.svg end.
 */
function routeLines(nodes: FlowNode[], branch: FlowNode[], layout: Layout, off: (id: string) => Offset) {
  const lines: { key: string; d: string; arrow?: string; points: Point[] }[] = []
  const obstacles = [...nodes, ...branch].flatMap((n) => {
    const f = layout.frames[n.id]
    return f ? [moved(f, off(n.id))] : []
  })
  nodes.forEach((s, i) => {
    const t = nodes[i + 1]
    const fs = layout.frames[s.id]
    const ft = t && layout.frames[t.id]
    if (!t || !fs || !ft || sameOffset(off(s.id), off(t.id))) return
    const from = moved(fs, off(s.id))
    const to = moved(ft, off(t.id))
    const label = !!s.branchLabel
    const a = { x: from.x + from.w / 2, y: from.y + from.h + (label ? 1.34 : 2) }
    const b = { x: to.x + to.w / 2, y: to.y - 8 }
    // the "Need to escalate" pill sits 32–62px under the condition: keep its leg straight past it
    const points = routeDown(a, b, { firstLeg: label ? 73 : 16, lastLeg: 16, from, to, obstacles })
    lines.push({ key: `${s.id}>${t.id}`, d: roundedPath(points), arrow: arrowDown(b), points })
  })

  const owner = nodes.find((n) => n.branchLabel)
  if (owner && layout.branch) {
    const o = off(owner.id)
    const base = layout.branch
    let prev = {
      id: owner.id,
      offset: o,
      rect: { x: base.x + BRANCH_PLUS.x + o.x, y: base.y + BRANCH_PLUS.y + o.y, w: BRANCH_PLUS.size, h: BRANCH_PLUS.size },
      port: { x: base.x + BRANCH_PORT.x + o.x, y: base.y + BRANCH_PORT.y + o.y },
    }
    for (const n of branch) {
      const f = layout.frames[n.id]
      if (!f) break
      const rect = moved(f, off(n.id))
      if (!sameOffset(prev.offset, off(n.id))) {
        const b = { x: rect.x + BRANCH_INSET, y: rect.y }
        const points = routeDown(prev.port, b, { firstLeg: 10, lastLeg: 10, from: prev.rect, to: rect, obstacles })
        lines.push({ key: `${prev.id}>${n.id}`, d: roundedPath(points), points })
      }
      prev = { id: n.id, offset: off(n.id), rect, port: { x: rect.x + BRANCH_INSET, y: rect.y + rect.h } }
    }
  }
  return lines
}

/**
 * Figma 1:5327 — dotted canvas. World origin = horizontal centre of the canvas,
 * top edge; the node column is 328px wide and starts 172.33px down (as in Figma).
 */
export function FlowCanvas({
  nodes,
  branch,
  selectedId,
  offsets,
  onSelect,
  onMove,
  onAddMain,
  onAddBranch,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAskAI,
  fitOnMount,
  viewport,
  onViewportChange,
}: {
  nodes: FlowNode[]
  branch: FlowNode[]
  selectedId: string | null
  /** user moves, added to each node's computed position */
  offsets: Offsets
  onSelect: (id: string | null) => void
  /** commit a finished drag / nudge (one undo step; also selects the node) */
  onMove: (id: string, offset: Offset) => void
  onAddMain: () => void
  onAddBranch: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onAskAI: () => void
  /** below lg, fit the whole flow on screen when the canvas first appears */
  fitOnMount: boolean
  viewport: Viewport
  onViewportChange: (v: Viewport | ((v: Viewport) => Viewport)) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const suppressClick = useRef(false)
  const [panning, setPanning] = useState(false)
  const { x, y, z } = viewport

  /* --- Node offsets: committed (props) → settling animation → live drag on top --- */
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)", false)
  const [settle, setSettle] = useState<Settle>(() => ({ from: offsets, to: offsets, t: 1, start: null }))
  const [live, setLive] = useState<Live | null>(null)
  const [target, setTarget] = useState(offsets)
  const settled = settle.t >= 1 ? settle.to : lerpOffsets(settle.from, settle.to, easeOut(settle.t))
  const shown: Offsets = live ? { ...settled, [live.id]: live.offset } : settled
  if (target !== offsets) {
    // Committed offsets changed (drop, nudge, undo/redo): glide from what is on screen now.
    // A drop starts from the dropped position, so it doesn’t move; undo and redo animate.
    setTarget(offsets)
    setSettle({ from: shown, to: offsets, t: reduceMotion ? 1 : 0, start: null })
    if (live?.released) setLive(null)
  }
  useEffect(() => {
    if (settle.t >= 1) return
    const raf = requestAnimationFrame((now) =>
      setSettle((s) => {
        const start = s.start ?? now
        return { ...s, start, t: Math.min(1, (now - start) / SETTLE_MS) }
      }),
    )
    return () => cancelAnimationFrame(raf)
  }, [settle])
  const off = (id: string) => shown[id] ?? ZERO

  // Latest values for timers / window listeners
  const shownRef = useRef(shown)
  const viewportRef = useRef(viewport)
  useLayoutEffect(() => {
    shownRef.current = shown
    viewportRef.current = viewport
  })

  /* --- Base layout (the computed positions), measured from the untransformed DOM --- */
  const [layout, setLayout] = useState<Layout | null>(null)
  const measure = useCallback(() => {
    const world = worldRef.current
    if (!world) return
    const frames: Record<string, Rect> = {}
    world.querySelectorAll<HTMLElement>("[data-frame]").forEach((el) => {
      const box = worldBox(el, world)
      if (box && el.dataset.frame) frames[el.dataset.frame] = box
    })
    const b = world.querySelector<HTMLElement>("[data-branch]")
    const box = b && worldBox(b, world)
    const next: Layout = { frames, branch: box ? { x: box.x, y: box.y } : null }
    setLayout((prev) => (sameLayout(prev, next) ? prev : next))
  }, [])
  useLayoutEffect(measure, [measure, nodes, branch])
  useEffect(() => {
    const column = columnRef.current
    if (!column) return
    const ro = new ResizeObserver(measure) // font load / text wrap changes node heights
    ro.observe(column)
    return () => ro.disconnect()
  }, [measure])

  const lines = layout ? routeLines(nodes, branch, layout, off) : []
  const lineBox = lines.length ? bounds(lines.flatMap((l) => l.points)) : null

  const isSmallScreen = () => !window.matchMedia("(min-width: 1024px)").matches

  /** Show the whole flow (small screens); desktop keeps the Figma 1:1 view. */
  const resetView = () => {
    const canvas = ref.current
    const world = worldRef.current
    const fit = canvas && world && isSmallScreen() ? fitViewport(canvas, world, viewport) : null
    onViewportChange(fit ?? DEFAULT_VIEWPORT)
  }

  /*
   * Fit to screen on first load below lg (before paint, so the 1:1 view never flashes).
   * A cold load in a hidden or background tab can lay the canvas out at 0×0 (and report
   * matchMedia(lg) false), which would clamp the fit to the minimum zoom and stick. So
   * wait for a real size, and only count the canvas as fitted once one arrives.
   */
  const fitOnMountRef = useRef(fitOnMount)
  useLayoutEffect(() => {
    const canvas = ref.current
    if (!fitOnMountRef.current || !canvas) return
    const fitOnce = (width: number, height: number) => {
      const world = worldRef.current
      if (width < 1 || height < 1 || !world) return false
      fitOnMountRef.current = false
      if (!isSmallScreen()) return true
      const fit = fitViewport(canvas, world, DEFAULT_VIEWPORT)
      if (fit) onViewportChange(fit)
      return true
    }
    const { width, height } = canvas.getBoundingClientRect()
    if (fitOnce(width, height)) return
    const ro = new ResizeObserver(([entry]) => {
      if (entry && fitOnce(entry.contentRect.width, entry.contentRect.height)) ro.disconnect()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [onViewportChange])

  /** Zoom keeping the world point under (fx, fy) fixed — fx/fy in canvas pixels. */
  const zoomAt = (next: number, fx?: number, fy?: number) => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const px = fx ?? width / 2
    const py = fy ?? height / 2
    onViewportChange((v) => {
      const nz = clampZoom(next)
      const wx = (px - width / 2 - v.x) / v.z
      const wy = (py - v.y) / v.z
      return { z: nz, x: px - width / 2 - wx * nz, y: py - wy * nz }
    })
  }

  // Wheel: scroll pans, ⌘/Ctrl + wheel (and trackpad pinch) zooms. Needs a non-passive listener.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        const fx = e.clientX - rect.left
        const fy = e.clientY - rect.top
        const factor = Math.exp(-e.deltaY * 0.01)
        onViewportChange((v) => {
          const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z * factor))
          const wx = (fx - rect.width / 2 - v.x) / v.z
          const wy = (fy - v.y) / v.z
          return { z: nz, x: fx - rect.width / 2 - wx * nz, y: fy - wy * nz }
        })
      } else {
        onViewportChange((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [onViewportChange])

  /*
   * Node drag. The node follows the pointer through a transform, updated once per
   * animation frame (no transitions), and is committed as one undo step on release.
   */
  const drag = useRef<Drag | null>(null)
  const frame = useRef(0)
  const holdTimer = useRef(0)
  const clearHold = () => {
    window.clearTimeout(holdTimer.current)
    holdTimer.current = 0
  }
  const follow = useCallback((d: Drag, p: Point) => {
    d.at = p
    const { z: zoom } = viewportRef.current
    const raw = { x: d.origin.x + (p.x - d.start.x) / zoom, y: d.origin.y + (p.y - d.start.y) / zoom }
    d.offset = d.free ? { x: Math.round(raw.x) || 0, y: Math.round(raw.y) || 0 } : { x: snap(raw.x), y: snap(raw.y) }
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      if (drag.current === d) setLive({ id: d.id, offset: d.offset })
    })
  }, [])
  const cancelDrag = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
    drag.current = null
    setLive(null)
  }, [])
  const endDrag = () => {
    const d = drag.current
    cancelAnimationFrame(frame.current)
    frame.current = 0
    drag.current = null
    if (!d?.active) return // never moved: the click that follows selects as usual
    suppressClick.current = true
    if (sameOffset(d.offset, offsets[d.id] ?? ZERO)) {
      setLive(null)
      if (selectedId !== d.id) onSelect(d.id)
      return
    }
    // keep rendering the drop position until the committed offsets arrive (no snap-back frame)
    setLive({ id: d.id, offset: d.offset, released: true })
    onMove(d.id, d.offset)
  }
  // Touch: the hold timer fired with the finger still down and still → pick the node up
  const pickUp = (id: string, pointerId: number) => {
    holdTimer.current = 0
    const g = gesture.current
    const p = g?.pointers.get(pointerId)
    if (!g || !p || g.pointers.size !== 1 || g.moved) return
    gesture.current = null
    setPanning(false)
    const origin = shownRef.current[id] ?? ZERO
    drag.current = { id, pointerId, start: p, at: p, origin, active: true, free: false, offset: origin }
    setLive({ id, offset: origin })
    navigator.vibrate?.(10)
  }
  useEffect(() => () => {
    window.clearTimeout(holdTimer.current)
    cancelAnimationFrame(frame.current)
  }, [])

  // Keyboard: Esc cancels a drag, Alt toggles snapping mid-drag, Alt(+Shift)+arrows nudge a node
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = drag.current
      if (d?.active) {
        if (e.key === "Escape" && e.type === "keydown") {
          e.preventDefault()
          cancelDrag()
        } else if (e.key === "Alt") {
          d.free = e.type === "keydown"
          follow(d, d.at)
        }
        return
      }
      const dir = ARROWS[e.key]
      if (e.type !== "keydown" || !e.altKey || e.metaKey || e.ctrlKey || !dir) return
      const el = e.target instanceof Element ? e.target : null
      if (el?.closest("input, textarea, select, [contenteditable=true]")) return
      const focused = el?.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId
      const inCanvas = !el || el === document.body || !!ref.current?.contains(el)
      const id = focused ?? (inCanvas ? selectedId : null)
      if (!id || ![...nodes, ...branch].some((n) => n.id === id)) return
      e.preventDefault()
      const step = GRID * (e.shiftKey ? 4 : 1)
      const cur = offsets[id] ?? ZERO
      onMove(id, { x: cur.x + dir.x * step, y: cur.y + dir.y * step })
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKey)
    }
  }, [cancelDrag, follow, offsets, selectedId, nodes, branch, onMove])

  /*
   * Pan + pinch with pointer events. Mouse pans only from empty canvas (nodes and
   * + buttons stay clickable) and drags a node from its body; touch can pan or pinch
   * starting anywhere except the toolbar, and picks a node up after a 300ms hold —
   * a tap that didn't move still clicks whatever it landed on.
   */
  const local = (e: ReactPointerEvent): Point => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // React bubbles events from portalled tooltips and menus through this tree
    if (!e.currentTarget.contains(e.target as Node)) return
    const touch = e.pointerType !== "mouse"
    if (!touch && e.button !== 0) return
    const target = e.target as Element
    if (target.closest("[data-canvas-ui]")) return
    if (drag.current?.active) return // moving a node: other fingers neither pan nor pinch
    const nodeId = target.closest(NO_DRAG) ? undefined : target.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId
    const p = local(e)
    if (!touch && nodeId) {
      const origin = shown[nodeId] ?? ZERO
      drag.current = { id: nodeId, pointerId: e.pointerId, start: p, at: p, origin, active: false, free: e.altKey, offset: origin }
      suppressClick.current = false
      return
    }
    const onEmpty = !target.closest("[data-no-pan]")
    if (!touch && !onEmpty) return
    if (onEmpty) e.currentTarget.setPointerCapture(e.pointerId) // touch on a node is implicitly captured by it
    const g = gesture.current ?? { pointers: new Map(), onEmpty, moved: false, start: p, last: p, pinch: null }
    g.pointers.set(e.pointerId, p)
    if (g.pointers.size === 1) suppressClick.current = false
    if (g.pointers.size === 1 && nodeId) {
      const pointerId = e.pointerId
      holdTimer.current = window.setTimeout(() => pickUp(nodeId, pointerId), HOLD_MS)
    }
    if (g.pointers.size >= 2) {
      clearHold()
      g.moved = true
      g.pinch = pinchOf(g.pointers)
      setPanning(true)
    }
    gesture.current = g
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d && d.pointerId === e.pointerId) {
      const p = local(e)
      if (!d.active) {
        if (Math.hypot(p.x - d.start.x, p.y - d.start.y) < 3) return
        d.active = true
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      if (e.pointerType === "mouse") d.free = e.altKey
      follow(d, p)
      return
    }
    const g = gesture.current
    if (!g || !g.pointers.has(e.pointerId)) return
    const p = local(e)
    g.pointers.set(e.pointerId, p)

    if (g.pointers.size >= 2 && g.pinch) {
      const width = e.currentTarget.getBoundingClientRect().width
      const prev = g.pinch
      const next = pinchOf(g.pointers)
      g.pinch = next
      const ratio = prev.dist > 0 ? next.dist / prev.dist : 1
      // zoom about the previous midpoint, then follow the midpoint (two-finger pan)
      onViewportChange((v) => {
        const nz = clampZoomSmooth(v.z * ratio)
        const wx = (prev.mid.x - width / 2 - v.x) / v.z
        const wy = (prev.mid.y - v.y) / v.z
        return { z: nz, x: next.mid.x - width / 2 - wx * nz, y: next.mid.y - wy * nz }
      })
      return
    }

    const slop = e.pointerType === "mouse" ? 3 : 8
    if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < slop) return
    if (!g.moved) {
      clearHold() // it's a pan, not a hold
      g.moved = true
      g.last = g.start
      setPanning(true)
    }
    const dx = p.x - g.last.x
    const dy = p.y - g.last.y
    g.last = p
    onViewportChange((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d && d.pointerId === e.pointerId) {
      if (e.type === "pointercancel") {
        if (d.active) suppressClick.current = true
        cancelDrag()
      } else endDrag()
      return
    }
    const g = gesture.current
    if (!g || !g.pointers.has(e.pointerId)) return
    clearHold()
    g.pointers.delete(e.pointerId)
    if (g.pointers.size === 1) {
      // pinch → one finger left: keep panning from where it is
      g.pinch = null
      g.last = [...g.pointers.values()][0]
      return
    }
    if (g.pointers.size > 1) {
      g.pinch = pinchOf(g.pointers)
      return
    }
    gesture.current = null
    setPanning(false)
    suppressClick.current = g.moved
    if (!g.moved && g.onEmpty) onSelect(null) // click on empty canvas clears the selection
  }
  // A pan, pinch or node drag must not also click what it began on (keyboard clicks have detail 0)
  const onClickCapture = (e: ReactMouseEvent) => {
    if (!suppressClick.current || e.detail === 0) return
    suppressClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  // Dot grid (216.reversible tiles): 2px dots, 18px pitch, #282828 @ 20%, anchored to the world.
  const pitch = GRID * z
  const r = Math.max(0.5, z)
  const grid: CSSProperties = {
    backgroundImage: `radial-gradient(circle at center, var(--ea-dot) ${r * 0.75}px, transparent ${r * 1.25}px)`,
    backgroundSize: `${pitch}px ${pitch}px`,
    backgroundPosition: `calc(50% + ${x + 8 * z}px) ${y + 4 * z}px`,
  }

  const activeId = live && !live.released ? live.id : selectedId
  const owner = nodes.find((n) => n.branchLabel)

  return (
    <div
      ref={ref}
      className="ea-canvas relative h-full min-w-0 flex-1 overflow-hidden bg-(--ea-canvas)"
      style={grid}
      data-panning={panning}
      data-dragging={!!live && !live.released}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      aria-label="Flow editor canvas"
      role="application"
    >
      <div
        ref={worldRef}
        className="absolute top-0 left-1/2 origin-top-left will-change-transform"
        style={{ transform: `translate(${x}px, ${y}px) scale(${z})` }}
      >
        {/* Connectors whose ends were moved apart, routed under the nodes */}
        {lineBox && (
          <svg
            data-fit
            aria-hidden
            className="pointer-events-none absolute overflow-visible"
            style={{ left: lineBox.x - 8, top: lineBox.y - 8 }}
            width={lineBox.w + 16}
            height={lineBox.h + 16}
            viewBox={`${lineBox.x - 8} ${lineBox.y - 8} ${lineBox.w + 16} ${lineBox.h + 16}`}
            fill="none"
            stroke="#dddddd"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {lines.map((l) => (
              <g key={l.key}>
                <path d={l.d} />
                {l.arrow && <path d={l.arrow} />}
              </g>
            ))}
          </svg>
        )}

        <div ref={columnRef} className="absolute top-[172.33px] -left-[164px] flex w-[328px] flex-col items-center gap-2">
          {nodes.map((node, i) => {
            const last = i === nodes.length - 1
            const next = nodes[i + 1]
            return (
              <Segment
                key={node.id}
                node={node}
                last={last}
                offset={off(node.id)}
                routed={!!next && !sameOffset(off(node.id), off(next.id))}
                lifted={live?.id === node.id && !live.released}
                selected={activeId === node.id}
                onSelect={onSelect}
                onAdd={onAddMain}
                branch={
                  node === owner ? (
                    <Branch
                      nodes={branch}
                      ownerOffset={off(node.id)}
                      offsetOf={off}
                      activeId={activeId}
                      liftedId={live && !live.released ? live.id : null}
                      onSelect={onSelect}
                      onAdd={onAddBranch}
                    />
                  ) : undefined
                }
              />
            )
          })}
        </div>
      </div>

      <CanvasToolbar
        zoom={z}
        onZoomOut={() => zoomAt(z - 0.1)}
        onZoomIn={() => zoomAt(z + 0.1)}
        onReset={resetView}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onAskAI={onAskAI}
      />
    </div>
  )
}

/** Touch screens: grow the + buttons' hit area to 48px (world px) without moving the drawn icon. */
const TOUCH_HIT = "[@media(pointer:coarse)]:before:absolute [@media(pointer:coarse)]:before:-inset-3 [@media(pointer:coarse)]:before:rounded-full [@media(pointer:coarse)]:before:content-['']"

/**
 * Stacking for a node and what hangs off it, set on its outermost wrapper (pop-in wrappers are
 * stacking contexts): the dragged node floats above everything, a moved + selected one above
 * its neighbours. Unmoved nodes keep the original paint order.
 */
const lift = (lifted: boolean, selected: boolean, offset: Offset) =>
  lifted ? "z-10" : selected && !sameOffset(offset, ZERO) ? "z-[5]" : false

/** Output handle under a node (Frame 2147237826): 16×8 half-pill. */
const HANDLE = "absolute h-2 w-4 rounded-b-2xl border-t border-(--ea-line) bg-[#9dd9fb] shadow-[0px_2px_4px_0px_rgba(40,40,40,0.08)]"

/**
 * One node plus whatever hangs below it (connector, route label + branch, or the add button).
 * The handle, label, branch and + ride along with the node's offset; a connector whose two
 * ends moved apart hides its static line and is drawn by the canvas as a routed path instead.
 */
function Segment({
  node,
  last,
  offset,
  routed,
  lifted,
  selected,
  onSelect,
  onAdd,
  branch,
}: {
  node: FlowNode
  last: boolean
  offset: Offset
  /** the connector to the next node is routed (ends moved apart) */
  routed: boolean
  lifted: boolean
  selected: boolean
  onSelect: (id: string) => void
  onAdd: () => void
  branch?: ReactNode
}) {
  const isAgent = node.variant === "agent"
  const move = shift(offset)
  const raise = lift(lifted, selected, offset)
  return (
    <div className={cn("relative flex flex-col items-center", node.id.startsWith("node-") && "ea-pop-in", raise)}>
      {/* Agent cards sit in an 8px frame (Figma 1:9780) so the selection halo has room */}
      <div data-frame={node.id} className={cn(isAgent && "p-2", last && "mb-[-1px]")} style={move}>
        <NodeCard node={node} selected={selected} lifted={lifted} onSelect={onSelect} />
      </div>

      {last ? (
        // Group 2147291561 — blue output handle, line, plus-circle (connector-end.svg 24×95)
        <div className="relative h-[93px] w-6" style={move}>
          <Asset name="connector-end.svg" width={24} height={95} className="absolute -top-0.5 left-0" />
          <Tip label="Add a step" side="bottom">
            <button
              type="button"
              data-no-pan
              aria-label="Add a step after this node"
              onClick={onAdd}
              className={cn("absolute top-[69px] left-0 size-6 cursor-pointer rounded-full transition-colors duration-150 hover:bg-(--ea-blue-soft)", TOUCH_HIT)}
            />
          </Tip>
        </div>
      ) : node.branchLabel ? (
        <RouteLabel label={node.branchLabel} routed={routed} style={move} />
      ) : (
        // Group 2147291558 — output handle + arrow (connector.svg 24×72.5 in a 16×70 slot)
        <div className="relative h-[70px] w-4" style={move}>
          <Asset name="connector.svg" width={24} height={72.5} className={cn("absolute -top-0.5 -left-1", routed && "invisible")} />
          {routed && <span className={cn(HANDLE, "top-0 left-0")} />}
        </div>
      )}

      {branch}
    </div>
  )
}

/** Group 2147291558 (1:9774): handle, long arrow and the "Need to escalate" pill. */
function RouteLabel({
  label,
  routed,
  style,
}: {
  label: string
  routed: boolean
  style?: CSSProperties
}) {
  return (
    <div className="relative h-[91.34px] w-[132px]" style={style}>
      <Asset name="vector-1598.svg" width={7.36396} height={91} className={cn("absolute top-[0.84px] left-[62.32px]", routed && "invisible")} />
      <span className={cn(HANDLE, "top-0 left-[58px]")} />
      <span className="absolute top-8 left-0 flex h-[30px] items-center rounded-[10px] bg-linear-to-b from-white to-[#f7f7f7] px-3 py-2 text-(--ea-fg-muted) shadow-(--ea-shadow-control) text-[14px] leading-none font-medium tracking-[-0.28px] whitespace-nowrap">
        {label}
      </span>
    </div>
  )
}

/**
 * Group 2147291562 (1:9810): dashed escalation route to the right with its own
 * plus-circle. Positioned exactly as in Figma relative to the condition node and
 * moves with it. Added branch steps stack under the plus, indented so the line meets
 * the icon; each can be moved on its own.
 */
function Branch({
  nodes,
  ownerOffset,
  offsetOf,
  activeId,
  liftedId,
  onSelect,
  onAdd,
}: {
  nodes: FlowNode[]
  ownerOffset: Offset
  offsetOf: (id: string) => Offset
  activeId: string | null
  liftedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
}) {
  const move = shift(ownerOffset)
  return (
    <div data-branch className="absolute top-[101.67px] left-[230px] h-[57px] w-[200px]">
      <Asset name="branch.svg" width={200.5} height={57.5} className="absolute -top-[0.5px] -left-[0.5px]" style={move} />
      <Tip label="Add an escalation step" side="right">
        <button
          type="button"
          data-no-pan
          aria-label="Add a step to the escalation route"
          onClick={onAdd}
          style={move}
          className={cn("absolute top-[33px] left-[176px] size-6 cursor-pointer rounded-full transition-colors duration-150 hover:bg-(--ea-blue-soft)", TOUCH_HIT)}
        />
      </Tip>
      {nodes.length > 0 && (
        <div className="absolute top-[55px] left-[160px] flex flex-col items-start">
          {nodes.map((n, i) => {
            const from = i === 0 ? ownerOffset : offsetOf(nodes[i - 1].id)
            const own = offsetOf(n.id)
            const routed = !sameOffset(from, own)
            const lifted = liftedId === n.id
            const raise = lift(lifted, activeId === n.id, own)
            return (
              <div key={n.id} className={cn("ea-pop-in flex flex-col items-start", raise && `relative ${raise}`)}>
                <span
                  aria-hidden
                  className={cn("ml-[27.5px] h-5 w-px bg-[#dddddd]", routed && "invisible")}
                  style={routed ? undefined : shift(from)}
                />
                <div data-frame={n.id} style={shift(own)}>
                  <NodeCard node={n} selected={activeId === n.id} lifted={lifted} onSelect={onSelect} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NodeCard({
  node,
  selected,
  lifted,
  onSelect,
}: {
  node: FlowNode
  selected: boolean
  /** being dragged: lifted shadow (touch: the hold registered) */
  lifted: boolean
  onSelect: (id: string) => void
}) {
  const common = {
    type: "button" as const,
    "data-no-pan": true,
    "data-node-id": node.id,
    "data-lifted": lifted || undefined,
    "aria-pressed": selected,
    "aria-keyshortcuts": "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight",
    onClick: () => onSelect(node.id),
    // touch long-press picks the node up; don't open the context menu / callout too
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  }

  if (node.variant === "agent") {
    return (
      <button {...common} className="ea-node ea-node-agent flex w-[312px] flex-col items-start gap-5 px-4 py-3 text-left">
        <span className="flex w-full flex-col gap-1.5 text-[14px] leading-none font-medium tracking-[-0.28px]">
          <span className="whitespace-nowrap text-(--ea-fg-node)">{node.title}</span>
          <span className="text-(--ea-fg-placeholder)">{node.description}</span>
        </span>
        <NodeIcon icon={node.icon} />
      </button>
    )
  }

  return (
    <button {...common} className="ea-node flex w-[328px] items-center gap-2 px-4 py-3 text-left">
      <NodeIcon icon={node.icon} />
      <span className="text-[14px] leading-none font-medium tracking-[-0.28px] whitespace-nowrap text-(--ea-fg-node)">
        {node.title}
      </span>
    </button>
  )
}

function NodeIcon({ icon }: { icon: FlowNode["icon"] }) {
  if (icon.kind === "chip") {
    return (
      <Chip color={icon.color} size={24} radius={8}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon.src} alt="" aria-hidden width={12} height={12} className="block max-w-none" />
      </Chip>
    )
  }
  return (
    <span className="flex items-start gap-1.5">
      {icon.apps.map((app) => (
        <span key={app} className="ea-app-icon">
          {app === "gmail" ? <Asset name="gmail.svg" size={16} /> : <Asset name="slack.svg" size={13} />}
        </span>
      ))}
    </span>
  )
}
