"use client"

import { CheckIcon, PlayIcon, Share2Icon, StarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { TabId } from "@/lib/data"
import { Asset, Chip, IconButton, MaskIcon, PrimaryButton, Tip } from "./primitives"

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "flow", label: "Flow editor", icon: "dataflow-03.svg" },
  { id: "settings", label: "Settings", icon: "settings-01.svg" },
  { id: "tasks", label: "Tasks", icon: "book-closed.svg" },
]

/**
 * Figma 1:5206 — 54px top bar on #F5F5F5 with a 1px #ECECEC bottom rule.
 * < lg: agent name over its status, a "…" menu (Share, Test, Favourite) and Publish;
 * the view tabs wrap onto a full-width segmented row underneath.
 */
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
    <header className="relative flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-(--ea-line) bg-(--ea-bar) px-3 py-2 lg:h-[54px] lg:flex-nowrap lg:gap-0 lg:px-4 lg:py-3">
      {/* Left: menu + agent identity */}
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none">
        <IconButton
          icon="menu.svg"
          label={panelOpen ? "Hide AI Assistant" : "Show AI Assistant"}
          aria-expanded={panelOpen}
          aria-controls="ea-assistant"
          onClick={onTogglePanel}
          className="max-lg:size-9"
        />
        <div className="flex min-w-0 flex-col items-start gap-1 max-lg:gap-0.5 rounded-full lg:h-[30px] lg:flex-row lg:items-center lg:gap-3 lg:p-2">
          <div className="flex min-w-0 max-w-full items-center gap-1.5">
            <Chip color="var(--ea-teal)" size={14} radius={4}>
              <Asset name="mail-02.svg" size={10} />
            </Chip>
            <h1 className="truncate text-[14px] leading-none font-medium tracking-[-0.28px] whitespace-nowrap text-(--ea-fg-title)">
              Kargul’s Email Agent
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              role="status"
              className={cn(
                "flex items-center gap-1 rounded-md text-[12px] leading-none font-medium tracking-[-0.24px] whitespace-nowrap transition-colors duration-150 lg:h-6 lg:p-1.5",
                published ? "text-(--ea-teal) lg:bg-(--ea-teal-soft)" : "text-(--ea-blue) lg:bg-(--ea-blue-soft)",
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
                  "hidden size-6 cursor-pointer items-center justify-center rounded-md lg:flex transition-[background-color,filter,opacity] duration-150",
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
        className="order-last flex w-full items-center rounded-[10px] bg-(--ea-segment) lg:absolute lg:top-3 lg:left-[calc(50%+0.5px)] lg:order-none lg:w-auto lg:-translate-x-1/2"
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
                "flex h-9 flex-1 items-center justify-center gap-1 p-2 text-[14px] lg:h-[30px] lg:flex-none leading-none font-medium tracking-[-0.28px] whitespace-nowrap",
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

      {/* Right: Share | Test, Publish  (< lg: "…" menu + Publish) */}
      <div className="flex shrink-0 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" aria-label="More actions" className="ea-control size-9 p-2 lg:hidden">
                <Asset name="dots-horizontal.svg" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem className="min-h-10" onClick={onShare}>
              <Share2Icon className="text-(--ea-fg-muted)" />
              Copy share link
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-10" onClick={onTest} disabled={testing}>
              <PlayIcon className="text-(--ea-fg-muted)" />
              {testing ? "Testing…" : "Run a test"}
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-10" onClick={onToggleStar}>
              <StarIcon className={cn(starred ? "fill-[#f6b30f] text-[#f6b30f]" : "text-(--ea-fg-muted)")} />
              {starred ? "Remove from favourites" : "Add to favourites"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={onShare}
          className="ea-control hidden h-[30px] gap-[7px] lg:inline-flex px-3 py-2 text-[14px] leading-none font-medium tracking-[-0.28px]"
        >
          <Asset name="share-06.svg" />
          Share
        </button>
        <span aria-hidden className="hidden h-3 w-px bg-(--ea-divider) lg:block" />
        <button
          type="button"
          onClick={onTest}
          disabled={testing}
          className="ea-control hidden h-[30px] gap-1.5 lg:inline-flex px-3 py-2 text-[14px] leading-none font-medium tracking-[-0.28px]"
        >
          <Asset name="play-circle.svg" className={cn(testing && "animate-pulse")} />
          {testing ? "Testing…" : "Test"}
        </button>
        <PrimaryButton icon="arrow-narrow-up.svg" onClick={onPublish} disabled={published} className="max-lg:h-9 max-lg:px-3">
          {published ? (
            "Published"
          ) : (
            <>
              Publish<span className="hidden sm:inline"> changes</span>
            </>
          )}
        </PrimaryButton>
      </div>
    </header>
  )
}
