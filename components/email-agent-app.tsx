"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  INITIAL_MESSAGES,
  SUGGESTION_PROMPT,
  mockReply,
  type ChatMessage,
  type ModelName,
  type TabId,
} from "@/lib/data"
import { useFlowHistory, type FlowState } from "@/lib/use-flow-history"
import { BREAKPOINTS, useMediaQuery, useVisualViewport } from "@/lib/use-media-query"
import { TopBar } from "./top-bar"
import { AssistantPanel } from "./assistant-panel"
import { DEFAULT_VIEWPORT, FlowCanvas, type Viewport } from "./flow-canvas"
import { SettingsPanel, TasksPanel } from "./placeholder-panels"

const signature = (s: FlowState) => [...s.nodes, ...s.branch].map((n) => n.id).join("|")

let msgSeq = 0
const nextId = () => `m-${++msgSeq}`

/**
 * Figma 1:5204 — "Kargul’s Email Agent" builder. Owns all prototype state.
 *
 * ≥1024px (lg): the AI Assistant is a docked 440px column that collapses to 0.
 * <1024px:      it becomes a full-height sheet over the canvas (scrim, Esc, close button).
 */
export function EmailAgentApp() {
  const flow = useFlowHistory()
  const isDesktop = useMediaQuery(BREAKPOINTS.lg)
  const visible = useVisualViewport()
  const [tab, setTab] = useState<TabId>("flow")
  const [panelOpen, setPanelOpen] = useState(true) // docked column (lg+)
  const [sheetOpen, setSheetOpen] = useState(false) // sheet (< lg)
  const [starred, setStarred] = useState(true)
  const [testing, setTesting] = useState(false)
  const [publishedSig, setPublishedSig] = useState<string | null>(null)
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT)
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [typing, setTyping] = useState(false)
  const [model, setModel] = useState<ModelName>("Mercurio 3.6")
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])

  const published = publishedSig === signature(flow.state)
  const assistantOpen = isDesktop ? panelOpen : sheetOpen
  const sheetShown = !isDesktop && sheetOpen
  // The sheet takes focus when it opens; Esc hands it back to the menu button
  const openSheet = () => {
    flushSync(() => setSheetOpen(true))
    sheetRef.current?.focus({ preventScroll: true })
  }
  const closeSheet = (restoreFocus = false) => {
    flushSync(() => setSheetOpen(false))
    if (restoreFocus) document.querySelector<HTMLElement>('[aria-controls="ea-assistant"]')?.focus({ preventScroll: true })
  }
  const togglePanel = () => {
    if (isDesktop) setPanelOpen((o) => !o)
    else if (sheetOpen) closeSheet()
    else openSheet()
  }
  const closePanel = () => (isDesktop ? setPanelOpen(false) : closeSheet())

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((t) => window.clearTimeout(t))
  }, [])
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const send = (text: string) => {
    setMessages((m) => [...m, { id: nextId(), role: "user", text }])
    setTyping(true)
    later(() => {
      setTyping(false)
      setMessages((m) => [...m, { id: nextId(), role: "assistant", kind: "text", text: mockReply(text) }])
    }, 900 + Math.min(text.length * 12, 900))
  }

  const focusComposer = () => {
    // open first, then focus inside the same tap so iOS raises the keyboard
    if (!assistantOpen) flushSync(() => (isDesktop ? setPanelOpen(true) : setSheetOpen(true)))
    composerRef.current?.focus({ preventScroll: true })
  }

  const { undo, redo } = flow
  // ⌘Z / ⇧⌘Z on the canvas (not while typing)
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      // Esc closes the assistant sheet (menus inside it close themselves first)
      if (e.key === "Escape" && sheetShown) {
        if (!(e.target instanceof Element && e.target.closest("[role=menu]"))) closeSheet(true)
        return
      }
      const typingInField = e.target instanceof Element && e.target.closest("input, textarea, [contenteditable=true]")
      if (typingInField || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    },
    [undo, redo, sheetShown],
  )
  useEffect(() => {
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onKey])

  return (
    <div className="email-agent flex h-dvh flex-col gap-[2px] overflow-hidden lg:min-h-[640px] lg:min-w-[1024px]">
      <div inert={sheetShown} className="contents">
        <TopBar
          tab={tab}
          onTabChange={setTab}
          panelOpen={assistantOpen}
          onTogglePanel={togglePanel}
          published={published}
          starred={starred}
          onToggleStar={() => setStarred((s) => !s)}
          onShare={() => {
            void navigator.clipboard?.writeText(window.location.href).catch(() => {})
            toast.success("Link copied", { description: "Anyone in your workspace can open this agent." })
          }}
          testing={testing}
          onTest={() => {
            setTesting(true)
            toast("Test run started", { description: "Sending a sample email through the flow…" })
            later(() => {
              setTesting(false)
              toast.success("Test passed", { description: "KB had an answer → Route 1 replied in 1.8s." })
            }, 1600)
          }}
          onPublish={() => {
            setPublishedSig(signature(flow.state))
            toast.success("Changes published", { description: "Kargul’s Email Agent is live for new emails." })
          }}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sheet scrim (< lg only) */}
        <div
          aria-hidden
          onClick={() => closeSheet()}
          className={cn(
            "fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ease-out motion-reduce:transition-none lg:hidden",
            sheetOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />

        {/*
          AI Assistant. ≥ lg: docked column that collapses to 0 (menu button reopens), 440 + 2px white seam.
          < lg: full-height sheet from the left; sized to the visible viewport so the composer
          stays above the on-screen keyboard. Open state is CSS-driven per breakpoint (no flash on load).
        */}
        <div
          id="ea-assistant"
          ref={sheetRef}
          tabIndex={-1}
          role={sheetShown ? "dialog" : undefined}
          aria-modal={sheetShown || undefined}
          aria-label={sheetShown ? "AI Assistant" : undefined}
          inert={!assistantOpen}
          aria-hidden={!assistantOpen}
          style={sheetShown && visible ? { top: visible.top, height: visible.height } : undefined}
          className={cn(
            "fixed top-0 left-0 z-50 h-dvh outline-none w-full max-w-[440px] -translate-x-full overflow-hidden transition-[translate,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            sheetOpen && "translate-x-0 shadow-[16px_0_48px_-8px_rgba(9,9,11,0.24)]",
            "lg:static lg:z-auto lg:h-full lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none lg:transition-[width] lg:duration-200 lg:ease-[cubic-bezier(0.23,1,0.32,1)]",
            panelOpen ? "lg:w-[442px]" : "lg:w-0",
            "motion-reduce:transition-none",
          )}
        >
          <AssistantPanel
            messages={messages}
            typing={typing}
            model={model}
            onModelChange={(m) => {
              setModel(m)
              toast(`Switched to ${m}`)
            }}
            onSend={send}
            onSuggest={() => send(SUGGESTION_PROMPT)}
            onClear={() => setMessages(INITIAL_MESSAGES)}
            onClose={closePanel}
            composerRef={composerRef}
          />
        </div>

        <main inert={sheetShown} id="ea-main" role="tabpanel" aria-labelledby={`ea-tab-${tab}`} className="flex min-w-0 flex-1">
          {tab === "flow" && (
            <FlowCanvas
              nodes={flow.state.nodes}
              branch={flow.state.branch}
              selectedId={flow.state.selectedId}
              offsets={flow.state.offsets}
              onSelect={flow.select}
              onMove={flow.move}
              onTidy={flow.tidy}
              onAddMain={flow.addMain}
              onAddBranch={flow.addBranch}
              canUndo={flow.canUndo}
              canRedo={flow.canRedo}
              onUndo={flow.undo}
              onRedo={flow.redo}
              onAskAI={focusComposer}
              fitOnMount={viewport === DEFAULT_VIEWPORT}
              viewport={viewport}
              onViewportChange={setViewport}
            />
          )}
          {tab === "settings" && <SettingsPanel />}
          {tab === "tasks" && <TasksPanel />}
        </main>
      </div>
    </div>
  )
}
