import { eq, isNotNull } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { db } from '../src/config/database.ts'
import { departments, users } from '../src/database/schema/index.ts'
import { runSeed } from '../src/database/seeder.ts'
import { createUser } from './helpers.ts'

describe('departamentos de RRHH en el seed', () => {
  it('uno viejo con el mismo nombre (y en uso) queda enlazado a RRHH, sin repetirse; y no se vuelven a cargar', async () => {
    const [viejo] = await db.insert(departments).values({ name: 'Secretaría General' }).returning()
    const persona = await createUser('seed-deptos@prueba.test', ['funcionario'])
    await db.update(users).set({ departmentId: viejo.id }).where(eq(users.id, persona.id))

    await runSeed({ demoUsers: false })

    const todos = await db.select().from(departments)
    expect(todos).toHaveLength(62)
    expect(todos.filter((d) => d.name === 'Secretaría General')).toEqual([expect.objectContaining({ id: viejo.id, rrhhCode: 15628 })])
    expect((await db.select().from(departments).where(isNotNull(departments.rrhhCode))).length).toBe(62)

    // Administración borra uno: el seed no lo vuelve a crear.
    await db.delete(departments).where(eq(departments.rrhhCode, 15797))
    expect((await runSeed({ demoUsers: false })).departments).toBe(0)
    expect(await db.select().from(departments)).toHaveLength(61)
  })
})
