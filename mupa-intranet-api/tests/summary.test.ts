import { beforeAll, describe, expect, it } from 'vitest'

import { anonymous, createUser, loginAs } from './helpers.ts'

beforeAll(async () => {
  await createUser('admin@prueba.test', ['admin'])
  await createUser('comu@prueba.test', ['comunicacion'])
  await createUser('ana@prueba.test', ['funcionario'])
})

describe('GET /api/me/summary', () => {
  it('sin sesión 401; cada rol recibe solo sus cifras (y todos, sus solicitudes sin leer)', async () => {
    expect((await anonymous().get('/api/me/summary')).status).toBe(401)
    expect((await (await loginAs('ana@prueba.test')).get('/api/me/summary')).body).toEqual({ unreadRequests: 0 })

    const comu = await loginAs('comu@prueba.test')
    await comu.post('/api/announcements').send({ title: 'Vigente', status: 'publicado' })
    await comu.post('/api/announcements').send({ title: 'En borrador' })
    expect((await comu.get('/api/me/summary')).body).toEqual({ activeAnnouncements: 1, draftAnnouncements: 1, unreadRequests: 0 })

    const admin = (await (await loginAs('admin@prueba.test')).get('/api/me/summary')).body
    expect(admin).toMatchObject({ usersWithoutDepartment: 3, activeAnnouncements: 1 })
  })
})
