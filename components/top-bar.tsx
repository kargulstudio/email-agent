"use client"

import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TabId } from "@/lib/data"
import { Asset, Chip, IconButton, MaskIcon, PrimaryButton, Tip } from "./primitives"

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "flow", label: "Flow editor", icon: "dataflow-03.svg" },
  { id: "settings", label: "Settings", icon: "settings-01.svg" },
  { id: "tasks", label: "Tasks", icon: "book-closed.svg" },
]

/** Figma 1:5206 — 54px top bar on #F5F5F5 with a 1px #ECECEC bottom rule. */
export function TopBar({
  tab,
  onTabChange,
  panelOpen,
  onTogglePanel,
  published,
  starred,
  onToggleStar,
  onShare,
  onTest,
  testing,
  onPublish,
}: {
  tab: TabId
  onTabChange: (tab: TabId) => void
  panelOpen: boolean
  onTogglePanel: () => void
  published: boolean
  starred: boolean
  onToggleStar: () => void
  onShare: () => void
  onTest: () => void
  testing: boolean
  onPublish: () => void
}) {
  return (
    <header className="relative flex h-[54px] shrink-0 items-center justify-between border-b border-(--ea-line) bg-(--ea-bar) px-4 py-3">
      {/* Left: menu + agent identity */}
      <div className="flex items-center gap-2">
        <IconButton
          icon="menu-02.svg"
          label={panelOpen ? "Hide AI Assistant" : "Show AI Assistant"}
          aria-expanded={panelOpen}
          aria-controls="ea-assistant"
          onClick={onTogglePanel}
        />
        <div className="flex h-[30px] items-center gap-3 rounded-full p-2">
          <div className="flex items-center gap-1.5">
            <Chip color="var(--ea-teal)" size={14} radius={4}>
              <Asset name="mail-02.svg" size={10} />
            </Chip>
            <h1 className="text-[14px] leading-none font-medium tracking-[-0.28px] whitespace-nowrap text-(--ea-fg-title)">
              Kargul’s Email Agent
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              role="status"
              className={cn(
                "flex h-6 items-center gap-1 rounded-md p-1.5 text-[12px] leading-none font-medium tracking-[-0.24px] whitespace-nowrap transition-colors duration-150",
                published ? "bg-(--ea-teal-soft) text-(--ea-teal)" : "bg-(--ea-blue-soft) text-(--ea-blue)",
              )}
            >
              {published ? (
                <CheckIcon className="size-3" strokeWidth={2.25} aria-hidden />
              ) : (
                <Asset name="loading-02.svg" size={12} />
              )}
              {published ? "Published" : "Draft"}
            </span>
            <Tip label={starred ? "Remove from favourites" : "Add to favourites"}>
              <button
                type="button"
                aria-pressed={starred}
                aria-label="Favourite agent"
                onClick={onToggleStar}
                className={cn(
                  "flex size-6 cursor-pointer items-center justify-center rounded-md transition-[background-color,filter,opacity] duration-150",
                  starred ? "bg-(--ea-amber-soft)" : "bg-black/[0.04] opacity-70 grayscale hover:opacity-100",
                )}
              >
                <Asset name="star-01.svg" size={12} />
              </button>
            </Tip>
          </div>
        </div>
      </div>

      {/* Centre: segmented Flow editor / Settings / Tasks (Figma 1:5242) */}
      <div
        role="tablist"
        aria-label="Agent views"
        className="absolute top-3 left-[calc(50%+0.5px)] flex -translate-x-1/2 items-center rounded-[10px] bg-(--ea-segment)"
      >
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`ea-tab-${t.id}`}
              aria-selected={active}
              aria-controls="ea-main"
              onClick={() => onTabChange(t.id)}
              className={cn(
                "flex h-[30px] items-center gap-1 p-2 text-[14px] leading-none font-medium tracking-[-0.28px] whitespace-nowrap",
                active
                  ? "ea-control text-(--ea-fg)"
                  : "cursor-pointer rounded-md text-(--ea-fg-muted) transition-colors duration-150 hover:text-(--ea-fg)",
              )}
            >
              <MaskIcon name={t.icon} className={active ? "text-(--ea-fg)" : "text-(--ea-icon-tab)"} />
              <span className="px-0.5">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Right: Share | Test, Publish */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onShare}
          className="ea-control h-[30px] gap-[7px] px-3 py-2 text-[14px] leading-none font-medium tracking-[-0.28px]"
        >
          <Asset name="share-06.svg" />
          Share
        </button>
        <span aria-hidden className="h-3 w-px bg-(--ea-divider)" />
        <button
          type="button"
          onClick={onTest}
          disabled={testing}
          className="ea-control h-[30px] gap-1.5 px-3 py-2 text-[14px] leading-none font-medium tracking-[-0.28px]"
        >
          <Asset name="play-circle.svg" className={cn(testing && "animate-pulse")} />
          {testing ? "Testing…" : "Test"}
        </button>
        <PrimaryButton icon="arrow-narrow-up.svg" onClick={onPublish} disabled={published}>
          {published ? "Published" : "Publish changes"}
        </PrimaryButton>
      </div>
    </header>
  )
}
