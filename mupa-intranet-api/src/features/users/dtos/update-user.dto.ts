import { z } from 'zod'

/** Lo único que administración cambia de una persona: su departamento (null = ninguno). Los roles vienen de Identity Central. */
export const updateUserDto = z.object({ departmentId: z.number().int().positive().nullable() }).strict()

export type UpdateUserDto = z.infer<typeof updateUserDto>
