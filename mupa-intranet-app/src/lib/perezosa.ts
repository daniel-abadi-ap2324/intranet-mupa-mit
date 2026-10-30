/**
 * Páginas que se bajan solo cuando se visitan (React.lazy). `precargar` las pide con
 * antelación (al pasar el mouse o el foco por un enlace) para que el clic ya las tenga.
 * Si el archivo de la página no se puede bajar (p. ej. la intranet se actualizó mientras
 * la pestaña seguía abierta y el nombre del archivo cambió), se recarga la pestaña una vez.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const CLAVE_RECARGA = 'mupa:recarga-chunk'

function pedir<M>(cargar: () => Promise<M>): Promise<M> {
  return cargar().catch((e: unknown) => {
    try {
      if (!sessionStorage.getItem(CLAVE_RECARGA)) {
        sessionStorage.setItem(CLAVE_RECARGA, '1')
        location.reload()
        return new Promise<never>(() => {})
      }
    } catch {
      /* sin sessionStorage: se deja el error */
    }
    throw e
  })
}

export function perezosa<K extends string, M extends Record<K, ComponentType<any>>>(
  cargar: () => Promise<M>,
  nombre: K,
): { Pagina: LazyExoticComponent<M[K]>; precargar: () => void } {
  return {
    Pagina: lazy(() => pedir(cargar).then((m) => ({ default: m[nombre] }))),
    precargar: () => void cargar().catch(() => undefined),
  }
}

/** Una carga buena borra la marca: la próxima actualización podrá recargar otra vez. */
export function limpiarMarcaDeRecarga() {
  try {
    sessionStorage.removeItem(CLAVE_RECARGA)
  } catch {
    /* nada */
  }
}
