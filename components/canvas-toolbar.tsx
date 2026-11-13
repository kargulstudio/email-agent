"use client"

import { AlignCenterVerticalIcon } from "lucide-react"
import { IconButton, PrimaryButton, Tip } from "./primitives"

/**
 * Figma 1:9711 — floating zoom / history / Ask AI bar, 24px above the canvas bottom.
 * Compact below lg (40px targets, tighter padding); phones pinch to zoom, so −/+ hide below sm.
 * Tidy up puts every moved node back in its computed place (disabled until something moved).
 */
export function CanvasToolbar({
  zoom,
  onZoomOut,
  onZoomIn,
  onReset,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canTidy,
  onTidy,
  onAskAI,
}: {
  zoom: number
  onZoomOut: () => void
  onZoomIn: () => void
  onReset: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  canTidy: boolean
  onTidy: () => void
  onAskAI: () => void
}) {
  return (
    <div
      data-no-pan
      data-canvas-ui
      role="toolbar"
      aria-label="Canvas controls"
      className="absolute bottom-4 left-1/2 flex -translate-x-1/2 cursor-default items-center gap-1 overflow-clip rounded-[16px] bg-linear-to-b from-[#fcfcfc] from-30% to-[#f5f5f5] p-1.5 shadow-[inset_0px_0px_0px_1.4px_rgba(236,236,236,0.8),0px_1px_4px_0px_rgba(0,0,0,0.02),0px_4px_12px_0px_rgba(0,0,0,0.04)] lg:bottom-6 lg:gap-2 lg:rounded-[20px] lg:p-4"
    >
      <IconButton icon="minus.svg" label="Zoom out" side="top" onClick={onZoomOut} className="max-sm:hidden" />
      <Tip label="Reset view" side="top">
        <button
          type="button"
          onClick={onReset}
          aria-label={`Zoom ${Math.round(zoom * 100)}%, reset view`}
          className="cursor-pointer rounded-md px-0.5 max-lg:flex max-lg:min-h-10 max-lg:min-w-12 max-lg:items-center max-lg:justify-center font-(family-name:--font-inter) text-[14px] leading-none font-medium tracking-[-0.28px] whitespace-nowrap text-(--ea-fg-muted) tabular-nums transition-colors duration-150 hover:text-(--ea-fg)"
        >
          {Math.round(zoom * 100)}%
        </button>
      </Tip>
      <IconButton icon="plus.svg" label="Zoom in" side="top" onClick={onZoomIn} className="max-sm:hidden" />
      <span aria-hidden className="h-3 w-px bg-(--ea-divider)" />
      <IconButton icon="reverse-left.svg" label="Undo (⌘Z)" side="top" onClick={onUndo} aria-disabled={!canUndo} />
      <IconButton icon="reverse-right.svg" label="Redo (⇧⌘Z)" side="top" onClick={onRedo} aria-disabled={!canRedo} />
      <Tip label={canTidy ? "Tidy up" : "Tidy up (nothing moved)"} side="top">
        <button
          type="button"
          aria-label="Tidy up: reset node positions"
          aria-disabled={!canTidy}
          onClick={() => canTidy && onTidy()}
          className="ea-control size-[30px] p-2 max-lg:size-10 aria-disabled:cursor-default aria-disabled:opacity-50"
        >
          <AlignCenterVerticalIcon aria-hidden className="size-3.5 text-[#a2a2a2]" strokeWidth={2} />
        </button>
      </Tip>
      <span aria-hidden className="h-3 w-px bg-(--ea-divider)" />
      <PrimaryButton icon="stars-01-ask.svg" onClick={onAskAI} className="max-lg:h-10">
        Ask AI
      </PrimaryButton>
    </div>
  )
}
