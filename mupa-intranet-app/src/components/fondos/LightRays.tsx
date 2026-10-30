/**
 * Fondo «Light Rays» (adaptado de reactbits.dev/backgrounds/light-rays, MIT): rayos de luz que bajan desde
 * arriba, dibujados con WebGL (ogl). Solo decora: va detrás del contenido, con aria-hidden.
 *
 * - Sin WebGL, o con «reducir movimiento» en el sistema, dibuja un solo cuadro quieto (o nada: queda el
 *   degradado de CSS de detrás).
 * - Fuera de la pantalla se pausa (IntersectionObserver), y se libera al salir de la página.
 */
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import React, { useEffect, useRef } from 'react'

type Props = {
  /** Color de los rayos (hex). */
  color?: string
  speed?: number
  /** Qué tan abiertos van los rayos (1 = como en reactbits). */
  spread?: number
  /** Largo relativo al ancho. */
  length?: number
  /** Intensidad general (0 a 1). */
  glow?: number
  /** Cuánto siguen al ratón (0 = nada). */
  mouseInfluence?: number
  className?: string
}

const VERT = `attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`

const FRAG = `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec2 rayPos;
uniform vec2 rayDir;
uniform vec3 raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float glow;
uniform vec2 mousePos;
uniform float mouseInfluence;

float rayStrength(vec2 source, vec2 dir, vec2 coord, float seedA, float seedB, float speed) {
  vec2 toCoord = coord - source;
  float cosAngle = dot(normalize(toCoord), dir);
  float spreadFactor = pow(max(cosAngle, 0.0), 1.0 / max(lightSpread, 0.001));
  float dist = length(toCoord);
  float maxDist = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDist - dist) / maxDist, 0.0, 1.0);
  float base = clamp((0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) + (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)), 0.0, 1.0);
  return base * lengthFalloff * spreadFactor;
}

void main() {
  vec2 coord = vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y);
  vec2 dir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 m = mousePos * iResolution;
    dir = normalize(mix(rayDir, normalize(m - rayPos), mouseInfluence));
  }
  float r1 = rayStrength(rayPos, dir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
  float r2 = rayStrength(rayPos, dir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);
  float s = r1 * 0.5 + r2 * 0.4;
  float brightness = 1.0 - coord.y / iResolution.y;
  // El color es fijo y la intensidad va en la transparencia: sirve sobre fondo claro u oscuro.
  float a = clamp(s * (0.35 + brightness * 0.75), 0.0, 1.0) * glow;
  gl_FragColor = vec4(raysColor, a);
}`

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1]
}

export default function LightRays({ color = '#ffffff', speed = 1, spread = 1, length = 2, glow = 0.7, mouseInfluence = 0.08, className }: Props) {
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = caja.current
    if (!el) return
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let renderer: Renderer
    try {
      renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), alpha: true, premultipliedAlpha: false })
    } catch {
      return // Sin WebGL: queda el fondo de CSS.
    }
    const gl = renderer.gl
    if (!gl) return
    gl.clearColor(0, 0, 0, 0)
    const canvas = gl.canvas as HTMLCanvasElement
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.setAttribute('aria-hidden', 'true')
    el.appendChild(canvas)

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      rayPos: { value: [0, 0] },
      rayDir: { value: [0, 1] },
      raysColor: { value: hexToRgb(color) },
      raysSpeed: { value: speed },
      lightSpread: { value: spread },
      rayLength: { value: length },
      glow: { value: glow },
      mousePos: { value: [0.5, 0.5] },
      mouseInfluence: { value: quieto ? 0 : mouseInfluence },
    }
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program: new Program(gl, { vertex: VERT, fragment: FRAG, uniforms }) })

    const medir = () => {
      const { clientWidth: w, clientHeight: h } = el
      renderer.setSize(w, h)
      const dpr = renderer.dpr
      uniforms.iResolution.value = [w * dpr, h * dpr]
      // Desde arriba al centro, un poco por encima del borde.
      uniforms.rayPos.value = [0.5 * w * dpr, -0.2 * h * dpr]
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)

    let raf = 0
    let visible = true
    const dibujar = (t: number) => {
      uniforms.iTime.value = t * 0.001
      renderer.render({ scene: mesh })
      if (!quieto && visible) raf = requestAnimationFrame(dibujar)
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      cancelAnimationFrame(raf)
      if (visible && !quieto) raf = requestAnimationFrame(dibujar)
    })
    io.observe(el)
    if (quieto) dibujar(4000)
    else raf = requestAnimationFrame(dibujar)

    const raton = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      uniforms.mousePos.value = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
    }
    if (!quieto && mouseInfluence > 0) window.addEventListener('pointermove', raton, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      window.removeEventListener('pointermove', raton)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
    }
  }, [color, speed, spread, length, glow, mouseInfluence])

  return <div ref={caja} className={className} aria-hidden="true" />
}
