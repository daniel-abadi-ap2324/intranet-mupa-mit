import { z } from 'zod'

/** Crear o renombrar: solo el nombre. */
export const saveDepartmentDto = z.object({ name: z.string().trim().min(1).max(80) }).strict()

export type SaveDepartmentDto = z.infer<typeof saveDepartmentDto>
