/**
 * Mock data for the Email Agent builder (Figma node 1:5204).
 * Everything here is static — no network, no real AI.
 */

export const ASSET = (name: string) => `/figma/${name}`

/* ---------------------------------------------------------------------------
 * Flow graph
 * ------------------------------------------------------------------------ */

/** How the node's leading icon is drawn. */
export type NodeIcon =
  | { kind: "app"; apps: ("gmail" | "slack")[] } // bordered 24×24 box(es) with brand logo
  | { kind: "chip"; color: string; src: string } // coloured 24×24 chip with white glyph

export type FlowNode = {
  id: string
  title: string
  /** Agent-style cards (Figma 1:9781) show a description + app row instead of a leading icon. */
  variant: "step" | "agent"
  description?: string
  icon: NodeIcon
  /** Condition nodes carry the "Need to escalate" route label + dashed branch. */
  branchLabel?: string
}

export const INITIAL_NODES: FlowNode[] = [
  {
    id: "email-received",
    title: "Email received",
    variant: "step",
    icon: { kind: "app", apps: ["gmail"] },
  },
  {
    id: "search-kb",
    title: "Search knowledge base",
    variant: "step",
    icon: { kind: "chip", color: "var(--ea-teal)", src: ASSET("book-search.svg") },
  },
  {
    id: "answer-found",
    title: "Answer found in KB?",
    variant: "step",
    icon: { kind: "chip", color: "var(--ea-orange)", src: ASSET("dataflow-04.svg") },
    branchLabel: "Need to escalate",
  },
  {
    id: "email-response-agent",
    title: "Email response agent",
    variant: "agent",
    description: "Replies to emails using your Knowledge Base",
    icon: { kind: "app", apps: ["gmail", "slack"] },
  },
]

export const INITIAL_SELECTED = "email-response-agent"

/** Mock steps handed out (in order) by the + buttons on the canvas. */
export const MAIN_TEMPLATES: Omit<FlowNode, "id">[] = [
  {
    title: "Log reply in CRM",
    variant: "step",
    icon: { kind: "chip", color: "var(--ea-violet)", src: ASSET("dataflow-04.svg") },
  },
  {
    title: "Search knowledge base",
    variant: "step",
    icon: { kind: "chip", color: "var(--ea-teal)", src: ASSET("book-search.svg") },
  },
  {
    title: "Send follow-up email",
    variant: "step",
    icon: { kind: "app", apps: ["gmail"] },
  },
]

export const BRANCH_TEMPLATES: Omit<FlowNode, "id">[] = [
  {
    title: "Escalation agent",
    variant: "agent",
    description: "Acknowledges the email and alerts the team",
    icon: { kind: "app", apps: ["gmail", "slack"] },
  },
  {
    title: "Notify #support on Slack",
    variant: "step",
    icon: { kind: "app", apps: ["slack"] },
  },
]

/* ---------------------------------------------------------------------------
 * AI assistant
 * ------------------------------------------------------------------------ */

export type ChatMessage =
  | { id: string; role: "assistant"; kind: "changelog" }
  | { id: string; role: "assistant"; kind: "text"; text: string }
  | { id: string; role: "user"; text: string }

export const INITIAL_MESSAGES: ChatMessage[] = [{ id: "m-changelog", role: "assistant", kind: "changelog" }]

/** Rich changelog shown in the thread (Figma 1:5279). */
export const CHANGELOG = {
  title: "✨ Changelog",
  intro: "Here’s what I updated",
  bullets: [
    "Added a Knowledge Base search step so the AI can look through uploaded documents before answering.",
    "Added a Condition node to verify whether the Knowledge Base found a useful answer.",
    "Created two response routes:",
  ],
  routes: [
    "✅ Route 1: If the KB finds the answer → AI sends a helpful reply directly.",
    "⚠️ Route 2: If the KB does not have the answer → AI sends an acknowledgment and alerts you on Slack.",
  ],
  trailing: "Improved the agent instructions so the agent can use Knowledge Base results more accurately and intelligently.",
  flowTitle: "📩  Flow",
  flow: "Gmail trigger → Search Knowledge Base → Check result → AI either replies directly or acknowledges the email and escalates it to Slack.",
  importantTitle: "🚨 Important",
  important:
    "You need to upload documents into your Knowledge Base first for this workflow to function properly. The agent will use those documents as the main source for answering incoming emails.",
  todo: [
    "Upload relevant files to the Knowledge Base, such as FAQs, policies, guides, or product information.",
    "Send a sample email to test whether the routing logic works correctly.",
    "Set up Slack notification details, including which channel or person should receive the alert.",
  ],
}

const REPLIES: { match: RegExp; text: string }[] = [
  {
    match: /slack|escalat|alert/i,
    text: "Got it. Escalations go to #support on Slack with the sender, subject and a one-line summary. Want me to tag an on-call person as well?",
  },
  {
    match: /test|try|sample/i,
    text: "Hit Test in the top bar and I’ll send a sample email through the flow. You’ll see which route it takes and the reply the agent drafts.",
  },
  {
    match: /knowledge|kb|document|upload/i,
    text: "The Knowledge Base search runs before every reply. Upload FAQs, policies or product docs and I’ll index them automatically. PDFs, Markdown and Google Docs all work.",
  },
  {
    match: /tone|friendly|formal|style/i,
    text: "Updated the agent instructions: replies now stay warm and concise, sign off with your name, and never promise refunds without escalating.",
  },
]

const FALLBACK = [
  "Done. I’ve noted that in the agent instructions. Publish changes when you’re ready and it’ll apply to new emails.",
  "Makes sense. I can add a step for that. Use the + under the last node, or tell me where it should go in the flow.",
  "Sure. The flow stays the same; only the Email response agent prompt changes. Anything else you’d like to adjust?",
]

let fallbackIndex = 0
export function mockReply(prompt: string): string {
  const hit = REPLIES.find((r) => r.match.test(prompt))
  if (hit) return hit.text
  const text = FALLBACK[fallbackIndex % FALLBACK.length]
  fallbackIndex += 1
  return text
}

export const SUGGESTION_PROMPT = "Suggest improvements to this flow"

export const MODELS = ["Mercurio 3.6", "Mercurio 3.5", "Mercurio Mini"] as const
export type ModelName = (typeof MODELS)[number]

/* ---------------------------------------------------------------------------
 * Placeholder tabs
 * ------------------------------------------------------------------------ */

export type TabId = "flow" | "settings" | "tasks"

export const TASKS = [
  { id: "t1", subject: "Refund for order #4821", from: "maria@northwind.co", route: "Replied", time: "2m ago" },
  { id: "t2", subject: "Can’t log in after password reset", from: "dev@acme.io", route: "Escalated", time: "14m ago" },
  { id: "t3", subject: "Do you ship to Canada?", from: "sam.k@gmail.com", route: "Replied", time: "1h ago" },
  { id: "t4", subject: "Invoice copy for March", from: "billing@globex.com", route: "Replied", time: "3h ago" },
  { id: "t5", subject: "Partnership enquiry", from: "hello@initech.com", route: "Escalated", time: "Yesterday" },
] as const
