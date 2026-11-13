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
import { TopBar } from "./top-bar"
import { AssistantPanel } from "./assistant-panel"
import { DEFAULT_VIEWPORT, FlowCanvas, type Viewport } from "./flow-canvas"
import { SettingsPanel, TasksPanel } from "./placeholder-panels"

const signature = (s: FlowState) => [...s.nodes, ...s.branch].map((n) => n.id).join("|")

let msgSeq = 0
const nextId = () => `m-${++msgSeq}`

/** Figma 1:5204 — "Kargul’s Email Agent" builder. Owns all prototype state. */
export function EmailAgentApp() {
  const flow = useFlowHistory()
  const [tab, setTab] = useState<TabId>("flow")
  const [panelOpen, setPanelOpen] = useState(true)
  const [starred, setStarred] = useState(true)
  const [testing, setTesting] = useState(false)
  const [publishedSig, setPublishedSig] = useState<string | null>(null)
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT)
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [typing, setTyping] = useState(false)
  const [model, setModel] = useState<ModelName>("Mercurio 3.6")
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const timers = useRef<number[]>([])

  const published = publishedSig === signature(flow.state)

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
    if (!panelOpen) flushSync(() => setPanelOpen(true))
    composerRef.current?.focus({ preventScroll: true })
  }

  const { undo, redo } = flow
  // ⌘Z / ⇧⌘Z on the canvas (not while typing)
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const typingInField = e.target instanceof Element && e.target.closest("input, textarea, [contenteditable=true]")
      if (typingInField || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    },
    [undo, redo],
  )
  useEffect(() => {
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onKey])

  return (
    <div className="email-agent flex h-dvh min-h-[640px] min-w-[1024px] flex-col gap-[2px] overflow-hidden">
      <TopBar
        tab={tab}
        onTabChange={setTab}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((o) => !o)}
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

      <div className="flex min-h-0 flex-1">
        {/* AI Assistant: collapses to 0 (menu button reopens). 440 + 2px white seam. */}
        <div
          id="ea-assistant"
          inert={!panelOpen}
          aria-hidden={!panelOpen}
          className={cn(
            "h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
            panelOpen ? "w-[442px]" : "w-0",
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
            onClose={() => setPanelOpen(false)}
            composerRef={composerRef}
          />
        </div>

        <main id="ea-main" role="tabpanel" aria-labelledby={`ea-tab-${tab}`} className="flex min-w-0 flex-1">
          {tab === "flow" && (
            <FlowCanvas
              nodes={flow.state.nodes}
              branch={flow.state.branch}
              selectedId={flow.state.selectedId}
              onSelect={flow.select}
              onAddMain={flow.addMain}
              onAddBranch={flow.addBranch}
              canUndo={flow.canUndo}
              canRedo={flow.canRedo}
              onUndo={flow.undo}
              onRedo={flow.redo}
              onAskAI={focusComposer}
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
