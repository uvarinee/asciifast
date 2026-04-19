import { useCallback, useEffect, useRef, useState } from "react"
import { Slider } from "@/components/ui/slider"

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    setIsMobile(mq.matches)
    return () => mq.removeEventListener("change", handler)
  }, [breakpoint])
  return isMobile
}

const SYMBOLS = " .,:1i7r352x4e6a8k90dNM#&@"

const PRESETS = {
  clean:      { scale: 50, size: 65, variation: 0,  contrast: 40, brightness: 50, depth: 50 },
  detailed:   { scale: 20, size: 60, variation: 8,  contrast: 55, brightness: 50, depth: 60 },
  cinematic:  { scale: 40, size: 65, variation: 5,  contrast: 65, brightness: 40, depth: 75 },
  raw:        { scale: 60, size: 70, variation: 35, contrast: 48, brightness: 55, depth: 55 },
}

const PRESET_BUTTONS = [
  { key: "clean", label: "Clean" },
  { key: "detailed", label: "Detailed" },
  { key: "cinematic", label: "Cinematic" },
  { key: "raw", label: "Raw" },
]

const SPLASH_DURATION_MS = 2000
const SPLASH_FADE_MS = 220
const ANIM_CYCLE_MS = 6000
const EXPORT_FPS = 30
const EXPORT_FRAMES = EXPORT_FPS * 6
const EXPORT_REVEAL_MS = 4000

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function stableNoise(a, b, c = 0) {
  const value = Math.sin((a + 1) * 12.9898 + (b + 1) * 78.233 + (c + 1) * 37.719) * 43758.5453
  return value - Math.floor(value)
}

function renderAsciiFrame(targetCanvas, data, opts) {
  if (!data || !targetCanvas) return
  const scale = opts.scale ?? 1
  const charSz = opts.size ?? 65
  const inverted = opts.isInverted ?? false
  const fill = opts.fillBackground ?? false
  const animT = opts.t
  const chaos = (opts.animChaos ?? 0) / 100
  const amp = (opts.animAmplitude ?? 0) / 100
  const aDensity = (opts.animDensity ?? 0) / 100

  const baseW = Math.max(1, Math.ceil(data.sourceWidth))
  const baseH = Math.max(1, Math.ceil(data.sourceHeight))
  const cw = opts.canvasWidth ?? baseW * scale
  const ch = opts.canvasHeight ?? baseH * scale

  if (targetCanvas.width !== cw || targetCanvas.height !== ch) {
    targetCanvas.width = cw
    targetCanvas.height = ch
  }

  const ctx = targetCanvas.getContext("2d")
  if (!ctx) return
  ctx.setTransform(scale, 0, 0, scale, 0, 0)

  const drawW = cw / scale
  const drawH = ch / scale

  if (fill) {
    ctx.fillStyle = inverted ? "#000000" : "#ffffff"
    ctx.fillRect(0, 0, drawW, drawH)
  } else {
    ctx.clearRect(0, 0, drawW, drawH)
  }

  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  const baseR = inverted ? 255 : 0
  const TWO_PI = Math.PI * 2
  const symLen = SYMBOLS.length - 1
  const animated = animT != null && (chaos > 0 || amp > 0) && aDensity > 0
  const fillRatio = 0.4 + (clamp(charSz, 0, 100) / 100) * 0.55
  const fontSizeBase = Math.max(1, data.cellHeight * fillRatio)
  const halfCellW = data.cellWidth * 0.5
  const halfCellH = data.cellHeight * 0.5
  let lastFontSize = -1
  let lastToneKey = -1

  for (let row = 0; row < data.rowsCount; row++) {
    const rowCells = data.cells[row]
    for (let col = 0; col < data.columns; col++) {
      const cell = rowCells?.[col]
      if (!cell || cell.char === " ") continue

      let char = cell.char
      let sizeMul = cell.sizeMul

      if (animated && stableNoise(row, col, 7777) < aDensity) {
        const phase = stableNoise(row, col, 1234) * TWO_PI
        const sizePhase = stableNoise(row, col, 5678) * TWO_PI

        if (chaos > 0) {
          const baseIdx = SYMBOLS.indexOf(cell.char)
          const shift = Math.sin(TWO_PI * animT + phase) * chaos
          const newIdx = clamp(Math.round(baseIdx + shift * symLen * 0.4), 1, symLen)
          char = SYMBOLS[newIdx]
        }

        if (amp > 0) {
          const sc = Math.sin(TWO_PI * animT + sizePhase) * amp * 0.5
          sizeMul = clamp(cell.sizeMul * (1 + sc), 0.4, 1.8)
        }
      }

      const fontSize = Math.max(1, Math.round(fontSizeBase * sizeMul))
      if (fontSize !== lastFontSize) {
        ctx.font = `${fontSize}px monospace`
        lastFontSize = fontSize
      }

      const tone = cell.tone ?? 1
      const toneKey = Math.round(tone * 50)
      if (toneKey !== lastToneKey) {
        const v = Math.round(baseR * tone + (255 - baseR) * (1 - tone))
        ctx.fillStyle = `rgb(${v},${v},${v})`
        lastToneKey = toneKey
      }

      ctx.fillText(char, col * data.cellWidth + halfCellW, row * data.cellHeight + halfCellH)
    }
  }
}

const SKEU_TAB_SHADOW = "inset 0 0 0 1px rgba(230,230,230,0.09), inset 0px 2px 3px 0px rgba(255,255,255,0.12), inset 0px 2px 4px 0px rgba(255,255,255,0.3), inset 0px -2px 3px 0px rgba(0,0,0,0.9), inset 0px -4px 10px 0px rgba(0,0,0,0.46)"
const SKEU_BTN_SHADOW = "inset 0 0 0 1px rgba(230,230,230,0.09), inset 0px 2px 3px 0px rgba(255,255,255,0.12), inset 0px 2px 4px 0px rgba(255,255,255,0.02), inset 0px -2px 3px 0px rgba(0,0,0,0.9), inset 0px -4px 10px 0px rgba(0,0,0,0.46)"

function LogoIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 61 61" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M29.9511 11.2983C30.1553 11.2983 30.3209 11.1327 30.321 10.9284C30.3211 10.7241 30.1554 10.5584 29.9511 10.5584L22.9513 10.5581C22.2731 10.5581 22.0896 9.71731 22.7262 9.48348C22.7964 9.45767 22.8696 9.44515 22.9445 9.44515L29.9514 9.44534C30.1557 9.44534 30.3213 9.27979 30.3213 9.07553C30.3214 8.87118 30.1558 8.70549 29.9514 8.70549L29.8076 8.7055C29.1969 8.7055 29.1536 8.15415 29.7641 8.13806C37.6512 7.9302 45.4006 11.9366 49.6228 19.2497C55.6657 29.717 52.2299 43.0555 41.9786 49.3259L41.7982 49.4334C41.732 49.4739 41.6651 49.5139 41.598 49.5535L41.4852 49.6198L41.4835 49.6207C41.369 49.6868 41.2541 49.7517 41.1385 49.8143C41.1286 49.8197 41.1184 49.8251 41.1084 49.8305C37.9741 51.5613 34.596 52.4544 31.2361 52.5827C30.7298 52.602 30.3198 52.1887 30.32 51.682C30.3203 51.1742 29.9087 50.7624 29.4009 50.7624L21.5434 50.7623C21.5304 50.7623 21.5176 50.7597 21.5057 50.7545C21.4123 50.714 21.4416 50.5773 21.5434 50.5773L29.58 50.5773C29.9891 50.5773 30.3208 50.2457 30.3209 49.8365C30.321 49.4273 29.9892 49.0954 29.58 49.0954L18.4409 49.0956C18.4045 49.0956 18.3689 49.0853 18.3383 49.0656C18.1803 48.9642 18.253 48.7247 18.4407 48.7247L29.5803 48.7244C29.9895 48.7244 30.3212 48.3928 30.3213 47.9836C30.3213 47.5743 29.9896 47.2425 29.5803 47.2425L15.9583 47.2421C15.9133 47.2421 15.8698 47.2261 15.8357 47.1966C15.7052 47.0838 15.7859 46.8722 15.9585 46.8722L29.5798 46.872C29.989 46.872 30.3207 46.5403 30.3208 46.1312C30.3208 45.7219 29.9891 45.3901 29.5798 45.3901L14.0595 45.3894C14.0066 45.3894 13.9562 45.3672 13.9206 45.3281C13.8117 45.2084 13.8972 45.0186 14.0591 45.0186L30.118 45.0191C30.23 45.0191 30.3208 44.9282 30.3206 44.8161C30.3203 44.6596 30.4906 44.5612 30.6291 44.6341C33.0264 45.8971 35.9993 45.9409 38.5191 44.4863C42.4213 42.2332 43.7582 37.243 41.5056 33.3407C39.2525 29.4383 34.262 28.1005 30.3595 30.3534C29.9417 30.5946 29.4766 30.7531 28.9942 30.7531L17.5689 30.7529C17.3177 30.7529 17.136 30.5139 17.2105 30.2741C17.2594 30.1169 17.4058 30.011 17.5705 30.011L29.7657 30.0113C30.0724 30.0113 30.3211 29.7627 30.3211 29.456C30.3212 29.1492 30.0725 28.9005 29.7657 28.9005L18.2643 28.9003C17.9939 28.9003 17.8104 28.627 17.9212 28.3803C17.982 28.2448 18.1173 28.1586 18.2659 28.1586L29.7652 28.1589C30.0719 28.1589 30.3206 27.9103 30.3206 27.6036C30.3207 27.2968 30.072 27.048 29.7652 27.048L19.2392 27.0478C18.9476 27.0478 18.7645 26.7352 18.9163 26.4862C18.9848 26.3738 19.1075 26.3061 19.2391 26.3061L29.7655 26.306C30.0723 26.306 30.3209 26.0574 30.321 25.7507C30.3211 25.4439 30.0724 25.1951 29.7656 25.1951L20.5552 25.1947C20.2389 25.1947 20.0602 24.8359 20.2609 24.5914C20.3329 24.5036 20.4411 24.4533 20.5547 24.4533L29.7652 24.4531C30.0723 24.4531 30.3211 24.2042 30.3211 23.8971C30.321 23.5902 30.0722 23.3414 29.7652 23.3414L22.3445 23.3413C21.9978 23.3412 21.8291 22.9262 22.0887 22.6964C22.1587 22.6344 22.2497 22.6004 22.3432 22.6004L29.7654 22.6007C30.0721 22.6007 30.3208 22.3521 30.3208 22.0453C30.3209 21.7385 30.0722 21.4898 29.7654 21.4897L25.0277 21.4893C24.5974 21.4893 24.4369 20.9538 24.8095 20.7386C25.0176 20.6185 25.2561 20.5615 25.4964 20.5615L29.951 20.5618C30.1553 20.5618 30.3209 20.3963 30.3209 20.192C30.321 19.9876 30.1554 19.822 29.951 19.8219L29.6992 19.8219C29.022 19.8219 28.8888 19.0383 29.55 18.8921C34.6793 17.7582 40.0737 19.1288 44.039 22.549C44.5991 23.0318 45.4996 22.4839 45.1303 21.8434C41.078 14.8246 32.7877 11.7784 25.3579 14.0706C24.9673 14.1911 24.5621 14.2635 24.1534 14.2635L16.5068 14.2631C15.9751 14.2631 15.7245 13.6246 16.1332 13.2847C16.2375 13.198 16.3699 13.1508 16.5055 13.1508L29.9507 13.1512C30.155 13.1512 30.3206 12.9856 30.3206 12.7813C30.3207 12.577 30.1551 12.4113 29.9507 12.4113L19.1069 12.4111C18.523 12.4111 18.2961 11.6895 18.7948 11.3859C18.8881 11.3291 18.9966 11.2989 19.1057 11.2989L29.9511 11.2983ZM28.5696 43.1663C28.6168 43.1663 28.6622 43.1854 28.6959 43.2186C28.8121 43.3331 28.7339 43.5367 28.5708 43.5367L12.552 43.5367C12.4923 43.5367 12.4361 43.5083 12.401 43.46C12.3116 43.337 12.4002 43.1659 12.5522 43.1659L28.5696 43.1663ZM27.0575 41.3135C27.1887 41.3135 27.307 41.3867 27.3726 41.5003C27.4197 41.5818 27.3634 41.6839 27.2694 41.6839L11.4692 41.6836C11.324 41.6836 11.1878 41.6079 11.1151 41.4821C11.0719 41.4073 11.1271 41.3137 11.2135 41.3137L27.0575 41.3135ZM26.3979 39.4609C26.4803 39.4608 26.5521 39.5164 26.5742 39.5958C26.607 39.7133 26.5201 39.8316 26.3982 39.8316L10.3715 39.8319C10.2989 39.8319 10.2327 39.79 10.2018 39.7243C10.1439 39.6012 10.2342 39.4612 10.3703 39.4612L26.3979 39.4609ZM26.1031 37.6081C26.2015 37.6081 26.2817 37.6867 26.286 37.785C26.2905 37.8897 26.2078 37.9786 26.103 37.9786L16.8662 37.9792C16.7746 37.9792 16.6963 37.9132 16.6811 37.8229C16.6621 37.7099 16.7497 37.6084 16.8643 37.6084L26.1031 37.6081ZM26.1551 35.5692C26.328 35.5692 26.4556 35.7302 26.4233 35.9C26.3986 36.0295 26.2868 36.1253 26.155 36.1253L16.7659 36.1253C16.6161 36.1253 16.492 36.0081 16.4859 35.8584C16.4796 35.7 16.6073 35.5697 16.7658 35.5697L26.1551 35.5692ZM26.5961 33.7164C26.8585 33.7164 27.0296 33.9945 26.9271 34.236C26.8705 34.3696 26.7411 34.4587 26.5961 34.4587L16.8824 34.4583C16.6663 34.4583 16.4935 34.2778 16.5089 34.0623C16.5228 33.8662 16.6874 33.7163 16.8839 33.7163L26.5961 33.7164ZM27.6736 31.8639C27.9728 31.8639 28.1353 32.2284 27.9543 32.4667C27.8881 32.5538 27.786 32.6058 27.6766 32.6058L17.115 32.6056C16.8819 32.6056 16.7038 32.3974 16.7464 32.1683C16.7794 31.9908 16.9354 31.8639 17.1159 31.8639L27.6736 31.8639ZM14.8223 37.6081C14.8932 37.6081 14.9575 37.6489 14.9881 37.7128C15.047 37.8354 14.9585 37.9788 14.8225 37.9788L9.60804 37.9792C9.52949 37.9792 9.45918 37.9301 9.43292 37.856C9.38994 37.7349 9.48053 37.6082 9.60911 37.6082L14.8223 37.6081ZM13.9362 35.5698C14.0546 35.5698 14.1591 35.646 14.1965 35.7583C14.2562 35.9374 14.1244 36.1251 13.9356 36.1251L9.10699 36.1256C8.97948 36.1256 8.86759 36.0399 8.83568 35.9164C8.79002 35.7398 8.92451 35.5693 9.10695 35.5694L13.9362 35.5698ZM13.3543 33.7166C13.527 33.7166 13.6752 33.8381 13.7123 34.0068C13.7628 34.2368 13.5901 34.4583 13.3546 34.4583L8.82458 34.4583C8.64288 34.4583 8.48652 34.3286 8.45516 34.1497C8.41526 33.922 8.59217 33.7165 8.82329 33.7165L13.3543 33.7166ZM13.0547 31.8643C13.2427 31.8643 13.3991 32.0077 13.4189 32.1947C13.442 32.4126 13.2732 32.6059 13.054 32.6058L8.5845 32.6057C8.39081 32.6057 8.22829 32.4588 8.2124 32.2658C8.19449 32.0483 8.36769 31.8639 8.58592 31.8639L13.0547 31.8643ZM12.9536 30.0116C13.157 30.0116 13.3204 30.1787 13.3207 30.3822C13.321 30.5857 13.1577 30.7532 12.9542 30.7532L8.50757 30.7527C8.30165 30.7527 8.13344 30.5874 8.13346 30.3815C8.13348 30.1756 8.30172 30.0107 8.50762 30.0107L12.9536 30.0116ZM13.0541 28.1585C13.2733 28.1585 13.442 28.3512 13.4185 28.5691C13.3984 28.7561 13.2418 28.9002 13.0537 28.9002L8.58574 28.9005C8.36749 28.9005 8.1945 28.7158 8.21306 28.4983C8.22954 28.3053 8.39209 28.1587 8.58579 28.1587L13.0541 28.1585ZM13.3515 26.3054C13.5869 26.3054 13.7599 26.5261 13.7101 26.7561C13.6735 26.9253 13.5249 27.0477 13.3518 27.0477L8.82442 27.0477C8.5936 27.0477 8.41657 26.8421 8.45526 26.6146C8.48572 26.4355 8.64186 26.3061 8.82352 26.3061L13.3515 26.3054ZM13.8624 24.453C14.1144 24.453 14.2893 24.7041 14.2091 24.943C14.1589 25.0924 14.0197 25.1946 13.862 25.1946L9.22421 25.1946C8.98021 25.1947 8.80052 24.9667 8.86293 24.7308C8.90636 24.5666 9.05558 24.4533 9.22538 24.4533L13.8624 24.453ZM14.6047 22.6008C14.874 22.6008 15.0487 22.8858 14.9344 23.1297C14.8743 23.258 14.7461 23.341 14.6044 23.3411L9.79859 23.3414C9.5414 23.3414 9.35935 23.0894 9.44557 22.8471C9.49837 22.6988 9.63957 22.6009 9.79706 22.6009L14.6047 22.6008ZM15.5626 20.5614C15.924 20.5614 16.138 20.9707 15.9455 21.2765C15.8626 21.4084 15.7187 21.4895 15.5629 21.4895L10.7091 21.4894C10.3666 21.4894 10.1369 21.1387 10.2836 20.8292C10.3614 20.6652 10.5275 20.5619 10.709 20.5619L15.5626 20.5614ZM16.7145 18.7087C17.1744 18.7087 17.419 19.2656 17.1293 19.6227C17.0278 19.7478 16.8765 19.8213 16.7154 19.8214L11.7543 19.8216C11.3194 19.8216 11.0434 19.3585 11.2657 18.9847C11.3678 18.8129 11.554 18.7091 11.7538 18.7091L16.7145 18.7087ZM18.46 16.8567C18.9507 16.8567 19.1752 17.4984 18.8141 17.8306C18.7177 17.9193 18.593 17.9686 18.462 17.9686L12.9913 17.9687C12.529 17.9687 12.2572 17.4556 12.5333 17.0849C12.6409 16.9404 12.8114 16.8563 12.9915 16.8563L18.46 16.8567ZM21.6969 15.0035C22.0089 15.0035 22.1167 15.4486 21.8465 15.6046C21.8376 15.6097 21.8287 15.6149 21.8198 15.62C21.2857 15.9296 20.6856 16.1165 20.0682 16.1165L14.5392 16.1162C14.0451 16.1162 13.781 15.5454 14.1187 15.1847C14.2274 15.0686 14.3803 15.0033 14.5393 15.0033L21.6969 15.0035Z" fill="#E6E6E6"/>
    </svg>
  )
}

function MenuSvgIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="35.0007" cy="20.9997" r="4.66667" fill="#BCBCBC"/>
      <circle cx="35.0007" cy="34.9997" r="4.66667" fill="#BCBCBC"/>
      <circle cx="21.0007" cy="20.9997" r="4.66667" fill="#BCBCBC"/>
      <circle cx="21.0007" cy="34.9997" r="4.66667" fill="#BCBCBC"/>
    </svg>
  )
}


function BackIcon({ onClick, size = 50 }) {
  const iconSize = size >= 50 ? 18 : 14
  return (
    <button
      type="button"
      onClick={onClick}
      className="menu-close-btn no-rotate flex items-center justify-center rounded-full"
      style={{ width: size, height: size }}
    >
      <img src="/icons/icon-back.svg" alt="" width={iconSize} height={iconSize} draggable={false} />
    </button>
  )
}

