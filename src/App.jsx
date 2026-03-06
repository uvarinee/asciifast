import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

const SYMBOLS = " .,:1i7r352x4ea6k890dNM#&@"

const PRESETS = {
  balanced: { charSize: 10, variation: 0, density: 8, contrast: 100, brightness: 100, depth: 100 },
  detail: { charSize: 9, variation: 20, density: 5, contrast: 120, brightness: 100, depth: 120 },
  punchy: { charSize: 10, variation: 10, density: 7, contrast: 145, brightness: 95, depth: 135 },
  soft: { charSize: 11, variation: 15, density: 9, contrast: 85, brightness: 110, depth: 85 },
  sketch: { charSize: 10, variation: 35, density: 7, contrast: 110, brightness: 105, depth: 95 },
  bold: { charSize: 9, variation: 25, density: 6, contrast: 165, brightness: 92, depth: 155 },
}

const PRESET_BUTTONS = [
  { key: "balanced", label: "Balanced" },
  { key: "detail", label: "Detail" },
  { key: "punchy", label: "Punchy" },
  { key: "soft", label: "Soft" },
  { key: "sketch", label: "Sketch" },
  { key: "bold", label: "Bold" },
]

const SPLASH_DURATION_MS = 2000
const SPLASH_FADE_MS = 220
const ANIM_CYCLE_MS = 6000
const EXPORT_FPS = 30
const EXPORT_FRAMES = EXPORT_FPS * 6
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
  const charSz = opts.charSize ?? 10
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
  ctx.fillStyle = inverted ? "#ffffff" : "#000000"

  const TWO_PI = Math.PI * 2
  const symLen = SYMBOLS.length - 1
  const animated = animT != null && (chaos > 0 || amp > 0) && aDensity > 0
  const fontSizeBase = Math.max(1, data.cellHeight * 0.9) * (charSz / 10)
  const halfCellW = data.cellWidth * 0.5
  const halfCellH = data.cellHeight * 0.5
  let lastFontSize = -1

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
      ctx.fillText(char, col * data.cellWidth + halfCellW, row * data.cellHeight + halfCellH)
    }
  }
}

