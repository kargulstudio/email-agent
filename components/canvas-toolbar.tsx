"use client"

import { IconButton, PrimaryButton, Tip } from "./primitives"

/** Figma 1:9711 — floating zoom / history / Ask AI bar, 24px above the canvas bottom. */
export function CanvasToolbar({
  zoom,
  onZoomOut,
  onZoomIn,
  onReset,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
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
  onAskAI: () => void
}) {
  return (
    <div
      data-no-pan
      role="toolbar"
      aria-label="Canvas controls"
      className="absolute bottom-6 left-1/2 flex -translate-x-1/2 cursor-default items-center gap-2 overflow-clip rounded-[20px] bg-linear-to-b from-[#fcfcfc] from-30% to-[#f5f5f5] p-4 shadow-[inset_0px_0px_0px_1.4px_rgba(236,236,236,0.8),0px_1px_4px_0px_rgba(0,0,0,0.02),0px_4px_12px_0px_rgba(0,0,0,0.04)]"
    >
      <IconButton icon="minus.svg" label="Zoom out" side="top" onClick={onZoomOut} />
      <Tip label="Reset view" side="top">
        <button
          type="button"
          onClick={onReset}
          aria-label={`Zoom ${Math.round(zoom * 100)}%, reset view`}
          className="cursor-pointer rounded-md px-0.5 font-(family-name:--font-inter) text-[14px] leading-none font-medium tracking-[-0.28px] whitespace-nowrap text-(--ea-fg-muted) tabular-nums transition-colors duration-150 hover:text-(--ea-fg)"
        >
          {Math.round(zoom * 100)}%
        </button>
      </Tip>
      <IconButton icon="plus.svg" label="Zoom in" side="top" onClick={onZoomIn} />
      <span aria-hidden className="h-3 w-px bg-(--ea-divider)" />
      <IconButton icon="reverse-left.svg" label="Undo (⌘Z)" side="top" onClick={onUndo} aria-disabled={!canUndo} />
      <IconButton icon="reverse-right.svg" label="Redo (⇧⌘Z)" side="top" onClick={onRedo} aria-disabled={!canRedo} />
      <span aria-hidden className="h-3 w-px bg-(--ea-divider)" />
      <PrimaryButton icon="stars-01-ask.svg" onClick={onAskAI}>
        Ask AI
      </PrimaryButton>
    </div>
  )
}
