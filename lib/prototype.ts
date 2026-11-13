import { toast } from "sonner"

/**
 * Every control on the page does *something*. Controls for features that
 * aren't built in this design prototype say so instead of silently doing nothing.
 */
export function comingSoon(feature: string) {
  toast(`${feature} is coming soon`, { id: "coming-soon" })
}
