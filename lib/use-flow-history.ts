"use client"

import { useCallback, useReducer } from "react"
import {
  BRANCH_TEMPLATES,
  INITIAL_NODES,
  INITIAL_SELECTED,
  MAIN_TEMPLATES,
  type FlowNode,
} from "@/lib/data"

/** A user drag, in world px, added to a node's computed position. */
export type Offset = { x: number; y: number }
/** Offsets keyed by node id. Nodes that were never moved (or were tidied) have no entry. */
export type Offsets = Readonly<Record<string, Offset>>

export const ZERO: Offset = { x: 0, y: 0 }
export const sameOffset = (a: Offset, b: Offset) => a.x === b.x && a.y === b.y

export type FlowState = {
  nodes: FlowNode[]
  /** Nodes hanging off the condition's dashed "Need to escalate" branch. */
  branch: FlowNode[]
  selectedId: string | null
  offsets: Offsets
  /** Monotonic counter so every added node gets a stable, unique id. */
  seq: number
}

type History = { past: FlowState[]; present: FlowState; future: FlowState[] }

type Action =
  | { type: "select"; id: string | null }
  | { type: "add"; where: "main" | "branch" }
  | { type: "move"; id: string; offset: Offset }
  | { type: "tidy" }
  | { type: "undo" }
  | { type: "redo" }

const LIMIT = 100

const initial: History = {
  past: [],
  present: { nodes: INITIAL_NODES, branch: [], selectedId: INITIAL_SELECTED, offsets: {}, seq: 0 },
  future: [],
}

function commit(h: History, next: FlowState): History {
  return { past: [...h.past, h.present].slice(-LIMIT), present: next, future: [] }
}

function withOffset(offsets: Offsets, id: string, offset: Offset): Offsets {
  const next: Record<string, Offset> = { ...offsets }
  if (sameOffset(offset, ZERO)) delete next[id]
  else next[id] = offset
  return next
}

function reducer(h: History, action: Action): History {
  const s = h.present
  switch (action.type) {
    case "select":
      if (s.selectedId === action.id) return h
      return commit(h, { ...s, selectedId: action.id })
    case "add": {
      const seq = s.seq + 1
      const id = `node-${seq}`
      if (action.where === "main") {
        const tpl = MAIN_TEMPLATES[(seq - 1) % MAIN_TEMPLATES.length]
        return commit(h, { ...s, seq, nodes: [...s.nodes, { ...tpl, id }], selectedId: id })
      }
      const tpl = BRANCH_TEMPLATES[s.branch.length % BRANCH_TEMPLATES.length]
      return commit(h, { ...s, seq, branch: [...s.branch, { ...tpl, id }], selectedId: id })
    }
    case "move": {
      // One drag (or nudge) = one step; moving a node also selects it
      const same = sameOffset(s.offsets[action.id] ?? ZERO, action.offset)
      if (same && s.selectedId === action.id) return h
      return commit(h, { ...s, offsets: withOffset(s.offsets, action.id, action.offset), selectedId: action.id })
    }
    case "tidy":
      if (!Object.keys(s.offsets).length) return h
      return commit(h, { ...s, offsets: {} })
    case "undo": {
      if (!h.past.length) return h
      const prev = h.past[h.past.length - 1]
      return { past: h.past.slice(0, -1), present: prev, future: [s, ...h.future] }
    }
    case "redo": {
      if (!h.future.length) return h
      const [next, ...rest] = h.future
      return { past: [...h.past, s], present: next, future: rest }
    }
  }
}

/** Undoable flow state: node additions, selection changes, node moves and tidy-ups. */
export function useFlowHistory() {
  const [history, dispatch] = useReducer(reducer, initial)

  const select = useCallback((id: string | null) => dispatch({ type: "select", id }), [])
  const addMain = useCallback(() => dispatch({ type: "add", where: "main" }), [])
  const addBranch = useCallback(() => dispatch({ type: "add", where: "branch" }), [])
  const move = useCallback((id: string, offset: Offset) => dispatch({ type: "move", id, offset }), [])
  const tidy = useCallback(() => dispatch({ type: "tidy" }), [])
  const undo = useCallback(() => dispatch({ type: "undo" }), [])
  const redo = useCallback(() => dispatch({ type: "redo" }), [])

  return {
    state: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    select,
    addMain,
    addBranch,
    move,
    tidy,
    undo,
    redo,
  }
}
