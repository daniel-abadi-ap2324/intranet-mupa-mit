import { z } from 'zod'

import { COMP_TYPES, COMP_UNITS } from '../rrhh.constants.ts'

const year = z.coerce.number().int().min(2000).max(2100)
const isoDate = z.iso.date('Usa una fecha como 2026-10-01.')

/** Mes de las marcaciones. */
export const monthQueryDto = z.object({ year, month: z.coerce.number().int().min(1).max(12) })

/** Página del historial de comprobantes. */
export const payslipsQueryDto = z.object({ page: z.coerce.number().int().min(1).max(500).default(1) })

export const yearParamsDto = z.object({ year })

/** Detalle de un comprobante: su número de planilla. */
export const payslipDetailQueryDto = z.object({ payroll: z.coerce.number().int().positive() })

/** Días que se pueden reclamar como tiempo compensatorio. */
export const candidatesQueryDto = z.object({ from: isoDate.optional(), to: isoDate.optional() })

export const compRequestParamsDto = z.object({ id: z.coerce.number().int().positive() })

const reason = z.string().trim().max(500).optional()

/** Pedir que se acredite un día trabajado de más (lo aprueba el supervisor en RH Link). */
export const accreditCompDto = z.object({ type: z.enum(COMP_TYPES), workedDate: isoDate, reason }).strict()

/** Pedir usar tiempo compensatorio: horas (se pasan a minutos) o días. */
export const useCompDto = z
  .object({
    type: z.enum(COMP_TYPES),
    unit: z.enum(COMP_UNITS),
    amount: z.number().positive().max(366),
    from: isoDate,
    to: isoDate.optional(),
    reason,
  })
  .strict()
  .refine((d) => !d.to || d.to >= d.from, { path: ['to'], message: 'La fecha final no puede ser antes de la inicial.' })

export type MonthQueryDto = z.infer<typeof monthQueryDto>
export type PayslipsQueryDto = z.infer<typeof payslipsQueryDto>
export type YearParamsDto = z.infer<typeof yearParamsDto>
export type PayslipDetailQueryDto = z.infer<typeof payslipDetailQueryDto>
export type CandidatesQueryDto = z.infer<typeof candidatesQueryDto>
export type CompRequestParamsDto = z.infer<typeof compRequestParamsDto>
export type AccreditCompDto = z.infer<typeof accreditCompDto>
export type UseCompDto = z.infer<typeof useCompDto>
