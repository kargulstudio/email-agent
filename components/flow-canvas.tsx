"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { cn } from "@/lib/utils"
import type { FlowNode } from "@/lib/data"
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
  world.querySelectorAll("button, img").forEach((el) => {
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

type Point = { x: number; y: number }
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

/**
 * Figma 1:5327 — dotted canvas. World origin = horizontal centre of the canvas,
 * top edge; the node column is 328px wide and starts 172.33px down (as in Figma).
 */
export function FlowCanvas({
  nodes,
  branch,
  selectedId,
  onSelect,
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
  onSelect: (id: string | null) => void
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
  const gesture = useRef<Gesture | null>(null)
  const suppressClick = useRef(false)
  const [panning, setPanning] = useState(false)
  const { x, y, z } = viewport

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
   * Pan + pinch with pointer events. Mouse pans only from empty canvas (nodes and
   * + buttons stay clickable); touch can pan or pinch starting anywhere except the
   * toolbar — a tap that didn't move still clicks whatever it landed on.
   */
  const local = (e: ReactPointerEvent): Point => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const touch = e.pointerType !== "mouse"
    if (!touch && e.button !== 0) return
    const target = e.target as Element
    if (target.closest("[data-canvas-ui]")) return
    const onEmpty = !target.closest("[data-no-pan]")
    if (!touch && !onEmpty) return
    if (onEmpty) e.currentTarget.setPointerCapture(e.pointerId) // touch on a node is implicitly captured by it
    const p = local(e)
    const g = gesture.current ?? { pointers: new Map(), onEmpty, moved: false, start: p, last: p, pinch: null }
    g.pointers.set(e.pointerId, p)
    if (g.pointers.size === 1) suppressClick.current = false
    if (g.pointers.size >= 2) {
      g.moved = true
      g.pinch = pinchOf(g.pointers)
      setPanning(true)
    }
    gesture.current = g
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
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
    const g = gesture.current
    if (!g || !g.pointers.has(e.pointerId)) return
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
  // A pan or pinch that began on a node must not also select it (keyboard clicks have detail 0)
  const onClickCapture = (e: ReactMouseEvent) => {
    if (!suppressClick.current || e.detail === 0) return
    suppressClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  // Dot grid (216.reversible tiles): 2px dots, 18px pitch, #282828 @ 20%, anchored to the world.
  const pitch = 18 * z
  const r = Math.max(0.5, z)
  const grid: CSSProperties = {
    backgroundImage: `radial-gradient(circle at center, var(--ea-dot) ${r * 0.75}px, transparent ${r * 1.25}px)`,
    backgroundSize: `${pitch}px ${pitch}px`,
    backgroundPosition: `calc(50% + ${x + 8 * z}px) ${y + 4 * z}px`,
  }

  return (
    <div
      ref={ref}
      className="ea-canvas relative h-full min-w-0 flex-1 overflow-hidden bg-(--ea-canvas)"
      style={grid}
      data-panning={panning}
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
        <div className="absolute top-[172.33px] -left-[164px] flex w-[328px] flex-col items-center gap-2">
          {nodes.map((node, i) => {
            const last = i === nodes.length - 1
            return (
              <Segment
                key={node.id}
                node={node}
                last={last}
                selected={selectedId === node.id}
                onSelect={onSelect}
                onAdd={onAddMain}
                branch={node.branchLabel ? branch : undefined}
                selectedId={selectedId}
                onAddBranch={onAddBranch}
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

/** One node plus whatever hangs below it (connector, route label + branch, or the add button). */
function Segment({
  node,
  last,
  selected,
  onSelect,
  onAdd,
  branch,
  selectedId,
  onAddBranch,
}: {
  node: FlowNode
  last: boolean
  selected: boolean
  onSelect: (id: string) => void
  onAdd: () => void
  branch?: FlowNode[]
  selectedId: string | null
  onAddBranch: () => void
}) {
  const isAgent = node.variant === "agent"
  return (
    <div className={cn("relative flex flex-col items-center", node.id.startsWith("node-") && "ea-pop-in")}>
      {/* Agent cards sit in an 8px frame (Figma 1:9780) so the selection halo has room */}
      <div className={cn(isAgent && "p-2", last && "mb-[-1px]")}>
        <NodeCard node={node} selected={selected} onSelect={onSelect} />
      </div>

      {last ? (
        // Group 2147291561 — blue output handle, line, plus-circle (connector-end.svg 24×95)
        <div className="relative h-[93px] w-6">
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
        <RouteLabel label={node.branchLabel} />
      ) : (
        // Group 2147291558 — output handle + arrow (connector.svg 24×72.5 in a 16×70 slot)
        <div className="relative h-[70px] w-4">
          <Asset name="connector.svg" width={24} height={72.5} className="absolute -top-0.5 -left-1" />
        </div>
      )}

      {branch && <Branch nodes={branch} selectedId={selectedId} onSelect={onSelect} onAdd={onAddBranch} />}
    </div>
  )
}

/** Group 2147291558 (1:9774): handle, long arrow and the "Need to escalate" pill. */
function RouteLabel({ label }: { label: string }) {
  return (
    <div className="relative h-[91.34px] w-[132px]">
      <Asset name="vector-1598.svg" width={7.36396} height={91} className="absolute top-[0.84px] left-[62.32px]" />
      <span className="absolute top-0 left-[58px] h-2 w-4 rounded-b-2xl border-t border-(--ea-line) bg-[#9dd9fb] shadow-[0px_2px_4px_0px_rgba(40,40,40,0.08)]" />
      <span className="absolute top-8 left-0 flex h-[30px] items-center rounded-[10px] bg-linear-to-b from-white to-[#f7f7f7] px-3 py-2 text-(--ea-fg-muted) shadow-(--ea-shadow-control) text-[14px] leading-none font-medium tracking-[-0.28px] whitespace-nowrap">
        {label}
      </span>
    </div>
  )
}

/**
 * Group 2147291562 (1:9810): dashed escalation route to the right with its own
 * plus-circle. Positioned exactly as in Figma relative to the condition node.
 * Added branch steps stack under the plus, indented so the line meets the icon.
 */
function Branch({
  nodes,
  selectedId,
  onSelect,
  onAdd,
}: {
  nodes: FlowNode[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
}) {
  return (
    <div className="absolute top-[101.67px] left-[230px] h-[57px] w-[200px]">
      <Asset name="branch.svg" width={200.5} height={57.5} className="absolute -top-[0.5px] -left-[0.5px]" />
      <Tip label="Add an escalation step" side="right">
        <button
          type="button"
          data-no-pan
          aria-label="Add a step to the escalation route"
          onClick={onAdd}
          className={cn("absolute top-[33px] left-[176px] size-6 cursor-pointer rounded-full transition-colors duration-150 hover:bg-(--ea-blue-soft)", TOUCH_HIT)}
        />
      </Tip>
      {nodes.length > 0 && (
        <div className="absolute top-[55px] left-[160px] flex flex-col items-start">
          {nodes.map((n) => (
            <div key={n.id} className="ea-pop-in flex flex-col items-start">
              <span aria-hidden className="ml-[27.5px] h-5 w-px bg-[#dddddd]" />
              <NodeCard node={n} selected={selectedId === n.id} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NodeCard({
  node,
  selected,
  onSelect,
}: {
  node: FlowNode
  selected: boolean
  onSelect: (id: string) => void
}) {
  const common = {
    type: "button" as const,
    "data-no-pan": true,
    "aria-pressed": selected,
    onClick: () => onSelect(node.id),
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
