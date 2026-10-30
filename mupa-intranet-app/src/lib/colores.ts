/** Colores del design system para iconos de listas e indicadores (tinte de fondo + color del glifo). */
export const COLORES = {
  azul: { t: 'Azul', tint: 'var(--action-subtle)', color: 'var(--action)' },
  cian: { t: 'Cian', tint: 'var(--color-cyan-100)', color: 'var(--color-cyan-400)' },
  morado: { t: 'Morado', tint: 'var(--color-purple-100)', color: 'var(--color-purple-400)' },
  coral: { t: 'Coral', tint: 'var(--color-coral-100)', color: 'var(--color-coral-400)' },
  lima: { t: 'Lima', tint: 'var(--color-lime-100)', color: 'var(--color-lime-400)' },
  ambar: { t: 'Ámbar', tint: 'var(--color-warning-100)', color: 'var(--color-warning-700)' },
} as const

export type Color = keyof typeof COLORES

export const OPCIONES_COLOR = (Object.keys(COLORES) as Color[]).map((k) => ({ label: COLORES[k].t, value: k }))

export function color(c: string | null | undefined) {
  return COLORES[(c as Color) in COLORES ? (c as Color) : 'azul']
}