function App() {
  const inputRef = useRef(null)
  const previewContainerRef = useRef(null)
  const previewCanvasRef = useRef(null)
  const pixelCacheRef = useRef(null)
  const dragDepthRef = useRef(0)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const panOriginRef = useRef({ x: 0, y: 0 })

  const [activeTab, setActiveTab] = useState("image")
  const [imageUrl, setImageUrl] = useState("")
  const [asciiData, setAsciiData] = useState(null)
  const [previewViewport, setPreviewViewport] = useState(null)
  const [contentAnchorSize, setContentAnchorSize] = useState(null)
  const [userZoom, setUserZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isInverted, setIsInverted] = useState(true)
  const [splashProgress, setSplashProgress] = useState(0)
  const [isSplashVisible, setIsSplashVisible] = useState(true)
  const [isSplashFading, setIsSplashFading] = useState(false)

  const [charSize, setCharSize] = useState(10)
  const [variation, setVariation] = useState(0)
  const [density, setDensity] = useState(8)
  const [contrast, setContrast] = useState(100)
  const [brightness, setBrightness] = useState(100)
  const [depth, setDepth] = useState(100)

  const [animChaos, setAnimChaos] = useState(50)
  const [animAmplitude, setAnimAmplitude] = useState(30)
  const [animDensity, setAnimDensity] = useState(40)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [pixelCacheVer, setPixelCacheVer] = useState(0)

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

    const safeDensity = clamp(Math.round(density), 2, 18)
    const contrastFactor = clamp(contrast, 50, 200) / 100
    const brightnessFactor = clamp(brightness, 50, 200) / 100
    const depthPower = clamp(depth, 50, 200) / 100
    const variationAmount = clamp(variation, 0, 100) / 100

    const lineHeight = charSize * 1.1
    const measureCanvas = document.createElement("canvas")
    const measureContext = measureCanvas.getContext("2d")
    if (!measureContext) return
    measureContext.font = `${charSize}px monospace`
    const charWidth = measureContext.measureText("M").width || charSize * 0.6

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
        if (centerPixel.a < 16 || isFlatBackground) {
          rowCells.push({ char: " ", sizeMul: 1 })
          continue
        }

        let normalized = clamp((baseLuminance - 128) * contrastFactor + 128, 0, 255)
        normalized = clamp(normalized * brightnessFactor, 0, 255)
        const edgeLift = clamp(edgeEnergy / 32, 0, 0.25)
        const light = clamp(normalized / 255 + edgeLift, 0, 1)

        const darkness = Math.pow(1 - light, depthPower)
        const jitter = (stableNoise(row, col, drawWidth + drawHeight) - 0.5) * variationAmount * 0.35
        const randomizedDarkness = clamp(darkness + jitter, 0, 1)
        const symbolIndex = Math.round(randomizedDarkness * symbolCount)
        const sizeMul = 1 + (stableNoise(col, row, 99) - 0.5) * variationAmount * 0.7

        rowCells.push({
          char: SYMBOLS[symbolIndex] ?? " ",
          sizeMul: clamp(sizeMul, 0.65, 1.35),
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
  }, [pixelCacheVer, density, contrast, brightness, depth, variation, charSize])

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
    renderAsciiFrame(previewCanvasRef.current, asciiData, { charSize, isInverted })
  }, [activeTab, asciiData, charSize, isInverted])

  useEffect(() => {
    if (activeTab !== "video" || !previewCanvasRef.current || !asciiData) return
    let frameId = 0
    const start = performance.now()

    function tick(now) {
      const t = ((now - start) % ANIM_CYCLE_MS) / ANIM_CYCLE_MS
      renderAsciiFrame(previewCanvasRef.current, asciiData, {
        charSize,
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
  }, [activeTab, asciiData, charSize, isInverted, animChaos, animAmplitude, animDensity])

  function applyPreset(name) {
    const preset = PRESETS[name]
    if (!preset) return
    setCharSize(preset.charSize)
    setVariation(preset.variation)
    setDensity(preset.density)
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

  function downloadAsciiPng(scale) {
    if (!asciiData) return
    const canvas = document.createElement("canvas")
    renderAsciiFrame(canvas, asciiData, { charSize, isInverted, scale })
    const link = document.createElement("a")
    link.href = canvas.toDataURL("image/png")
    link.download = `ascii-${scale}x.png`
    link.click()
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
      charSize,
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
        "avc1.640034",
        "avc1.640033",
        "avc1.640032",
        "avc1.64002a",
        "avc1.640028",
        "avc1.4d0034",
        "avc1.4d0032",
        "avc1.42003e",
        "avc1.42001f",
      ]

      const ACCEL_MODES = ["no-preference", "prefer-software"]

      let resolvedConfig = null
      for (const accel of ACCEL_MODES) {
        for (const codec of H264_PROFILES) {
          const candidate = {
            codec,
            width: encWidth,
            height: encHeight,
            bitrate: 4_000_000,
            framerate: EXPORT_FPS,
            hardwareAcceleration: accel,
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
          ...snap,
          t,
          canvasWidth: encWidth,
          canvasHeight: encHeight,
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
    <div className="relative h-full overflow-hidden bg-background text-foreground">
      {isSplashVisible ? (
        <section
          className={`absolute inset-0 z-50 flex items-center justify-center bg-[#101010] transition-opacity ${
            isSplashFading ? "opacity-0 duration-200" : "opacity-100 duration-0"
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <p className="text-[28px] tracking-[-0.04em] text-white/90">asciifast</p>
            <img
              src="/splash-image.png"
              alt="asciifast splash mark"
              className="h-[200px] w-[200px] rounded-[12px] object-cover"
            />
            <div className="mt-1 h-[8px] w-[160px] rounded-[4px] bg-[#2E2E2E] p-0">
              <div
                className="h-full rounded-[4px] bg-[linear-gradient(90deg,#747474_0%,#F8F8F8_100%)]"
                style={{ width: `${splashProgress * 100}%` }}
              />
            </div>
            <p className="text-[14px] tracking-[-0.08em] text-[#7E7E7E] [font-family:'JetBrains_Mono',monospace]">
              2.0
            </p>
          </div>
        </section>
      ) : null}

      <div
        className={`h-full p-2 md:p-4 transition-all duration-300 ${
          isSplashVisible ? "scale-[0.992] opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <div className="flex h-full flex-col gap-2 md:flex-row md:gap-3">
          <section className="flex min-w-0 flex-col overflow-hidden rounded-[24px] max-md:rounded-[16px] bg-[#1A1A1A] p-2 max-md:order-2 max-md:h-[38vh] max-md:shrink-0 md:w-[70%] md:p-4">
            <p className="mb-3 text-sm tracking-wide text-white/80 max-md:hidden">Preview</p>
            <div
              ref={previewContainerRef}
              className="relative flex flex-1 min-h-0 md:min-h-[420px] items-center justify-center overflow-hidden rounded-[16px]"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(144,144,144,0.36) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
                backgroundColor: "#141414",
                cursor: imageUrl ? (isPanningRef.current ? "grabbing" : "grab") : "default",
              }}
              onWheel={imageUrl ? handlePreviewWheel : undefined}
              onMouseDown={imageUrl ? handlePreviewMouseDown : undefined}
              onMouseMove={imageUrl ? handlePreviewMouseMove : undefined}
              onMouseUp={imageUrl ? stopPanning : undefined}
              onMouseLeave={imageUrl ? stopPanning : undefined}
            >
              {!imageUrl ? (
                <div className="flex h-full w-full items-center justify-center rounded-[16px] border border-dashed border-white/20 bg-[#161616]/62 text-sm text-white/45">
                  Upload an image to see ASCII preview
                </div>
              ) : (
                <div
                  className={`flex shrink-0 items-center justify-center overflow-hidden rounded ${
                    isInverted ? "bg-black" : "bg-white"
                  }`}
                  style={{
                    width: contentAnchorSize ? `${contentAnchorSize.width}px` : "100%",
                    height: contentAnchorSize ? `${contentAnchorSize.height}px` : "100%",
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${fitScale * userZoom})`,
                    transformOrigin: "center center",
                  }}
                >
                  <canvas
                    ref={previewCanvasRef}
                    style={{ display: "block", width: "auto", height: "auto", maxWidth: "none" }}
                  />
                </div>
              )}
            </div>
          </section>

          <div className="max-md:contents md:flex md:min-w-[320px] md:w-[30%] md:flex-col md:gap-3">
            <div className="flex gap-1.5 md:gap-2.5 rounded-[16px] md:rounded-[24px] bg-[#1A1A1A] p-1.5 md:p-3 max-md:order-1 max-md:shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("image")}
                className={`flex-1 rounded-[10px] md:rounded-[16px] py-1.5 md:py-3 text-center text-[13px] md:text-[15px] font-medium tracking-tight transition-colors ${
                  activeTab === "image"
                    ? "bg-[#DADADA] text-[#101010]"
                    : "text-[#DADADA] hover:bg-white/5"
                }`}
              >
                Image
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("video")}
                className={`flex-1 rounded-[10px] md:rounded-[16px] py-1.5 md:py-3 text-center text-[13px] md:text-[15px] font-medium tracking-tight transition-colors ${
                  activeTab === "video"
                    ? "bg-[#DADADA] text-[#101010]"
                    : "text-[#DADADA] hover:bg-white/5"
                }`}
              >
                Video
              </button>
            </div>

            <div className="max-md:order-3 max-md:flex-1 max-md:min-h-0 max-md:overflow-y-auto max-md:space-y-2 md:contents">
            <div
              className={`rounded-[24px] max-md:rounded-[16px] p-2 md:p-4 transition-colors ${
                isDragging ? "bg-[#252525]" : "bg-[#1A1A1A]"
              }`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {!imageUrl ? (
                <div className="space-y-3 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#202020]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 16V6M12 6L8.5 9.5M12 6L15.5 9.5M5 17.5V19H19V17.5"
                        stroke="rgba(248,248,248,0.9)"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-white/50">Upload or drag the image</p>
                  <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
                    Upload image
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <img
                    src={imageUrl}
                    alt="Source preview"
                    className="h-20 md:h-36 w-full rounded-[12px] bg-[#0F0F0F] object-contain p-2"
                  />
                  <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
                    Upload New Image
                  </Button>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadChange}
              />
            </div>

            <section className="flex min-h-0 md:flex-1 flex-col rounded-[24px] max-md:rounded-[16px] bg-[#1A1A1A] p-2 md:p-4">
              <p className="mb-3 text-sm tracking-wide text-white/80 max-md:hidden">Settings</p>
              <div className="space-y-3 md:space-y-4 overflow-y-auto pr-1">
                {activeTab === "video" && (
                  <>
                    <div className="space-y-2">
                      <p className="text-sm text-white/85">Chaos: {animChaos}%</p>
                      <Slider value={[animChaos]} min={0} max={100} step={1} onValueChange={(value) => setAnimChaos(value?.[0] ?? 50)} />
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-white/85">Amplitude: {animAmplitude}%</p>
                      <Slider value={[animAmplitude]} min={0} max={100} step={1} onValueChange={(value) => setAnimAmplitude(value?.[0] ?? 30)} />
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-white/85">Animation density: {animDensity}%</p>
                      <Slider value={[animDensity]} min={0} max={100} step={1} onValueChange={(value) => setAnimDensity(value?.[0] ?? 40)} />
                    </div>

                    <div className="border-b border-white/10 pb-1" />
                  </>
                )}

                <div className="space-y-2">
                  <p className="text-sm text-white/85">Base symbol size: {charSize}px</p>
                  <Slider value={[charSize]} min={6} max={18} step={1} onValueChange={(value) => setCharSize(value?.[0] ?? 10)} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-white/85">Random symbol size: {variation}%</p>
                  <Slider value={[variation]} min={0} max={100} step={1} onValueChange={(value) => setVariation(value?.[0] ?? 0)} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-white/85">Density: {density}</p>
                  <Slider value={[density]} min={2} max={18} step={1} onValueChange={(value) => setDensity(value?.[0] ?? 8)} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-white/85">Contrast: {contrast}%</p>
                  <Slider value={[contrast]} min={50} max={200} step={1} onValueChange={(value) => setContrast(value?.[0] ?? 100)} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-white/85">Brightness: {brightness}%</p>
                  <Slider value={[brightness]} min={50} max={200} step={1} onValueChange={(value) => setBrightness(value?.[0] ?? 100)} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-white/85">Depth: {depth}%</p>
                  <Slider value={[depth]} min={50} max={200} step={1} onValueChange={(value) => setDepth(value?.[0] ?? 100)} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-white/85">Presets</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESET_BUTTONS.map((preset) => (
                      <Button key={preset.key} type="button" variant="outline" onClick={() => applyPreset(preset.key)}>
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-white/85">Color mode</p>
                  <Button type="button" variant="outline" className="w-full" onClick={() => setIsInverted((current) => !current)}>
                    {isInverted ? "Inversion: On (black bg)" : "Inversion: Off (white bg)"}
                  </Button>
                </div>
              </div>
            </section>
            </div>

            <section className="rounded-[24px] bg-[#1A1A1A] p-3 max-md:order-4 max-md:shrink-0 max-md:rounded-none max-md:bg-transparent max-md:border-t max-md:border-white/10 max-md:p-0 max-md:pt-2">
              {activeTab === "image" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="max-md:text-[13px]" disabled={!asciiData} onClick={() => downloadAsciiPng(1)}>
                    Export X1
                  </Button>
                  <Button type="button" variant="outline" className="max-md:text-[13px]" disabled={!asciiData} onClick={() => downloadAsciiPng(2)}>
                    Export X2
                  </Button>
                </div>
              ) : (
                isExporting ? (
                  <div className="space-y-2">
                    <div className="h-2 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#DADADA]"
                        style={{ width: `${Math.round(exportProgress * 100)}%`, transition: "width 0.15s" }}
                      />
                    </div>
                    <p className="text-center text-xs text-white/50">
                      Encoding... {Math.round(exportProgress * 100)}%
                    </p>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full max-md:text-[13px]"
                    disabled={!asciiData}
                    onClick={exportMp4}
                  >
                    Export
                  </Button>
                )
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
