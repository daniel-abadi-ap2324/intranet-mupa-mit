/** Datos de prueba (siempre ficticios) y utilidades para las pruebas. */
import request from 'supertest'

import { app } from '../src/app.ts'
import { db } from '../src/config/database.ts'
import { applications, applicationTags, tags, users } from '../src/database/schema/index.ts'
import { hashService } from '../src/shared/services/hash.service.ts'

export const PASSWORD = 'clave-de-prueba'

export async function createUser(email: string, roles: string[], firstName = 'Prueba') {
  const [u] = await db
    .insert(users)
    .values({ email, firstName, roles, passwordHash: await hashService.hash(PASSWORD) })
    .returning()
  return u
}

/** Inicia sesión y devuelve un agente con la cookie puesta. */
export async function loginAs(email: string) {
  const agent = request.agent(app)
  const r = await agent.post('/api/auth/login').send({ username: email, password: PASSWORD })
  if (r.status !== 200) throw new Error(`No se pudo entrar como ${email}: ${r.status} ${JSON.stringify(r.body)}`)
  return agent
}

export const anonymous = () => request(app)

export async function createTag(name: string, audience = false) {
  const [t] = await db.insert(tags).values({ name, audience }).returning()
  return t
}

export async function createApplication(data: Partial<typeof applications.$inferInsert> & { name: string }, tagIds: number[] = []) {
  const [a] = await db
    .insert(applications)
    .values({ slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: 'Ficticia', area: 'Soporte', ...data })
    .returning()
  if (tagIds.length) await db.insert(applicationTags).values(tagIds.map((tagId) => ({ applicationId: a.id, tagId })))
  return a
}
