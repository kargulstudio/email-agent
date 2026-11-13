import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

/** Top-bar agent mark: the white mail glyph on a teal (--ea-teal) chip. Read once at build time. */
const TEAL = "#14B398"
const MAIL_SRC = `data:image/svg+xml;base64,${await readFile(join(process.cwd(), "public/figma/mail-02.svg"), "base64")}`

/** iOS home-screen icon: the logo mark on white (iOS applies its own corner mask). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFFFFF",
        }}
      >
        <div
          style={{
            width: 112,
            height: 112,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 34,
            background: TEAL,
          }}
        >
          <img src={MAIL_SRC} width={72} height={72} alt="" />
        </div>
      </div>
    ),
    size,
  )
}
