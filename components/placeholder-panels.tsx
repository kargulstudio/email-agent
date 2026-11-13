"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { TASKS } from "@/lib/data"
import { Asset } from "./primitives"

const CARD =
  "w-full max-w-[640px] rounded-2xl bg-white shadow-[0px_1px_2px_0px_rgba(40,40,40,0.04),0px_0px_0px_1px_var(--ea-line)]"

/** Settings tab — simple prototype panel (not in the Figma frame). One column; tighter padding on phones. */
export function SettingsPanel() {
  const [settings, setSettings] = useState({ autoReply: true, escalate: true, signature: false })
  const rows: { key: keyof typeof settings; title: string; body: string }[] = [
    { key: "autoReply", title: "Reply automatically", body: "Send the drafted reply when the Knowledge Base has an answer." },
    { key: "escalate", title: "Escalate to Slack", body: "Alert #support when the agent can’t find an answer." },
    { key: "signature", title: "Add signature", body: "Append your Gmail signature to every reply." },
  ]
  return (
    <div className="flex h-full flex-1 justify-center overflow-y-auto bg-(--ea-canvas) px-4 py-4 sm:px-6 sm:py-10">
      <section className={CARD} aria-labelledby="ea-settings-title">
        <header className="border-b border-(--ea-line) px-4 py-4 sm:px-5">
          <h2 id="ea-settings-title" className="text-[16px] leading-none font-semibold tracking-[-0.32px] text-(--ea-fg-body)">
            Agent settings
          </h2>
          <p className="mt-2 text-[14px] leading-[1.4] font-medium tracking-[-0.28px] text-(--ea-fg-muted)">
            How Kargul’s Email Agent behaves once published.
          </p>
        </header>
        <ul>
          {rows.map((r, i) => (
            <li
              key={r.key}
              className={cn("flex items-center gap-4 px-4 py-4 sm:px-5", i > 0 && "border-t border-(--ea-line)")}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] leading-none font-medium tracking-[-0.28px] text-(--ea-fg-node)">{r.title}</p>
                <p className="mt-1.5 text-[13px] leading-[1.4] font-medium text-(--ea-fg-placeholder)">{r.body}</p>
              </div>
              <Switch
                aria-label={r.title}
                checked={settings[r.key]}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, [r.key]: v }))}
                className="data-checked:bg-(--ea-blue)"
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** Tasks tab — recent runs of the agent (mock). Below sm the time moves under the subject. */
export function TasksPanel() {
  return (
    <div className="flex h-full flex-1 justify-center overflow-y-auto bg-(--ea-canvas) px-4 py-4 sm:px-6 sm:py-10">
      <section className={CARD} aria-labelledby="ea-tasks-title">
        <header className="flex items-center justify-between border-b border-(--ea-line) px-4 py-4 sm:px-5">
          <h2 id="ea-tasks-title" className="text-[16px] leading-none font-semibold tracking-[-0.32px] text-(--ea-fg-body)">
            Recent tasks
          </h2>
          <span className="text-[13px] leading-none font-medium text-(--ea-fg-muted)">Last 24 hours</span>
        </header>
        <ul>
          {TASKS.map((t, i) => (
            <li key={t.id} className={cn("flex items-center gap-3 px-4 py-3.5 sm:px-5", i > 0 && "border-t border-(--ea-line)")}>
              <span className="ea-app-icon">
                <Asset name="gmail.svg" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] leading-none font-medium tracking-[-0.28px] text-(--ea-fg-node)">
                  {t.subject}
                </p>
                <p className="mt-1.5 truncate text-[13px] leading-none font-medium text-(--ea-fg-placeholder)">
                  {t.from}
                  <span className="tabular-nums sm:hidden"> · {t.time}</span>
                </p>
              </div>
              <span
                className={cn(
                  "rounded-md px-1.5 py-1 text-[12px] leading-none font-medium tracking-[-0.24px]",
                  t.route === "Replied" ? "bg-(--ea-teal-soft) text-(--ea-teal)" : "bg-(--ea-amber-soft) text-[#b7840a]",
                )}
              >
                {t.route}
              </span>
              <span className="hidden w-16 text-right text-[13px] leading-none font-medium text-(--ea-fg-muted) tabular-nums sm:block">
                {t.time}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
