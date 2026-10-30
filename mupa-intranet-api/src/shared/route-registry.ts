import type { Router } from 'express'

/**
 * Qué routers están montados y dónde (app.ts). Express no guarda el prefijo de cada montaje de
 * forma legible; este registro lo conserva para describir los endpoints (features/meta).
 */
export type Mount = { path: string; router: Router }

const mounts: Mount[] = []

export function registerMount(path: string, router: Router): void {
  mounts.push({ path, router })
}

export function listMounts(): readonly Mount[] {
  return mounts
}
