"use client"

import { useSyncExternalStore } from "react"

/** Tailwind default breakpoints. */
export const BREAKPOINTS = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
} as const

/**
 * SSR-safe media query. The server (and the hydration pass) render the
 * `serverFallback` value; the client then switches without a mismatch warning.
 * Layout lives in CSS breakpoints — use this only where behaviour differs.
 */
export function useMediaQuery(query: string, serverFallback = true) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => serverFallback,
  )
}

const subscribeViewport = (onChange: () => void) => {
  const vv = window.visualViewport
  if (!vv) return () => {}
  vv.addEventListener("resize", onChange)
  vv.addEventListener("scroll", onChange)
  return () => {
    vv.removeEventListener("resize", onChange)
    vv.removeEventListener("scroll", onChange)
  }
}
const viewportSnapshot = () => {
  const vv = window.visualViewport
  return vv ? `${vv.offsetTop},${vv.height}` : ""
}

/**
 * The visible part of the page (shrinks when the on-screen keyboard opens on iOS,
 * where `dvh` does not). Null on the server or without `visualViewport`.
 */
export function useVisualViewport() {
  const snap = useSyncExternalStore(subscribeViewport, viewportSnapshot, () => "")
  if (!snap) return null
  const [top, height] = snap.split(",").map(Number)
  return { top, height }
}
