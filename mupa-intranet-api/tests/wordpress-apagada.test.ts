/** Sin WP_SYNC_URL la sincronización con mupa.gob.pa está apagada: nada la dispara y la ruta lo dice. */
import { beforeAll, describe, expect, it } from 'vitest'

import { wordpressSyncService } from '../src/features/wordpress-sync/wordpress-sync.service.ts'
import { createUser, loginAs } from './helpers.ts'

let comu: Awaited<ReturnType<typeof loginAs>>

beforeAll(async () => {
  await createUser('comu-wp-off@prueba.test', ['comunicacion'])
  comu = await loginAs('comu-wp-off@prueba.test')
})

describe('sincronización apagada', () => {
  it('el estado lo dice', async () => {
    const r = await comu.get('/api/wordpress-sync/status')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ enabled: false, running: false, last: null })
  })

  it('«Sincronizar ahora» responde 503 y no hace nada', async () => {
    const r = await comu.post('/api/wordpress-sync/run')
    expect(r.status).toBe(503)
    expect(r.body.error).toBe('WP_SYNC_DISABLED')
  })

  it('start() no programa nada', () => {
    wordpressSyncService.start()
    wordpressSyncService.stop()
    expect(wordpressSyncService.status().enabled).toBe(false)
  })
})