function OnboardingIcon() {
  return <img src="/icons/icon-onboarding.svg" alt="" width={24} height={24} draggable={false} />
}

function FeedbackIcon() {
  return <img src="/icons/icon-feedback.svg" alt="" width={24} height={24} draggable={false} />
}

function AboutLogoIcon() {
  return <img src="/icons/icon-logo.svg" alt="" width={24} height={24} draggable={false} style={{ borderRadius: 5.76 }} />
}

function SupportIcon() {
  return <img src="/icons/icon-support.svg" alt="" width={24} height={24} draggable={false} />
}

function MenuModal({ isOpen, onClose, isMobile }) {
  const [activeSection, setActiveSection] = useState(null)
  const [menuAtBottom, setMenuAtBottom] = useState(false)
  const [menuAtTop, setMenuAtTop] = useState(true)

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => setActiveSection(null), 300)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  useEffect(() => {
    setMenuAtBottom(false)
    setMenuAtTop(true)
  }, [activeSection])

  if (!isOpen && !activeSection) return null

  const menuItems = [
    { key: "onboarding", label: "Onboarding", icon: <OnboardingIcon /> },
    { key: "feedback", label: "Feedback", icon: <FeedbackIcon /> },
    { key: "about", label: "About Version 3.0", icon: <AboutLogoIcon /> },
    { key: "support", label: "Support", icon: <SupportIcon /> },
  ]

  function handleItemClick(key) {
    if (key === "feedback") {
      window.open("#", "_blank")
      return
    }
    setActiveSection(key)
  }

  function renderContent() {
    if (activeSection === "onboarding") return <OnboardingContent isMobile={isMobile} />
    if (activeSection === "about") return <AboutVersionContent isMobile={isMobile} />
    if (activeSection === "support") return <SupportContent isMobile={isMobile} />
    return null
  }

  const sectionTitles = {
    onboarding: "Onboarding",
    about: "About Version 3.0",
    support: "Support",
  }

  if (isMobile) {
    const sheetHeight = activeSection === "onboarding" ? 560 : activeSection ? 400 : null

    return (
      <div
        className={`fixed inset-0 z-40 flex items-end justify-center transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-[#050505]/20 backdrop-blur-[32px]" />
        <div
          className="relative z-10 overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            width: "calc(100% - 40px)",
            maxWidth: 400,
            ...(sheetHeight ? { height: sheetHeight } : {}),
            maxHeight: "calc(100% - 60px)",
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "#050505",
            boxShadow: "0px 4px 20px -8px rgba(0,0,0,1)",
            marginBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {activeSection ? (
            <>
              <div className="flex items-center justify-between" style={{ padding: "12px 12px 0 12px" }}>
                <div className="flex items-center gap-[10px]">
                  <BackIcon onClick={() => setActiveSection(null)} size={40} />
                  <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 15, fontWeight: 400, letterSpacing: "-0.01em", color: "#F2F2F2" }}>
                    {sectionTitles[activeSection]}
                  </p>
                </div>
                <button
                  type="button"
                  className="menu-close-btn flex items-center justify-center rounded-full"
                  style={{ width: 40, height: 40 }}
                  onClick={onClose}
                >
                  <img src="/icons/icon-close.svg" alt="" width={10} height={10} draggable={false} />
                </button>
              </div>
              <div
                className="overflow-hidden"
                style={{
                  margin: "12px 8px 8px 8px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.02)",
                  height: sheetHeight ? `calc(100% - 76px)` : "auto",
                }}
              >
                <div
                  className={`h-full ${activeSection === "onboarding" ? "overflow-y-auto menu-scrollbar" : "overflow-hidden"}`}
                  onScroll={activeSection === "onboarding" ? (e) => {
                    const el = e.currentTarget
                    setMenuAtTop(el.scrollTop < 8)
                    setMenuAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
                  } : undefined}
                >
                  <div style={{ padding: activeSection === "onboarding" ? "20px 16px 28px 16px" : "24px" }}>
                    {renderContent()}
                  </div>
                </div>
                {activeSection === "onboarding" && (
                  <>
                    <div
                      className="pointer-events-none absolute inset-x-[8px] transition-opacity duration-200"
                      style={{
                        top: 76,
                        height: 60,
                        background: "linear-gradient(0deg, rgba(20,20,20,0) 0%, rgba(20,20,20,1) 77%)",
                        borderRadius: "16px 16px 0 0",
                        opacity: menuAtTop ? 0 : 1,
                      }}
                    />
                    <div
                      className="pointer-events-none absolute inset-x-[8px] bottom-[8px] transition-opacity duration-200"
                      style={{
                        height: 60,
                        background: "linear-gradient(180deg, rgba(20,20,20,0) 0%, rgba(20,20,20,1) 77%)",
                        borderRadius: "0 0 16px 16px",
                        opacity: menuAtBottom ? 0 : 1,
                      }}
                    />
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between" style={{ padding: "0 12px 0 24px", height: 60 }}>
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 15, fontWeight: 400, letterSpacing: "-0.01em", color: "#F2F2F2" }}>
                  Menu
                </p>
                <button
                  type="button"
                  className="menu-close-btn flex items-center justify-center rounded-full"
                  style={{ width: 40, height: 40 }}
                  onClick={onClose}
                >
                  <img src="/icons/icon-close.svg" alt="" width={10} height={10} draggable={false} />
                </button>
              </div>
              <div className="flex flex-col" style={{ padding: "0 8px 8px 8px", gap: 4 }}>
                {menuItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleItemClick(item.key)}
                    className="menu-tile flex items-center gap-[14px] overflow-hidden text-left"
                    style={{ height: 52, borderRadius: 12, paddingLeft: 16, paddingRight: 16 }}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span
                      style={{
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: 14,
                        fontWeight: 300,
                        letterSpacing: "-0.01em",
                        color: "#F2F2F2",
                      }}
                    >
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[#050505]/20 backdrop-blur-[32px]" />
      <div
        className="relative z-10 overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          width: 600,
          height: activeSection === "onboarding" ? 520 : 360,
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "#050505",
          boxShadow: "0px 4px 20px -8px rgba(0,0,0,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {activeSection ? (
          <div className="absolute flex items-center gap-[12px]" style={{ left: 16, top: 16 }}>
            <BackIcon onClick={() => setActiveSection(null)} />
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 16, fontWeight: 400, letterSpacing: "-0.01em", color: "#F2F2F2" }}>
              {sectionTitles[activeSection]}
            </p>
          </div>
        ) : (
          <div className="absolute flex items-center" style={{ left: 31, top: 0, height: 80 }}>
            <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 16, fontWeight: 400, letterSpacing: "-0.01em", color: "#F2F2F2" }}>
              Menu
            </p>
          </div>
        )}

        <button
          type="button"
          className="menu-close-btn absolute flex items-center justify-center rounded-full"
          style={{ right: 16, top: 16, width: 50, height: 50 }}
          onClick={onClose}
        >
          <img src="/icons/icon-close.svg" alt="" width={12} height={12} draggable={false} />
        </button>

        {activeSection ? (
          <div
            className="absolute overflow-hidden"
            style={{
              left: 8,
              top: 82,
              width: 584,
              bottom: 8,
              borderRadius: 18,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.02)",
            }}
          >
            <div
              className={`h-full ${activeSection === "onboarding" ? "overflow-y-auto menu-scrollbar" : "overflow-hidden"}`}
              onScroll={activeSection === "onboarding" ? (e) => {
                const el = e.currentTarget
                setMenuAtTop(el.scrollTop < 8)
                setMenuAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
              } : undefined}
            >
              <div style={{ padding: "24px 0 32px 0", width: 552, marginLeft: 16 }}>
                {renderContent()}
              </div>
            </div>
            {activeSection === "onboarding" && (
              <>
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 transition-opacity duration-200"
                  style={{
                    height: 80,
                    background: "linear-gradient(0deg, rgba(20,20,20,0) 0%, rgba(20,20,20,1) 77%)",
                    borderRadius: "18px 18px 0 0",
                    opacity: menuAtTop ? 0 : 1,
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 transition-opacity duration-200"
                  style={{
                    height: 80,
                    background: "linear-gradient(180deg, rgba(20,20,20,0) 0%, rgba(20,20,20,1) 77%)",
                    borderRadius: "0 0 18px 18px",
                    opacity: menuAtBottom ? 0 : 1,
                  }}
                />
              </>
            )}
          </div>
        ) : (
          <div className="absolute flex flex-col" style={{ left: 7, top: 81, width: 584, gap: 6 }}>
            {[menuItems.slice(0, 2), menuItems.slice(2, 4)].map((row, ri) => (
              <div key={ri} className="flex gap-[6px]">
                {row.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleItemClick(item.key)}
                    className="menu-tile relative flex-1 overflow-hidden text-left"
                    style={{ height: 132, borderRadius: 16 }}
                  >
                    <span className="absolute" style={{ left: 23, top: 23 }}>{item.icon}</span>
                    <span
                      className="absolute"
                      style={{
                        left: 23,
                        bottom: 25,
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: 16,
                        fontWeight: 300,
                        letterSpacing: "-0.01em",
                        color: "#F2F2F2",
                      }}
                    >
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function OnboardingSection({ title, imageSrc, imageAlt, children, isMobile }) {
  return (
    <div className="flex flex-col" style={{ gap: isMobile ? 20 : 28 }}>
      {title && (
        <div style={{ padding: isMobile ? "0" : "0 32px 0 16px" }}>
          <p
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: isMobile ? 17 : 20,
              fontWeight: 500,
              lineHeight: "1em",
              letterSpacing: "-0.01em",
              color: "#F2F2F2",
            }}
          >
            {title}
          </p>
        </div>
      )}
      <div className="flex flex-col" style={{ gap: isMobile ? 14 : 18 }}>
        <div
          className="overflow-hidden"
          style={{
            height: isMobile ? 180 : 220,
            borderRadius: isMobile ? 12 : 16,
            background: "#050505",
          }}
        >
          <img src={imageSrc} alt={imageAlt} className="block h-full w-full object-cover" draggable={false} />
        </div>
        <div style={{ padding: isMobile ? "0" : "0 32px 0 16px" }}>
          <p
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: isMobile ? 14 : 15,
              lineHeight: "1.37em",
              fontWeight: 300,
              letterSpacing: "-0.01em",
              color: "#BCBCBC",
            }}
          >
            {children}
          </p>
        </div>
      </div>
    </div>
  )
}

function OnboardingContent({ isMobile }) {
  return (
    <div className="flex flex-col" style={{ gap: isMobile ? 36 : 52 }}>
      <OnboardingSection isMobile={isMobile} title="Upload Image" imageSrc={isMobile ? "/onboarding/mobile-upload-image-2.png" : "/onboarding/upload-image.png"} imageAlt="Upload">
        Upload an image to start. Drag and drop it into the canvas or use the upload button. Asciifast will instantly convert it into ASCII.
      </OnboardingSection>
      <OnboardingSection isMobile={isMobile} title="Modes & Settings" imageSrc={isMobile ? "/onboarding/mobile-modes-settings-2.png" : "/onboarding/modes-settings.png"} imageAlt="Modes">
        Switch between Image and Video modes. Each mode adapts the controls for different types of content. Choose the one that fits your workflow.
      </OnboardingSection>
      <OnboardingSection isMobile={isMobile} imageSrc={isMobile ? "/onboarding/mobile-sliders-2.png" : "/onboarding/sliders.png"} imageAlt="Sliders">
        Use sliders as presets to customize the ASCII style. Adjust the scale, contrast, variation, and other parameters to get different visual results.
      </OnboardingSection>
      <OnboardingSection isMobile={isMobile} title="Export" imageSrc={isMobile ? "/onboarding/mobile-export-2.png" : "/onboarding/export.png"} imageAlt="Export">
        Export your result when you're ready. Save the ASCII output as an image or use it in your workflow.
      </OnboardingSection>
    </div>
  )
}

function AboutVersionContent({ isMobile }) {
  const fontSize = isMobile ? 14 : 15
  return (
    <div style={{ padding: isMobile ? "0" : "0 32px 0 16px" }}>
      <p
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize,
          lineHeight: "1.37em",
          fontWeight: 300,
          letterSpacing: "-0.01em",
          color: "#BCBCBC",
        }}
      >
        Version 3.0 introduces a refined interface and improved ASCII rendering. The styling engine has been updated with grayscale gradations and more responsive character density for smoother visual results.
      </p>
      <p
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize,
          lineHeight: "1.37em",
          fontWeight: 300,
          letterSpacing: "-0.01em",
          color: "#BCBCBC",
          marginTop: isMobile ? 16 : 20,
        }}
      >
        Controls have been redesigned with clearer naming and better sensitivity, making it easier to fine-tune the ASCII style and explore variations.
      </p>
    </div>
  )
}

function SupportContent({ isMobile }) {
  const fontSize = isMobile ? 14 : 15
  return (
    <div style={{ padding: isMobile ? "0" : "0 32px 0 16px" }}>
      <p
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize,
          lineHeight: "1.37em",
          fontWeight: 300,
          letterSpacing: "-0.01em",
          color: "#BCBCBC",
        }}
      >
        If you like asciifast, you can support its development. Your support helps me to continue improving the tool and create new independent design experiments. For support, you can contact me directly via Telegram.
      </p>
      <a
        href="https://t.me/uvarine"
        target="_blank"
        rel="noopener noreferrer"
        className="menu-pill-btn"
        style={{
          display: "inline-block",
          marginTop: isMobile ? 16 : 20,
          padding: "9px 16px 10px 16px",
          fontFamily: "'Geist Mono', monospace",
          fontSize: isMobile ? 13 : 14,
          fontWeight: 500,
          color: "#F2F2F2",
          textDecoration: "none",
        }}
      >
        @uvarine
      </a>
    </div>
  )
}

function SliderRow({ label, value, onChange, min = 0, max = 100, step = 1, fontSize = 14 }) {
  return (
    <div className="flex flex-col gap-[6px]">
      <p className="font-light tracking-[-0.01em] text-[#BCBCBC]" style={{ fontFamily: "'Geist Mono', monospace", fontSize }}>
        {label}: <span className="font-medium">{value}%</span>
      </p>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v?.[0] ?? value)} />
    </div>
  )
}

function App() {
  const isMobile = useIsMobile()
  const inputRef = useRef(null)
  const previewContainerRef = useRef(null)
  const previewCanvasRef = useRef(null)
  const pixelCacheRef = useRef(null)
  const dragDepthRef = useRef(0)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const panOriginRef = useRef({ x: 0, y: 0 })
  const optionsScrollRef = useRef(null)
  const mobileScrollRef = useRef(null)
  const mobileHeaderRef = useRef(null)

  const [activeTab, setActiveTab] = useState("image")
  const [imageUrl, setImageUrl] = useState("")
  const [asciiData, setAsciiData] = useState(null)
  const [previewViewport, setPreviewViewport] = useState(null)
  const [contentAnchorSize, setContentAnchorSize] = useState(null)
  const [userZoom, setUserZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isInverted, setIsInverted] = useState(true)
  const [isColorInverted, setIsColorInverted] = useState(false)
  const [splashProgress, setSplashProgress] = useState(0)
  const [isSplashVisible, setIsSplashVisible] = useState(true)
  const [isSplashFading, setIsSplashFading] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showExportOptions, setShowExportOptions] = useState(false)

  const [scale, setScale] = useState(50)
  const [size, setSize] = useState(65)
  const [variation, setVariation] = useState(0)
  const [contrast, setContrast] = useState(40)
  const [brightness, setBrightness] = useState(50)
  const [depth, setDepth] = useState(50)

  const [animChaos, setAnimChaos] = useState(50)
  const [animAmplitude, setAnimAmplitude] = useState(30)
  const [animDensity, setAnimDensity] = useState(40)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [pixelCacheVer, setPixelCacheVer] = useState(0)
  const [optionsAtBottom, setOptionsAtBottom] = useState(false)
  const [mobilePreviewStuck, setMobilePreviewStuck] = useState(false)
  const [mobileOptionsFadeTop, setMobileOptionsFadeTop] = useState(false)

  useEffect(() => {
    let frame = 0
    let hideTimer = 0
    const startedAt = performance.now()

    const step = (now) => {
      const elapsed = now - startedAt
      const nextProgress = clamp(elapsed / SPLASH_DURATION_MS, 0, 1)
      setSplashProgress(nextProgress)

      if (nextProgress < 1) {
        frame = requestAnimationFrame(step)
        return
      }

      setIsSplashFading(true)
      hideTimer = window.setTimeout(() => {
        setIsSplashVisible(false)
      }, SPLASH_FADE_MS)
    }

    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      if (hideTimer) window.clearTimeout(hideTimer)
    }
  }, [])

  useEffect(() => {
    if (!imageUrl) {
      pixelCacheRef.current = null
      return
    }

    pixelCacheRef.current = null

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d", { willReadFrequently: true })
      if (!context) return

      const sourceWidth = img.naturalWidth || img.width
      const sourceHeight = img.naturalHeight || img.height
      if (!sourceWidth || !sourceHeight) return

      const drawWidth = sourceWidth
      const drawHeight = sourceHeight

      canvas.width = drawWidth
      canvas.height = drawHeight
      context.drawImage(img, 0, 0, drawWidth, drawHeight)
      const { data } = context.getImageData(0, 0, drawWidth, drawHeight)

      pixelCacheRef.current = { data, drawWidth, drawHeight }
      setContentAnchorSize((current) => {
        if (current) return current
        return { width: drawWidth, height: drawHeight }
      })
      setPixelCacheVer((v) => v + 1)
    }

    img.onerror = () => {
      pixelCacheRef.current = null
      setAsciiData(null)
    }
    img.src = imageUrl

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [imageUrl])

  useEffect(() => {
    const cache = pixelCacheRef.current
    if (!cache) return

    const { data, drawWidth, drawHeight } = cache

    const safeDensity = 2 + (clamp(scale, 0, 100) / 100) * 16
    const contrastFactor = 0.5 + (clamp(contrast, 0, 100) / 100) * 1.5
    const brightnessFactor = 0.5 + (clamp(brightness, 0, 100) / 100) * 1.5
    const depthPower = 0.5 + (clamp(depth, 0, 100) / 100) * 1.5
    const variationAmount = clamp(variation, 0, 100) / 100
    const invertColors = isColorInverted

    const refCharSize = 10
    const lineHeight = refCharSize * 1.1
    const measureCanvas = document.createElement("canvas")
    const measureContext = measureCanvas.getContext("2d")
    if (!measureContext) return
    measureContext.font = `${refCharSize}px monospace`
    const charWidth = measureContext.measureText("M").width || refCharSize * 0.6

    const columns = clamp(Math.round(drawWidth / safeDensity), 20, 320)
    const rowsCount = Math.max(
      1,
      Math.round((drawHeight * columns * charWidth) / (drawWidth * lineHeight))
    )
    const cellWidth = drawWidth / columns
    const cellHeight = drawHeight / rowsCount

    function getPixelAt(x, y) {
      const safeX = clamp(Math.round(x), 0, drawWidth - 1)
      const safeY = clamp(Math.round(y), 0, drawHeight - 1)
      const index = (safeY * drawWidth + safeX) * 4
      return { r: data[index], g: data[index + 1], b: data[index + 2], a: data[index + 3] }
    }

    function getLuminanceAt(x, y) {
      const { r, g, b, a } = getPixelAt(x, y)
      if (a === 0) return 255
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    const borderSamples = []
    const borderStep = Math.max(1, Math.round(Math.min(drawWidth, drawHeight) / 60))
    for (let x = 0; x < drawWidth; x += borderStep) {
      borderSamples.push(getPixelAt(x, 0), getPixelAt(x, drawHeight - 1))
    }
    for (let y = 0; y < drawHeight; y += borderStep) {
      borderSamples.push(getPixelAt(0, y), getPixelAt(drawWidth - 1, y))
    }

    const validBorder = borderSamples.filter((p) => p.a > 16)
    const backgroundBase = validBorder.length > 0 ? validBorder : borderSamples
    const sum = backgroundBase.reduce(
      (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
      { r: 0, g: 0, b: 0 }
    )
    const count = Math.max(1, backgroundBase.length)
    const bg = { r: sum.r / count, g: sum.g / count, b: sum.b / count }
    const variance =
      backgroundBase.reduce((total, p) => {
        const dr = p.r - bg.r
        const dg = p.g - bg.g
        const db = p.b - bg.b
        return total + dr * dr + dg * dg + db * db
      }, 0) / count
    const backgroundThreshold = clamp(14 + Math.sqrt(variance) * 0.5, 14, 64)

    const symbolCount = SYMBOLS.length - 1
    const cells = []

    for (let row = 0; row < rowsCount; row += 1) {
      const rowCells = []
      for (let col = 0; col < columns; col += 1) {
        const centerX = col * cellWidth + cellWidth * 0.5
        const centerY = row * cellHeight + cellHeight * 0.5

        const centerPixel = getPixelAt(centerX, centerY)
        const l0 = getLuminanceAt(centerX, centerY)
        const l1 = getLuminanceAt(centerX - cellWidth * 0.25, centerY - cellHeight * 0.25)
        const l2 = getLuminanceAt(centerX + cellWidth * 0.25, centerY + cellHeight * 0.25)
        const baseLuminance = (l0 + l1 + l2) / 3
        const rightLum = getLuminanceAt(centerX + 1, centerY)
        const bottomLum = getLuminanceAt(centerX, centerY + 1)
        const edgeEnergy = Math.abs(baseLuminance - rightLum) + Math.abs(baseLuminance - bottomLum)

        const colorDistance = Math.sqrt(
          (centerPixel.r - bg.r) ** 2 + (centerPixel.g - bg.g) ** 2 + (centerPixel.b - bg.b) ** 2
        )
        const isFlatBackground = colorDistance < backgroundThreshold && edgeEnergy < 18
        const isEmptyCell = centerPixel.a < 16 || isFlatBackground

        if (invertColors) {
          if (isEmptyCell) {
            const invLum = 0
            let normalized = clamp((invLum - 128) * contrastFactor + 128, 0, 255)
            normalized = clamp(normalized * brightnessFactor, 0, 255)
            const light = clamp(normalized / 255, 0, 1)
            const darkness = Math.pow(light, depthPower) * 0.85
            const spread = (stableNoise(row, col, 31) - 0.5) * 0.28
            const varJitter = (stableNoise(row, col, drawWidth + drawHeight) - 0.5) * variationAmount * 0.35
            const randomizedDarkness = clamp(darkness + spread + varJitter, 0, 1)
            const symbolIndex = clamp(Math.round(randomizedDarkness * symbolCount), 0, symbolCount)
            const sizeMul = 1 + (stableNoise(col, row, 99) - 0.5) * variationAmount * 0.5
            const tone = 0.25 + clamp(light * 1.3, 0, 1) * 0.75
            rowCells.push({
              char: SYMBOLS[symbolIndex] ?? " ",
              sizeMul: clamp(sizeMul, 0.7, 1.25),
              tone,
            })
            continue
          }

          const invLuminance = 255 - baseLuminance
          let normalized = clamp((invLuminance - 128) * contrastFactor + 128, 0, 255)
          normalized = clamp(normalized * brightnessFactor, 0, 255)
          const edgeLift = clamp(edgeEnergy / 32, 0, 0.25)
          const light = clamp(normalized / 255 + edgeLift, 0, 1)
          const darkness = Math.pow(light, depthPower) * 0.85
          const spread = (stableNoise(row, col, 31) - 0.5) * 0.28
          const varJitter = (stableNoise(row, col, drawWidth + drawHeight) - 0.5) * variationAmount * 0.35
          const randomizedDarkness = clamp(darkness + spread + varJitter, 0, 1)
          const symbolIndex = clamp(Math.round(randomizedDarkness * symbolCount), 0, symbolCount)

          if (SYMBOLS[symbolIndex] === " " || symbolIndex === 0) {
            rowCells.push({ char: " ", sizeMul: 1, tone: 1 })
            continue
          }

          const sizeMul = 1 + (stableNoise(col, row, 99) - 0.5) * variationAmount * 0.5
          const toneCurve = clamp(light * 1.3 + edgeLift * 0.5, 0, 1)
          const tone = 0.25 + toneCurve * 0.75
          rowCells.push({
            char: SYMBOLS[symbolIndex] ?? " ",
            sizeMul: clamp(sizeMul, 0.7, 1.25),
            tone,
          })
          continue
        }

        if (isEmptyCell) {
          rowCells.push({ char: " ", sizeMul: 1, tone: 1 })
          continue
        }

        let normalized = clamp((baseLuminance - 128) * contrastFactor + 128, 0, 255)
        normalized = clamp(normalized * brightnessFactor, 0, 255)
        const edgeLift = clamp(edgeEnergy / 32, 0, 0.25)
        const light = clamp(normalized / 255 + edgeLift, 0, 1)

        const darkness = Math.pow(light, depthPower) * 0.85

        const spread = (stableNoise(row, col, 31) - 0.5) * 0.28
        const varJitter = (stableNoise(row, col, drawWidth + drawHeight) - 0.5) * variationAmount * 0.35
        const randomizedDarkness = clamp(darkness + spread + varJitter, 0, 1)
        const symbolIndex = clamp(Math.round(randomizedDarkness * symbolCount), 0, symbolCount)

        const sizeMul = 1 + (stableNoise(col, row, 99) - 0.5) * variationAmount * 0.5

        const toneCurve = clamp(light * 1.3 + edgeLift * 0.5, 0, 1)
        const tone = 0.25 + toneCurve * 0.75

        rowCells.push({
          char: SYMBOLS[symbolIndex] ?? " ",
          sizeMul: clamp(sizeMul, 0.7, 1.25),
          tone,
        })
      }
      cells.push(rowCells)
    }

    setAsciiData({
      cells,
      columns,
      rowsCount,
      sourceWidth: drawWidth,
      sourceHeight: drawHeight,
      cellWidth,
      cellHeight,
    })
  }, [pixelCacheVer, scale, contrast, brightness, depth, variation, size, isColorInverted])

  useEffect(() => {
    if (!imageUrl) return
    return () => URL.revokeObjectURL(imageUrl)
  }, [imageUrl])

  useEffect(() => {
    function preventBrowserFileOpen(event) {
      event.preventDefault()
    }
    window.addEventListener("dragover", preventBrowserFileOpen)
    window.addEventListener("drop", preventBrowserFileOpen)
    return () => {
      window.removeEventListener("dragover", preventBrowserFileOpen)
      window.removeEventListener("drop", preventBrowserFileOpen)
    }
  }, [])

  useEffect(() => {
    function updatePreviewViewport() {
      if (!previewContainerRef.current) return
      const availableWidth = previewContainerRef.current.clientWidth - 16
      const availableHeight = previewContainerRef.current.clientHeight - 16
      if (availableWidth <= 0 || availableHeight <= 0) return
      setPreviewViewport({ width: Math.round(availableWidth), height: Math.round(availableHeight) })
    }

    const frameId = requestAnimationFrame(updatePreviewViewport)
    const observer = new ResizeObserver(updatePreviewViewport)
    if (previewContainerRef.current) observer.observe(previewContainerRef.current)
    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [imageUrl])

  useEffect(() => {
    if (activeTab !== "image" || !previewCanvasRef.current || !asciiData) return
    renderAsciiFrame(previewCanvasRef.current, asciiData, { size, isInverted })
  }, [activeTab, asciiData, size, isInverted])

  useEffect(() => {
    if (activeTab !== "video" || !previewCanvasRef.current || !asciiData) return
    let frameId = 0
    const start = performance.now()

    function tick(now) {
      const t = ((now - start) % ANIM_CYCLE_MS) / ANIM_CYCLE_MS
      renderAsciiFrame(previewCanvasRef.current, asciiData, {
        size,
        isInverted,
        animChaos,
        animAmplitude,
        animDensity,
        t,
      })
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [activeTab, asciiData, size, isInverted, animChaos, animAmplitude, animDensity])

  function applyPreset(name) {
    const preset = PRESETS[name]
    if (!preset) return
    setScale(preset.scale)
    setSize(preset.size)
    setVariation(preset.variation)
    setContrast(preset.contrast)
    setBrightness(preset.brightness)
    setDepth(preset.depth)
  }

  function updateImage(file) {
    if (!file || !file.type.startsWith("image/")) return
    setImageUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl)
      return URL.createObjectURL(file)
    })
    setContentAnchorSize(null)
    setAsciiData(null)
    setPreviewViewport(null)
    setUserZoom(1)
    setPan({ x: 0, y: 0 })
  }

  function handleDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = 0
    setIsDragging(false)
    updateImage(event.dataTransfer.files?.[0])
  }

  function handleDragEnter(event) {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  function handleDragOver(event) {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = "copy"
    setIsDragging(true)
  }

  function handleDragLeave(event) {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDragging(false)
  }

  function handleUploadChange(event) {
    updateImage(event.target.files?.[0])
  }

  function downloadAsciiPng(exportScale) {
    if (!asciiData) return
    const canvas = document.createElement("canvas")
    renderAsciiFrame(canvas, asciiData, { size, isInverted, scale: exportScale })
    const link = document.createElement("a")
    link.href = canvas.toDataURL("image/png")
    link.download = `ascii-${exportScale}x.png`
    link.click()
  }

  function handleExportClick() {
    if (activeTab === "image") {
      setShowExportOptions(true)
      setTimeout(() => setShowExportOptions(false), EXPORT_REVEAL_MS)
    } else {
      exportMp4()
    }
  }

  async function exportMp4() {
    if (!asciiData || isExporting) return
    if (typeof VideoEncoder === "undefined") {
      alert("Video export requires a browser with WebCodecs support: Chrome, Edge, Opera, or Safari 17+.\n\nFirefox is not supported.")
      return
    }

    setIsExporting(true)
    setExportProgress(0)

    const snap = {
      size,
      isInverted,
      animChaos,
      animAmplitude,
      animDensity,
      fillBackground: true,
    }
    const snapData = asciiData

    try {
      const { Muxer, ArrayBufferTarget } = await import("mp4-muxer")

      const baseW = Math.max(1, Math.ceil(snapData.sourceWidth))
      const baseH = Math.max(1, Math.ceil(snapData.sourceHeight))
      const encWidth = (baseW + 1) & ~1
      const encHeight = (baseH + 1) & ~1

      const H264_PROFILES = [
        "avc1.640034", "avc1.640033", "avc1.640032", "avc1.64002a",
        "avc1.640028", "avc1.4d0034", "avc1.4d0032", "avc1.42003e", "avc1.42001f",
      ]

      const ACCEL_MODES = ["no-preference", "prefer-software"]

      let resolvedConfig = null
      for (const accel of ACCEL_MODES) {
        for (const codec of H264_PROFILES) {
          const candidate = {
            codec, width: encWidth, height: encHeight,
            bitrate: 4_000_000, framerate: EXPORT_FPS, hardwareAcceleration: accel,
          }
          const result = await VideoEncoder.isConfigSupported(candidate)
          if (result.supported) {
            resolvedConfig = result.config ?? candidate
            break
          }
        }
        if (resolvedConfig) break
      }

      if (!resolvedConfig) {
        throw new Error(`No supported H.264 profile found for ${encWidth}x${encHeight}. Try a smaller image.`)
      }

      const offscreen = document.createElement("canvas")
      offscreen.width = encWidth
      offscreen.height = encHeight

      const target = new ArrayBufferTarget()
      const muxer = new Muxer({
        target,
        video: { codec: "avc", width: encWidth, height: encHeight },
        fastStart: "in-memory",
      })

      let encoderError = null
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => { encoderError = e },
      })

      encoder.configure(resolvedConfig)

      for (let i = 0; i < EXPORT_FRAMES; i++) {
        if (encoderError) throw encoderError

        const t = i / EXPORT_FRAMES
        renderAsciiFrame(offscreen, snapData, {
          ...snap, t, canvasWidth: encWidth, canvasHeight: encHeight,
        })

        const bitmap = await createImageBitmap(offscreen)
        const frame = new VideoFrame(bitmap, {
          timestamp: Math.round((i * 1_000_000) / EXPORT_FPS),
        })
        bitmap.close()

        encoder.encode(frame, { keyFrame: i % 30 === 0 })
        frame.close()

        if (encoder.encodeQueueSize > 10) {
          await new Promise((r) => setTimeout(r, 1))
        }

        if (i % 6 === 0) {
          setExportProgress((i + 1) / EXPORT_FRAMES)
          await new Promise((r) => setTimeout(r, 0))
        }
      }

      await encoder.flush()
      if (encoderError) throw encoderError
      muxer.finalize()

      const blob = new Blob([target.buffer], { type: "video/mp4" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "ascii-animation.mp4"
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      console.error("Export failed:", err)
      alert("Export failed: " + (err?.message || String(err)))
    }

    setIsExporting(false)
    setExportProgress(0)
  }

  function handleOptionsScroll(event) {
    const el = event.currentTarget
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8
    setOptionsAtBottom(atBottom)
  }

  function handlePreviewWheel(event) {
    event.preventDefault()
    const factor = Math.exp(-event.deltaY * 0.0015)
    setUserZoom((current) => clamp(current * factor, 0.25, 8))
  }

  function handlePreviewMouseDown(event) {
    if (!imageUrl || event.button !== 0) return
    event.preventDefault()
    isPanningRef.current = true
    panStartRef.current = { x: event.clientX, y: event.clientY }
    panOriginRef.current = pan
  }

  function handlePreviewMouseMove(event) {
    if (!isPanningRef.current) return
    const dx = event.clientX - panStartRef.current.x
    const dy = event.clientY - panStartRef.current.y
    setPan({ x: panOriginRef.current.x + dx, y: panOriginRef.current.y + dy })
  }

  function stopPanning() {
    isPanningRef.current = false
  }

  const fitScale =
    previewViewport && contentAnchorSize
      ? Math.min(
          1,
          previewViewport.width / contentAnchorSize.width,
          previewViewport.height / contentAnchorSize.height
        )
      : 1

  return (
    <div className="relative h-full overflow-hidden bg-[#050505] text-[#F8F8F8]">
      {isSplashVisible ? (
        <section
          className={`absolute inset-0 z-50 flex items-center justify-center bg-[#050505] transition-opacity ${
            isSplashFading ? "opacity-0 duration-200" : "opacity-100 duration-0"
          }`}
        >
          <div className="flex flex-col items-center" style={{ gap: isMobile ? 16 : 24 }}>
            <img
              src="/splash-image.png"
              alt="asciifast splash mark"
              style={{ width: isMobile ? 120 : 200, height: isMobile ? 120 : 200, borderRadius: isMobile ? 28 : 48, objectFit: "cover" }}
            />
            <div className="flex flex-col items-center" style={{ gap: isMobile ? 12 : 16 }}>
              <p
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: isMobile ? 12 : 14,
                  fontWeight: 400,
                  letterSpacing: "-0.04em",
                  textAlign: "center",
                  lineHeight: "1.25em",
                }}
              >
                <span style={{ color: "#F8F8F8" }}>asciifast</span>
                <span style={{ color: "#7E7E7E" }}> 3.0</span>
              </p>
              <div
                className="rounded-full bg-[#2E2E2E] overflow-hidden"
                style={{ width: isMobile ? 100 : 160, height: isMobile ? 6 : 8 }}
              >
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#747474_0%,#F8F8F8_100%)]"
                  style={{ width: `${splashProgress * 100}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <MenuModal isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} isMobile={isMobile} />

      <div
        className={`h-full transition-all duration-300 ${
          isSplashVisible ? "scale-[0.992] opacity-0" : "scale-100 opacity-100"
        }`}
      >
        {isMobile ? (
          /* ===================== MOBILE LAYOUT ===================== */
          <MobileLayout
            inputRef={inputRef}
            previewContainerRef={previewContainerRef}
            previewCanvasRef={previewCanvasRef}
            mobileScrollRef={mobileScrollRef}
            mobileHeaderRef={mobileHeaderRef}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            imageUrl={imageUrl}
            asciiData={asciiData}
            contentAnchorSize={contentAnchorSize}
            fitScale={fitScale}
            userZoom={userZoom}
            pan={pan}
            isInverted={isInverted}
            setIsInverted={setIsInverted}
            isColorInverted={isColorInverted}
            setIsColorInverted={setIsColorInverted}
            isPanningRef={isPanningRef}
            scale={scale}
            setScale={setScale}
            size={size}
            setSize={setSize}
            variation={variation}
            setVariation={setVariation}
            contrast={contrast}
            setContrast={setContrast}
            brightness={brightness}
            setBrightness={setBrightness}
            depth={depth}
            setDepth={setDepth}
            animChaos={animChaos}
            setAnimChaos={setAnimChaos}
            animAmplitude={animAmplitude}
            setAnimAmplitude={setAnimAmplitude}
            animDensity={animDensity}
            setAnimDensity={setAnimDensity}
            isExporting={isExporting}
            exportProgress={exportProgress}
            showExportOptions={showExportOptions}
            setShowExportOptions={setShowExportOptions}
            handleExportClick={handleExportClick}
            downloadAsciiPng={downloadAsciiPng}
            applyPreset={applyPreset}
            handleDragEnter={handleDragEnter}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            handlePreviewWheel={handlePreviewWheel}
            handlePreviewMouseDown={handlePreviewMouseDown}
            handlePreviewMouseMove={handlePreviewMouseMove}
            stopPanning={stopPanning}
            setIsMenuOpen={setIsMenuOpen}
            mobilePreviewStuck={mobilePreviewStuck}
            setMobilePreviewStuck={setMobilePreviewStuck}
            mobileOptionsFadeTop={mobileOptionsFadeTop}
            setMobileOptionsFadeTop={setMobileOptionsFadeTop}
          />
        ) : (
          /* ===================== DESKTOP LAYOUT (unchanged) ===================== */
          <div className="flex h-full" style={{ padding: 24, gap: 24 }}>
            {/* Left column */}
            <div className="flex flex-1 min-w-0 flex-col" style={{ gap: 24 }}>
              {/* Title bar — h=88 */}
              <div
                className="flex shrink-0 items-center justify-between rounded-[24px] bg-[#0D0D0D]"
                style={{ height: 88, paddingLeft: 16, paddingRight: 16 }}
              >
                <div className="flex h-[56px] w-[56px] items-center justify-center">
                  <LogoIcon />
                </div>
                <p
                  className="text-[18px] font-normal tracking-[-0.02em] text-[#BABABA]/60"
                  style={{ fontFamily: "'Geist Mono', monospace" }}
                >
                  asciifast
                </p>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(true)}
                  className="flex h-[56px] w-[56px] items-center justify-center transition-opacity hover:opacity-80"
                >
                  <MenuSvgIcon />
                </button>
              </div>

              {/* Preview area — fills remaining */}
              <div
                className="relative flex flex-1 min-h-0 overflow-hidden rounded-[24px]"
                style={{ padding: 1, background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)" }}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div
                  className="flex-1 rounded-[23px] overflow-hidden"
                  style={{ background: "linear-gradient(180deg, rgba(23,23,23,1) 0%, rgba(21,21,21,1) 100%)" }}
                >
                  <div className="m-[8px] rounded-[16px] overflow-hidden h-[calc(100%-16px)]">
                    <div
                      ref={previewContainerRef}
                      className="staggered-dots relative flex h-full w-full items-center justify-center overflow-hidden"
                      style={{ cursor: imageUrl ? (isPanningRef.current ? "grabbing" : "grab") : "default" }}
                      onWheel={imageUrl ? handlePreviewWheel : undefined}
                      onMouseDown={imageUrl ? handlePreviewMouseDown : undefined}
                      onMouseMove={imageUrl ? handlePreviewMouseMove : undefined}
                      onMouseUp={imageUrl ? stopPanning : undefined}
                      onMouseLeave={imageUrl ? stopPanning : undefined}
                    >
                      {!imageUrl ? (
                        <button
                          type="button"
                          onClick={() => inputRef.current?.click()}
                          className="flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/[0.02] px-4 py-2.5 text-[14px] font-medium text-[#F2F2F2] backdrop-blur-[24px] transition-colors hover:bg-white/10"
                          style={{ fontFamily: "'Geist Mono', monospace" }}
                        >
                          + Upload image
                        </button>
                      ) : (
                        <div
                          className={`absolute overflow-hidden rounded ${isInverted ? "bg-black" : "bg-white"}`}
                          style={{
                            width: contentAnchorSize ? `${contentAnchorSize.width * fitScale * userZoom}px` : "100%",
                            height: contentAnchorSize ? `${contentAnchorSize.height * fitScale * userZoom}px` : "100%",
                            left: "50%",
                            top: "50%",
                            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
                          }}
                        >
                          <canvas
                            ref={previewCanvasRef}
                            style={{ display: "block", width: "100%", height: "100%" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column — w=438 */}
            <div className="flex flex-col shrink-0" style={{ width: 438, gap: 24 }}>
              {/* Tabs — h=88 */}
              <div
                className="relative flex shrink-0 items-center"
                style={{ height: 88, borderRadius: 96, background: "#0D0D0D", padding: 6 }}
              >
                <div
                  className="pointer-events-none absolute transition-[left] duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{
                    width: "calc(50% - 6px)",
                    height: "calc(100% - 12px)",
                    top: 6,
                    left: activeTab === "image" ? 6 : "calc(50%)",
                    borderRadius: 967,
                    background: "rgba(255,255,255,0.1)",
                    boxShadow: SKEU_TAB_SHADOW,
                  }}
                />
                {["image", "video"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className="relative z-10 flex-1 text-center transition-colors duration-200 hover:brightness-110"
                    style={{
                      height: "100%",
                      borderRadius: 967,
                      fontFamily: "Inter, sans-serif",
                      fontSize: 15,
                      fontWeight: 400,
                      letterSpacing: "-0.04em",
                      color: activeTab === tab ? "#F2F2F2" : "#BABABA",
                    }}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Dark image mode & Invert Colors */}
              <div
                className="flex shrink-0 flex-col gap-[22px] rounded-[20px] bg-[#0D0D0D] overflow-hidden"
                style={{ padding: 24 }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, fontWeight: 300, letterSpacing: "-0.01em", color: "#BCBCBC" }}>
                    Dark Image Mode
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsInverted((c) => !c)}
                    className="relative shrink-0 rounded-full transition-colors"
                    style={{ width: 36, height: 20, background: isInverted ? "#E6E6E6" : "#333" }}
                  >
                    <span
                      className="absolute top-[2px] block rounded-full transition-[left] duration-200"
                      style={{ width: 16, height: 16, background: isInverted ? "#0D0D0D" : "#888", left: isInverted ? 18 : 2 }}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, fontWeight: 300, letterSpacing: "-0.01em", color: "#BCBCBC" }}>
                    Invert Colors
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsColorInverted((c) => !c)}
                    className="relative shrink-0 rounded-full transition-colors"
                    style={{ width: 36, height: 20, background: isColorInverted ? "#E6E6E6" : "#333" }}
                  >
                    <span
                      className="absolute top-[2px] block rounded-full transition-[left] duration-200"
                      style={{ width: 16, height: 16, background: isColorInverted ? "#0D0D0D" : "#888", left: isColorInverted ? 18 : 2 }}
                    />
                  </button>
                </div>
              </div>

              {activeTab === "video" && (
                <div className="shrink-0 rounded-[24px] bg-[#0D0D0D] overflow-hidden" style={{ padding: 24 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <SliderRow label="Chaos" value={animChaos} onChange={setAnimChaos} />
                    <SliderRow label="Amplitude" value={animAmplitude} onChange={setAnimAmplitude} />
                    <SliderRow label="Animation density" value={animDensity} onChange={setAnimDensity} />
                  </div>
                </div>
              )}

              {/* Options panel */}
              <div className="relative flex-1 min-h-0 rounded-[24px] bg-[#0D0D0D] overflow-hidden">
                <div ref={optionsScrollRef} className="h-full overflow-y-auto thin-scrollbar" style={{ padding: 24 }} onScroll={handleOptionsScroll}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <SliderRow label="Scale" value={scale} onChange={setScale} />
                    <SliderRow label="Size" value={size} onChange={setSize} />
                    <SliderRow label="Variation" value={variation} onChange={setVariation} />
                    <SliderRow label="Contrast" value={contrast} onChange={setContrast} />
                    <SliderRow label="Brightness" value={brightness} onChange={setBrightness} />
                    <SliderRow label="Depth" value={depth} onChange={setDepth} />
                  </div>

                  <div style={{ height: 40 }} />

                  <div className="grid grid-cols-2" style={{ rowGap: 8, columnGap: 6 }}>
                    {PRESET_BUTTONS.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => applyPreset(preset.key)}
                        className="transition-colors hover:bg-white/10"
                        style={{
                          padding: "16px 24px",
                          borderRadius: 967,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.02)",
                          fontFamily: "'Geist Mono', monospace",
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#F2F2F2",
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ height: 40 }} />
                </div>
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 transition-opacity duration-200"
                  style={{
                    height: 168,
                    background: "linear-gradient(180deg, rgba(13,13,13,0) 0%, rgba(13,13,13,1) 93%)",
                    opacity: optionsAtBottom ? 0 : 1,
                  }}
                />
              </div>

              {/* Export bar — h=88 */}
              <div
                className="flex shrink-0 items-center"
                style={{ height: 88, borderRadius: 48, background: "#0D0D0D", padding: 6 }}
              >
                {isExporting ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4">
                    <div className="h-2 w-full rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#DADADA]"
                        style={{ width: `${Math.round(exportProgress * 100)}%`, transition: "width 0.15s" }}
                      />
                    </div>
                    <p className="text-xs text-white/50">{Math.round(exportProgress * 100)}%</p>
                  </div>
                ) : showExportOptions && activeTab === "image" ? (
                  <div className="flex flex-1 gap-1" style={{ height: "100%" }}>
                    <button
                      type="button"
                      disabled={!asciiData}
                      onClick={() => { downloadAsciiPng(1); setShowExportOptions(false) }}
                      className="skeu-btn flex-1 text-center disabled:opacity-40"
                      style={{
                        borderRadius: 967,
                        boxShadow: SKEU_BTN_SHADOW,
                        fontFamily: "Inter, sans-serif",
                        fontSize: 15,
                        fontWeight: 400,
                        letterSpacing: "-0.04em",
                        color: "#F2F2F2",
                      }}
                    >
                      PNG X1
                    </button>
                    <button
                      type="button"
                      disabled={!asciiData}
                      onClick={() => { downloadAsciiPng(2); setShowExportOptions(false) }}
                      className="skeu-btn flex-1 text-center disabled:opacity-40"
                      style={{
                        borderRadius: 967,
                        boxShadow: SKEU_BTN_SHADOW,
                        fontFamily: "Inter, sans-serif",
                        fontSize: 15,
                        fontWeight: 400,
                        letterSpacing: "-0.04em",
                        color: "#F2F2F2",
                      }}
                    >
                      PNG X2
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-1 gap-1" style={{ height: "100%" }}>
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="skeu-btn flex items-center justify-center"
                      style={{
                        width: 76,
                        borderRadius: 967,
                        boxShadow: SKEU_BTN_SHADOW,
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M9 2.25V15.75M2.25 9H15.75" stroke="#F2F2F2" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      disabled={!asciiData}
                      onClick={handleExportClick}
                      className="skeu-btn flex-1 text-center disabled:opacity-40"
                      style={{
                        borderRadius: 967,
                        boxShadow: SKEU_BTN_SHADOW,
                        fontFamily: "Inter, sans-serif",
                        fontSize: 15,
                        fontWeight: 400,
                        letterSpacing: "-0.04em",
                        color: "#F2F2F2",
                      }}
                    >
                      {activeTab === "image" ? "Export" : "Export MP4"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadChange}
      />
    </div>
  )
}

function MobileLayout({
  inputRef, previewContainerRef, previewCanvasRef, mobileScrollRef, mobileHeaderRef,
  activeTab, setActiveTab, imageUrl, asciiData, contentAnchorSize, fitScale, userZoom, pan,
  isInverted, setIsInverted, isColorInverted, setIsColorInverted, isPanningRef,
  scale, setScale, size, setSize, variation, setVariation, contrast, setContrast,
  brightness, setBrightness, depth, setDepth,
  animChaos, setAnimChaos, animAmplitude, setAnimAmplitude, animDensity, setAnimDensity,
  isExporting, exportProgress, showExportOptions, setShowExportOptions,
  handleExportClick, downloadAsciiPng, applyPreset,
  handleDragEnter, handleDragOver, handleDragLeave, handleDrop,
  handlePreviewWheel, handlePreviewMouseDown, handlePreviewMouseMove, stopPanning,
  setIsMenuOpen, mobilePreviewStuck, setMobilePreviewStuck, mobileOptionsFadeTop, setMobileOptionsFadeTop,
}) {
  const stickyBarHeight = 94

  const handleMobileScroll = useCallback((e) => {
    const el = e.currentTarget
    const headerEl = mobileHeaderRef.current
    if (!headerEl) return
    const headerBottom = headerEl.offsetTop + headerEl.offsetHeight
    setMobilePreviewStuck(el.scrollTop >= headerBottom)
    setMobileOptionsFadeTop(el.scrollTop > headerBottom + 40)
  }, [mobileHeaderRef, setMobilePreviewStuck, setMobileOptionsFadeTop])

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Scrollable area */}
      <div
        ref={mobileScrollRef}
        className="flex-1 overflow-y-auto hide-scrollbar"
        style={{ paddingBottom: stickyBarHeight + 16 }}
        onScroll={handleMobileScroll}
      >
        {/* Header (no bg on mobile) */}
        <div
          ref={mobileHeaderRef}
          className="flex items-center justify-between"
          style={{ height: 56, paddingLeft: 16, paddingRight: 10 }}
        >
          <div className="flex h-[40px] w-[40px] items-center justify-center">
            <LogoIcon />
          </div>
          <p
            className="text-[16px] font-normal tracking-[-0.02em] text-[#BABABA]/60"
            style={{ fontFamily: "'Geist Mono', monospace" }}
          >
            asciifast
          </p>
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="flex h-[40px] w-[40px] items-center justify-center transition-opacity hover:opacity-80"
          >
            <MenuSvgIcon />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: "8px 20px" }}>
          <div
            className="relative flex items-center"
            style={{ height: 52, borderRadius: 96, background: "#0D0D0D", padding: 4 }}
          >
            <div
              className="pointer-events-none absolute transition-[left] duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{
                width: "calc(50% - 4px)",
                height: "calc(100% - 8px)",
                top: 4,
                left: activeTab === "image" ? 4 : "calc(50%)",
                borderRadius: 967,
                background: "rgba(255,255,255,0.1)",
                boxShadow: SKEU_TAB_SHADOW,
              }}
            />
            {["image", "video"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="relative z-10 flex-1 text-center transition-colors duration-200"
                style={{
                  height: "100%",
                  borderRadius: 967,
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  fontWeight: 400,
                  letterSpacing: "-0.04em",
                  color: activeTab === tab ? "#F2F2F2" : "#BABABA",
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Preview area (sticky) */}
        <div
          className="sticky top-0 z-20"
          style={{ padding: "8px 20px 0 20px", background: "#050505" }}
        >
          <div
            className="relative overflow-hidden rounded-[24px]"
            style={{ padding: 1, background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)" }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div
              className="rounded-[23px] overflow-hidden"
              style={{
                background: "linear-gradient(180deg, rgba(23,23,23,1) 0%, rgba(21,21,21,1) 100%)",
                aspectRatio: "1 / 1",
              }}
            >
              <div className="m-[8px] rounded-[16px] overflow-hidden h-[calc(100%-16px)]">
                <div
                  ref={previewContainerRef}
                  className="staggered-dots relative flex h-full w-full items-center justify-center overflow-hidden"
                  style={{ cursor: imageUrl ? "grab" : "default", touchAction: "none" }}
                  onWheel={imageUrl ? handlePreviewWheel : undefined}
                  onMouseDown={imageUrl ? handlePreviewMouseDown : undefined}
                  onMouseMove={imageUrl ? handlePreviewMouseMove : undefined}
                  onMouseUp={imageUrl ? stopPanning : undefined}
                  onMouseLeave={imageUrl ? stopPanning : undefined}
                >
                  {!imageUrl ? (
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/[0.02] px-3 py-2 text-[13px] font-medium text-[#F2F2F2] backdrop-blur-[24px] transition-colors hover:bg-white/10"
                      style={{ fontFamily: "'Geist Mono', monospace" }}
                    >
                      + Upload image
                    </button>
                  ) : (
                    <div
                      className={`absolute overflow-hidden rounded ${isInverted ? "bg-black" : "bg-white"}`}
                      style={{
                        width: contentAnchorSize ? `${contentAnchorSize.width * fitScale * userZoom}px` : "100%",
                        height: contentAnchorSize ? `${contentAnchorSize.height * fitScale * userZoom}px` : "100%",
                        left: "50%",
                        top: "50%",
                        transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
                      }}
                    >
                      <canvas
                        ref={previewCanvasRef}
                        style={{ display: "block", width: "100%", height: "100%" }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Shade marker + bottom fade attached to sticky preview */}
          <div className="flex justify-center relative" style={{ padding: "8px 0" }}>
            <div style={{ width: 24, height: 4, borderRadius: 2, background: "#333333" }} />
            <div
              className="pointer-events-none absolute left-0 right-0 transition-opacity duration-200"
              style={{
                top: "100%",
                height: 24,
                background: "linear-gradient(180deg, #050505 0%, rgba(5,5,5,0) 100%)",
                opacity: mobilePreviewStuck ? 1 : 0,
              }}
            />
          </div>
        </div>

        {/* Options (scrollable content) */}
        <div className="relative" style={{ padding: "0 20px" }}>
          {/* Dark Image Mode & Invert Colors */}
          <div
            className="flex flex-col gap-[18px] rounded-[16px] bg-[#0D0D0D] overflow-hidden"
            style={{ padding: "18px 20px" }}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 300, letterSpacing: "-0.01em", color: "#BCBCBC" }}>
                Dark Image Mode
              </span>
              <button
                type="button"
                onClick={() => setIsInverted((c) => !c)}
                className="relative shrink-0 rounded-full transition-colors"
                style={{ width: 36, height: 20, background: isInverted ? "#E6E6E6" : "#333" }}
              >
                <span
                  className="absolute top-[2px] block rounded-full transition-[left] duration-200"
                  style={{ width: 16, height: 16, background: isInverted ? "#0D0D0D" : "#888", left: isInverted ? 18 : 2 }}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 300, letterSpacing: "-0.01em", color: "#BCBCBC" }}>
                Invert Colors
              </span>
              <button
                type="button"
                onClick={() => setIsColorInverted((c) => !c)}
                className="relative shrink-0 rounded-full transition-colors"
                style={{ width: 36, height: 20, background: isColorInverted ? "#E6E6E6" : "#333" }}
              >
                <span
                  className="absolute top-[2px] block rounded-full transition-[left] duration-200"
                  style={{ width: 16, height: 16, background: isColorInverted ? "#0D0D0D" : "#888", left: isColorInverted ? 18 : 2 }}
                />
              </button>
            </div>
          </div>

          <div style={{ height: 16 }} />

          {/* Video sliders */}
          {activeTab === "video" && (
            <>
              <div className="rounded-[16px] bg-[#0D0D0D] overflow-hidden" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <SliderRow label="Chaos" value={animChaos} onChange={setAnimChaos} fontSize={13} />
                  <SliderRow label="Amplitude" value={animAmplitude} onChange={setAnimAmplitude} fontSize={13} />
                  <SliderRow label="Animation density" value={animDensity} onChange={setAnimDensity} fontSize={13} />
                </div>
              </div>
              <div style={{ height: 16 }} />
            </>
          )}

          {/* Sliders panel */}
          <div className="rounded-[16px] bg-[#0D0D0D] overflow-hidden" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <SliderRow label="Scale" value={scale} onChange={setScale} fontSize={13} />
              <SliderRow label="Size" value={size} onChange={setSize} fontSize={13} />
              <SliderRow label="Variation" value={variation} onChange={setVariation} fontSize={13} />
              <SliderRow label="Contrast" value={contrast} onChange={setContrast} fontSize={13} />
              <SliderRow label="Brightness" value={brightness} onChange={setBrightness} fontSize={13} />
              <SliderRow label="Depth" value={depth} onChange={setDepth} fontSize={13} />
            </div>
          </div>

          <div style={{ height: 16 }} />

          {/* Preset buttons */}
          <div className="grid grid-cols-2" style={{ rowGap: 6, columnGap: 6 }}>
            {PRESET_BUTTONS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset.key)}
                className="transition-colors hover:bg-white/10"
                style={{
                  padding: "14px 20px",
                  borderRadius: 967,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.02)",
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#F2F2F2",
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div style={{ height: 24 }} />
        </div>
      </div>

      {/* Sticky bottom export bar */}
      <div
        className="absolute inset-x-0 bottom-0 z-30 safe-bottom"
        style={{
          background: "linear-gradient(180deg, #212121 6%, #050505 100%)",
          borderRadius: "28px 28px 0 0",
        }}
      >
        <div
          className="flex items-stretch"
          style={{ height: 42, padding: "12px 12px 0 12px", gap: 4, boxSizing: "content-box" }}
        >
          {isExporting ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4" style={{ height: 42 }}>
              <div className="h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#DADADA]"
                  style={{ width: `${Math.round(exportProgress * 100)}%`, transition: "width 0.15s" }}
                />
              </div>
              <p className="text-xs text-white/50">{Math.round(exportProgress * 100)}%</p>
            </div>
          ) : showExportOptions && activeTab === "image" ? (
            <>
              <button
                type="button"
                disabled={!asciiData}
                onClick={() => { downloadAsciiPng(1); setShowExportOptions(false) }}
                className="skeu-btn flex-1 text-center disabled:opacity-40"
                style={{
                  height: 42,
                  borderRadius: 967,
                  boxShadow: SKEU_BTN_SHADOW,
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  fontWeight: 400,
                  letterSpacing: "-0.04em",
                  color: "#F2F2F2",
                }}
              >
                PNG X1
              </button>
              <button
                type="button"
                disabled={!asciiData}
                onClick={() => { downloadAsciiPng(2); setShowExportOptions(false) }}
                className="skeu-btn flex-1 text-center disabled:opacity-40"
                style={{
                  height: 42,
                  borderRadius: 967,
                  boxShadow: SKEU_BTN_SHADOW,
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  fontWeight: 400,
                  letterSpacing: "-0.04em",
                  color: "#F2F2F2",
                }}
              >
                PNG X2
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="skeu-btn flex items-center justify-center"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 967,
                  boxShadow: SKEU_BTN_SHADOW,
                  flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2.25V15.75M2.25 9H15.75" stroke="#F2F2F2" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                disabled={!asciiData}
                onClick={handleExportClick}
                className="skeu-btn flex-1 text-center disabled:opacity-40"
                style={{
                  height: 42,
                  borderRadius: 967,
                  boxShadow: SKEU_BTN_SHADOW,
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  fontWeight: 400,
                  letterSpacing: "-0.04em",
                  color: "#F2F2F2",
                }}
              >
                {activeTab === "image" ? "Export" : "Export MP4"}
              </button>
            </>
          )}
        </div>
        {/* Home indicator */}
        <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="mobile-home-indicator" />
        </div>
      </div>
    </div>
  )
}

export default App
