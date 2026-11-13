/* eslint-disable @next/next/no-img-element -- exact Figma SVG assets, rendered at their native size */
"use client"

import type { ComponentProps, CSSProperties, ReactElement, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ASSET } from "@/lib/data"

/** A Figma SVG at its exported size (never stretched). */
export function Asset({
  name,
  size = 14,
  width,
  height,
  className,
  style,
}: {
  name: string
  size?: number
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <img
      src={ASSET(name)}
      alt=""
      aria-hidden
      draggable={false}
      width={width ?? size}
      height={height ?? size}
      className={cn("block max-w-none shrink-0 select-none", className)}
      style={style}
    />
  )
}

/** A single-colour Figma icon tinted with currentColor (mask) — for icons that change state. */
export function MaskIcon({ name, size = 14, className }: { name: string; size?: number; className?: string }) {
  const url = `url(${ASSET(name)})`
  return (
    <span
      aria-hidden
      className={cn("ea-mask-icon", className)}
      style={{ width: size, height: size, maskImage: url, WebkitMaskImage: url }}
    />
  )
}

/** Wrap any trigger in a tooltip (Base UI render-prop keeps a single DOM element). */
export function Tip({
  label,
  side = "bottom",
  children,
}: {
  label: ReactNode
  side?: "top" | "bottom" | "left" | "right"
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

/** 30×30 raised icon button (Figma "Frame 2147291027" etc.); 40×40 touch target below lg. */
export function IconButton({
  icon,
  label,
  side,
  className,
  ...props
}: Omit<ComponentProps<"button">, "children"> & { icon: string; label: string; side?: "top" | "bottom" }) {
  return (
    <Tip label={label} side={side}>
      <button type="button" aria-label={label} className={cn("ea-control size-[30px] p-2 max-lg:size-10", className)} {...props}>
        <Asset name={icon} />
      </button>
    </Tip>
  )
}

/** Blue primary button with the top-edge glow (Publish changes / Ask AI). */
export function PrimaryButton({
  icon,
  children,
  className,
  ...props
}: ComponentProps<"button"> & { icon: string }) {
  return (
    <button type="button" className={cn("ea-primary", className)} {...props}>
      <Asset name="button-glow.svg" width={128} height={62} className="ea-glow" />
      <Asset name={icon} />
      <span className="px-0.5 text-[14px] leading-none font-medium tracking-[-0.28px] whitespace-nowrap">
        {children}
      </span>
    </button>
  )
}

/** Coloured square icon chip (Figma 1:5213 / 1:9759 / 1:9770). */
export function Chip({
  color,
  size,
  radius,
  children,
}: {
  color: string
  size: number
  radius: number
  children: ReactNode
}) {
  return (
    <span
      className="ea-chip"
      style={{ width: size, height: size, borderRadius: radius, ["--chip" as string]: color } as CSSProperties}
    >
      {children}
    </span>
  )
}
