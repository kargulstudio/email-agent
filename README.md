# Email Agent

> [!IMPORTANT]
> **Design prototype only.** No backend, no API and no auth. Everything is mock data in `lib/`, and nothing you do is saved.

An AI agent builder for "Kargul's Email Agent": an AI Assistant chat panel on the left and the agent's flow on a canvas.

Built from Figma file `ZKxOvLKOz4VYG21iEqjG4l`, node `1-5204` ([open in Figma](https://www.figma.com/design/ZKxOvLKOz4VYG21iEqjG4l/Untitled?node-id=1-5204)).

## Run it

```bash
pnpm install
```

```bash
pnpm dev
```

Open <http://localhost:3000>. The design is authored at **1440 × 1024**, so that viewport matches Figma 1:1.

Other scripts: `pnpm build` · `pnpm start` · `pnpm lint`

## What works

- **Tabs**: Flow editor, Settings and Tasks
- **AI Assistant**: send a message (<kbd>Enter</kbd>) to get a typing indicator and a canned reply. The panel closes and reopens from the menu button
- **Canvas**: click a node to select it, and use the + buttons to add steps. Drag empty canvas or scroll to pan; zoom with −/+ or <kbd>⌘</kbd>+wheel
- **Move nodes**: drag a node by its body (not its icons) to put it anywhere. On touch, press and hold a node for about 300ms, then drag; a one-finger drag that starts right away still pans
  - Moves snap to the 18px dot grid. Hold <kbd>⌥</kbd>/<kbd>Alt</kbd> while dragging to place freely, and press <kbd>Esc</kbd> to cancel
  - <kbd>⌥</kbd>+arrow keys nudge the focused or selected node one grid step (<kbd>⇧⌥</kbd>+arrows: four)
  - Connectors, the "Need to escalate" route and the + buttons follow live, re-routed as rounded right-angle paths (around the nodes when a step sits above the one before it)
- **Undo / redo** for adding, selecting and moving nodes (toolbar or <kbd>⌘Z</kbd> / <kbd>⇧⌘Z</kbd>)
- **Publish changes** flips Draft to Published; **Ask AI** focuses the composer
- **Mobile and tablet** (below 1024px): a compact top bar (actions in a "…" menu), the AI Assistant as a full-height sheet, and a canvas that fits to the screen with touch pan and pinch-zoom
- No real AI calls are made

## Stack

- **Next.js 16** (App Router, React 19)
- **Tailwind CSS v4** with design tokens in `app/globals.css` (adapted from Statsnap) plus app tokens in `app/email-agent.css`
- **shadcn/ui on Base UI** primitives in `components/ui`
- **lucide-react** icons; every Figma icon, logo and image is a local file in `public/figma/`

## Project layout

| Path | What it is |
| --- | --- |
| [`components/email-agent-app.tsx`](components/email-agent-app.tsx) | App shell and state |
| [`components/top-bar.tsx`](components/top-bar.tsx) | Agent name, tabs, Share, Test and Publish |
| [`components/assistant-panel.tsx`](components/assistant-panel.tsx) | AI Assistant thread, changelog and composer |
| [`components/flow-canvas.tsx`](components/flow-canvas.tsx) | Flow nodes, connectors, pan and zoom, node dragging |
| [`components/canvas-toolbar.tsx`](components/canvas-toolbar.tsx) | Zoom, undo/redo and Ask AI |
| [`components/placeholder-panels.tsx`](components/placeholder-panels.tsx) | Settings and Tasks tabs |
| [`components/primitives.tsx`](components/primitives.tsx) | Shared buttons and icons |
| [`lib/data.ts`](lib/data.ts) | Mock flow, changelog, tasks and canned replies |
| [`lib/use-flow-history.ts`](lib/use-flow-history.ts) | Undo/redo history for the flow, including node offsets |
| [`lib/flow-routing.ts`](lib/flow-routing.ts) | Right-angle connector routing with rounded corners |
