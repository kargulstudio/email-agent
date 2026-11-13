"use client"

import { useEffect, useRef, useState, type KeyboardEvent, type Ref } from "react"
import { CheckIcon, CopyIcon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CHANGELOG, MODELS, type ChatMessage, type ModelName } from "@/lib/data"
import { Asset, Chip, IconButton, Tip } from "./primitives"

const TEXT = "text-[14px] font-medium tracking-[-0.28px] text-(--ea-fg-body)"
const HEADING = "text-[16px] leading-[1.48] font-semibold tracking-[-0.32px] text-(--ea-fg-body)"

/** Figma 1:5262 — 440px AI Assistant panel (header, thread, composer). */
export function AssistantPanel({
  messages,
  typing,
  model,
  onModelChange,
  onSend,
  onSuggest,
  onClear,
  onClose,
  composerRef,
}: {
  messages: ChatMessage[]
  typing: boolean
  model: ModelName
  onModelChange: (m: ModelName) => void
  onSend: (text: string) => void
  onSuggest: () => void
  onClear: () => void
  onClose: () => void
  composerRef: Ref<HTMLTextAreaElement>
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // keep the newest message in view — but open on the changelog's first line, as in Figma
  const seenRef = useRef({ length: messages.length, typing })
  useEffect(() => {
    const seen = seenRef.current
    if (seen.length === messages.length && seen.typing === typing) return
    seenRef.current = { length: messages.length, typing }
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages.length, typing])

  return (
    <div className="flex h-full w-[440px] flex-col gap-[2px] bg-(--ea-page)">
      {/* Header (1:5263) */}
      <div className="flex h-[54px] shrink-0 items-center gap-2 border-b border-(--ea-line) bg-(--ea-panel) px-4 py-3">
        <Chip color="var(--ea-blue)" size={14} radius={4}>
          <Asset name="stars-01-white.svg" size={10} />
        </Chip>
        <h2 className="min-w-0 flex-1 text-[14px] leading-none font-medium tracking-[-0.21px] text-(--ea-fg-title)">
          AI Assistant
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" aria-label="Assistant options" className="ea-control size-[30px] p-2">
                <Asset name="dots-horizontal.svg" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard?.writeText(changelogAsText()).catch(() => {})
                toast.success("Changelog copied")
              }}
            >
              <CopyIcon className="text-(--ea-fg-muted)" />
              Copy changelog
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onClear}>
              <RotateCcwIcon className="text-(--ea-fg-muted)" />
              Clear conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton icon="magic-wand-01.svg" label="Suggest improvements" onClick={onSuggest} />
        <IconButton icon="x-close.svg" label="Close assistant" onClick={onClose} />
      </div>

      {/* Body (Frame 18) */}
      <div className="relative flex min-h-0 flex-1 flex-col bg-(--ea-panel) pb-5 after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-(--ea-line)">
        <div ref={scrollRef} className="ea-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-4" aria-live="polite">
          <div className="flex flex-col gap-6 px-2 pb-2">
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
            {typing && (
              <div className="ea-msg-in ea-typing flex h-6 items-center gap-1" aria-label="Assistant is typing">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </div>
        <Composer ref={composerRef} onSend={onSend} model={model} onModelChange={onModelChange} disabled={typing} />
      </div>
    </div>
  )
}

function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="ea-msg-in flex justify-end">
        <p
          className={cn(
            TEXT,
            "max-w-[85%] rounded-2xl rounded-br-md bg-white px-3 py-2.5 leading-[1.5] whitespace-pre-wrap shadow-[0px_1px_2px_0px_rgba(40,40,40,0.06),0px_0px_0px_1px_var(--ea-line)]",
          )}
        >
          {message.text}
        </p>
      </div>
    )
  }
  if (message.kind === "text") {
    return <p className={cn(TEXT, "ea-msg-in leading-[22px]")}>{message.text}</p>
  }
  return <Changelog />
}

