/**
 * Control del recorrido: si está abierto y los mensajes entre el recorrido y la página del asistente.
 * El recorrido vive en App (components/recorrido/Recorrido.tsx, `RecorridoRaiz`) para sobrevivir al paso del
 * Inicio a /asistente y de vuelta; el Inicio solo lo pide (`abrirRecorrido`).
 */
import { useSyncExternalStore } from 'react'

let abierto = false
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((f) => f())

/** Abre el recorrido. Si ya está abierto no hace nada (el Inicio vuelve a montarse al regresar del asistente). */
export function abrirRecorrido() {
  if (abierto) return
  abierto = true
  avisar()
}

export function cerrarRecorrido() {
  if (!abierto) return
  abierto = false
  avisar()
}

export function useRecorridoAbierto(): boolean {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f)
      return () => oyentes.delete(f)
    },
    () => abierto,
    () => false,
  )
}

/** Del recorrido a la página del asistente: escribe esta pregunta en la caja, como una persona, y la envía. */
export const EVENTO_GUION = 'mupa:recorrido-preguntar'
/** De la página del asistente al recorrido: `{ fase: 'enviando' | 'listo' | 'error', mensaje? }`. */
export const EVENTO_ASISTENTE = 'mupa:asistente'
export type FaseAsistente = 'enviando' | 'listo' | 'error'
export type DetalleAsistente = { fase: FaseAsistente; mensaje?: string }
