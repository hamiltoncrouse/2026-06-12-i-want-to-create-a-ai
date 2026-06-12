import { type ReactNode, useEffect, useRef } from 'react'
import type { StationMode } from './useStation'

const BAR_COUNT = 96

type VisualizerProps = {
  analyser: AnalyserNode | null
  mode: StationMode
  color: string
  children?: ReactNode
}

export function Visualizer({ analyser, mode, color, children }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const modeRef = useRef(mode)
  const analyserRef = useRef(analyser)
  const colorRef = useRef(color)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    analyserRef.current = analyser
  }, [analyser])

  useEffect(() => {
    colorRef.current = color
  }, [color])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let raf = 0
    const values = new Float32Array(BAR_COUNT)
    const freq = new Uint8Array(128)
    let rotation = -Math.PI / 2
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const size = canvas.clientWidth
      if (!size) return
      const dpr = window.devicePixelRatio || 1
      const px = Math.round(size * dpr)
      if (canvas.width !== px) {
        canvas.width = px
        canvas.height = px
      }
      ctx.clearRect(0, 0, px, px)

      const activeMode = modeRef.current
      const node = analyserRef.current
      const t = now / 1000
      const live = activeMode === 'break' && node

      if (live) node.getByteFrequencyData(freq)

      for (let i = 0; i < BAR_COUNT; i++) {
        let target = 0.05
        if (live) {
          // Mirror the voice spectrum around the circle so it reads as a halo.
          const half = BAR_COUNT / 2
          const j = i < half ? i : BAR_COUNT - 1 - i
          const bin = Math.floor((j / half) * 56) + 2
          target = (freq[bin] / 255) * 1.05
        } else if (activeMode === 'song') {
          const beat = 0.5 + 0.5 * Math.sin(t * Math.PI * 2.1)
          target =
            0.14 +
            0.26 * Math.abs(Math.sin(t * 1.7 + i * 0.55)) +
            0.2 * Math.abs(Math.sin(t * 0.9 - i * 0.21)) +
            0.2 * beat * Math.abs(Math.sin(i * 1.31 + t * 3.1))
        } else if (activeMode === 'loading') {
          target = 0.1 + 0.08 * Math.abs(Math.sin(t * 2.4 + i * 0.4))
        }
        if (reduceMotion && !live) target = activeMode === 'song' ? 0.3 : 0.08
        values[i] += (target - values[i]) * (live ? 0.35 : 0.12)
      }

      if (activeMode === 'song' && !reduceMotion) rotation += 0.0022

      const center = px / 2
      const innerRadius = px * 0.36
      const barLength = px * 0.12
      const gradient = ctx.createRadialGradient(
        center,
        center,
        innerRadius,
        center,
        center,
        innerRadius + barLength,
      )
      gradient.addColorStop(0, colorRef.current)
      gradient.addColorStop(1, `${colorRef.current}00`)
      ctx.strokeStyle = gradient
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(2, ((2 * Math.PI * innerRadius) / BAR_COUNT) * 0.5)
      ctx.beginPath()
      for (let i = 0; i < BAR_COUNT; i++) {
        const angle = rotation + (i / BAR_COUNT) * Math.PI * 2
        const value = Math.min(1, values[i])
        const from = innerRadius + px * 0.004
        const to = from + Math.max(px * 0.006, value * barLength)
        ctx.moveTo(center + Math.cos(angle) * from, center + Math.sin(angle) * from)
        ctx.lineTo(center + Math.cos(angle) * to, center + Math.sin(angle) * to)
      }
      ctx.stroke()
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="visualizer">
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="visualizerCenter">{children}</div>
    </div>
  )
}