/** Figma 1:5279 — rich changelog with emoji headings, bullets and routes. */
function Changelog() {
  const c = CHANGELOG
  return (
    <article className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h3 className={HEADING}>{c.title}</h3>
        <p className={cn(TEXT, "leading-[22px]")}>{c.intro}</p>
        <div className="flex flex-col gap-2.5 pl-2">
          <ul className={cn(TEXT, "list-disc leading-[22px]")}>
            {c.bullets.map((b) => (
              <li key={b} className="ms-[21px]">
                {b}
              </li>
            ))}
          </ul>
          <div className={cn(TEXT, "pl-5 leading-[22px]")}>
            {c.routes.map((r) => (
              <p key={r}>{r}</p>
            ))}
          </div>
          <ul className={cn(TEXT, "list-disc leading-[22px]")}>
            <li className="ms-[21px]">{c.trailing}</li>
          </ul>
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className={cn(HEADING, "whitespace-pre-wrap")}>{c.flowTitle}</h3>
        <p className={cn(TEXT, "leading-[22px]")}>{c.flow}</p>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className={HEADING}>{c.importantTitle}</h3>
        <p className={cn(TEXT, "leading-[22px]")}>{c.important}</p>
        <ul className={cn(TEXT, "list-disc pl-2 leading-[22px]")}>
          {c.todo.map((t) => (
            <li key={t} className="ms-[21px]">
              {t}
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}

function changelogAsText() {
  const c = CHANGELOG
  return [
    c.title,
    c.intro,
    ...c.bullets.map((b) => `• ${b}`),
    ...c.routes.map((r) => `  ${r}`),
    `• ${c.trailing}`,
    "",
    c.flowTitle,
    c.flow,
    "",
    c.importantTitle,
    c.important,
    ...c.todo.map((t) => `• ${t}`),
  ].join("\n")
}

/** Figma 1:5301 — chat composer with tool row, send button and model footer. */
function Composer({
  ref,
  onSend,
  model,
  onModelChange,
  disabled,
}: {
  ref: Ref<HTMLTextAreaElement>
  onSend: (text: string) => void
  model: ModelName
  onModelChange: (m: ModelName) => void
  disabled: boolean
}) {
  const [value, setValue] = useState("")
  const localRef = useRef<HTMLTextAreaElement | null>(null)

  const submit = () => {
    const text = value.trim()
    if (!text) {
      localRef.current?.focus()
      return
    }
    if (disabled) return
    onSend(text)
    setValue("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="mx-4 mt-4 flex shrink-0 flex-col gap-1 rounded-[24px] bg-linear-to-b from-[#f5f5f5] to-[#ededed] p-1.5">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex flex-col gap-9 overflow-clip rounded-[20px] bg-linear-to-b from-[#fcfcfc] from-[33.472%] to-[#f7f7f7] p-4 shadow-[inset_0px_0px_0px_1.4px_#ffffff] transition-shadow duration-150 focus-within:shadow-[inset_0px_0px_0px_1.4px_#ffffff,0px_0px_0px_1px_var(--ea-blue-ring)]"
      >
        <label htmlFor="ea-composer" className="sr-only">
          Message the AI Assistant
        </label>
        <textarea
          id="ea-composer"
          ref={(node) => {
            localRef.current = node
            if (typeof ref === "function") ref(node)
            else if (ref) ref.current = node
          }}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ready to help, ask anything..."
          className="-my-[3px] max-h-[120px] min-h-5 w-full resize-none bg-transparent text-[14px] leading-5 font-medium tracking-[-0.28px] text-(--ea-fg-body) outline-none [field-sizing:content] placeholder:text-(--ea-fg-placeholder)"
        />
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <IconButton icon="plus.svg" label="Add context" side="top" onClick={() => toast("Context picker coming soon")} />
            <IconButton icon="paperclip.svg" label="Attach a file" side="top" onClick={() => toast("Attachments are disabled in this prototype")} />
            <IconButton icon="microphone-02.svg" label="Dictate" side="top" onClick={() => toast("Voice input is disabled in this prototype")} />
          </div>
          <Tip label="Send (Enter)" side="top">
            <button
              type="button"
              onClick={submit}
              aria-label="Send message"
              disabled={disabled}
              className="relative size-[30px] shrink-0 cursor-pointer rounded-[10px] transition-opacity duration-150 hover:opacity-90 active:opacity-80 disabled:cursor-default disabled:opacity-60"
            >
              <Asset name="send-button.svg" size={38} className="absolute -top-0.5 -left-1" />
            </button>
          </Tip>
        </div>
      </form>

      {/* Model footer (1:5320) */}
      <div className="flex items-center gap-2 rounded-md px-4 py-3">
        <p className="flex flex-1 items-center gap-1 text-[14px] leading-[1.25] font-medium tracking-[-0.28px] whitespace-nowrap [font-feature-settings:'salt'_1,'liga'_0]">
          <span className="text-(--ea-fg)">Aisso</span>
          <span className="text-(--ea-fg)">-</span>
          <span className="text-(--ea-fg-muted)">{model}</span>
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Choose model"
                className="flex size-[14px] cursor-pointer items-center justify-center rounded-sm opacity-100 transition-opacity hover:opacity-70"
              >
                <Asset name="dots-horizontal.svg" />
              </button>
            }
          />
          <DropdownMenuContent align="end" side="top" className="w-44">
            {MODELS.map((m) => (
              <DropdownMenuItem key={m} onClick={() => onModelChange(m)}>
                <CheckIcon className={cn("text-(--ea-blue)", m !== model && "invisible")} />
                {m}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
