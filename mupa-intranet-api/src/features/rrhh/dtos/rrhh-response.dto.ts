import { z } from 'zod'

/**
 * Lo que la intranet devuelve de RRHH Express: lista blanca de campos. La cédula de la
 * persona nunca sale; la cuenta bancaria y las cédulas de los dependientes, enmascaradas.
 */
const text = z.string().nullable()
const num = z.number().nullable()
const date = z.string().nullable()

export const rrhhStatusResponseDto = z.object({
  /** Si este servidor tiene RH Link configurado. */
  available: z.boolean(),
  connected: z.boolean(),
  /** La sesión ya conoce la cédula (entró con Identity Central): solo se pide el número de cargo. */
  knownCedula: z.boolean(),
  /** Es una conexión de invitado (sin sesión en la intranet). */
  guest: z.boolean(),
  name: text,
  expiresAt: z.string().nullable(),
  /** RRHH Express en mantenimiento (RRHH_MANTENIMIENTO): la pestaña lo dice y no ofrece conectar. */
  maintenance: z.boolean().optional(),
})

export const attendanceResponseDto = z.object({
  year: z.number(),
  month: z.number(),
  schedule: text,
  summary: z.object({ present: z.number(), late: z.number(), absent: z.number(), daysOff: z.number() }),
  days: z.array(
    z.object({
      date: z.string(),
      status: text,
      firstPunch: text,
      lastPunch: text,
      hoursWorked: text,
      regularHours: text,
      late: text,
      earlyArrival: text,
      earlyLeave: text,
      overtime: text,
      holiday: text,
      exception: text,
      absenceType: text,
    }),
  ),
})

export const payslipDto = z.object({
  payroll: z.number(),
  voucher: num,
  date: date,
  /** Quincena: año, mes (0 = pago especial) y 1.ª o 2.ª. */
  period: z.object({ year: num, month: num, half: num }),
  jobTitle: text,
  daysPaid: num,
  gross: z.number(),
  deductions: z.object({
    socialSecurity: z.number(),
    educationInsurance: z.number(),
    incomeTax: z.number(),
    complementaryFund: z.number(),
    asemup: z.number(),
    other: z.number(),
    total: z.number(),
  }),
  net: z.number(),
  paymentMethod: text,
  bank: text,
  accountType: text,
  account: text,
})

export const payslipsResponseDto = z.object({ page: z.number(), pages: z.number(), total: z.number(), items: z.array(payslipDto) })

export const payslipYearResponseDto = z.object({
  year: z.number(),
  totals: z.object({ gross: z.number(), deductions: z.number(), net: z.number() }),
  items: z.array(payslipDto),
})

export const payslipDetailResponseDto = z.object({
  payroll: z.number(),
  lines: z.array(z.object({ code: z.string(), type: text, amount: z.number(), balance: z.number() })),
})

export const recordResponseDto = z.object({
  job: z.object({
    name: text,
    jobTitle: text,
    department: text,
    positionNumber: num,
    payrollType: text,
    startDate: date,
    endDate: date,
    status: text,
    monthlySalary: num,
  }),
  personal: z.object({
    birthDate: date,
    sex: text,
    maritalStatus: text,
    socialSecurity: text,
    phone: text,
    mobile: text,
    email: text,
    province: text,
    district: text,
    township: text,
    neighborhood: text,
    building: text,
    house: text,
    emergencyContact: text,
    emergencyPhone: text,
    role: text,
    area: text,
  }),
  education: z.array(z.object({ institution: text, title: text, comment: text, date })),
  evaluations: z.array(z.object({ date, average: num, category: text, comments: text })),
  sanctions: z.array(z.object({ date, sanction: text, comment: text, paid: z.boolean() })),
  dependents: z.array(z.object({ name: z.string(), relationship: text, birthDate: date, idNumber: text, primary: z.boolean() })),
})

const balanceDto = z.object({ available: z.number(), pending: z.number(), used: z.number(), expired: z.number() })

export const compRequestDto = z.object({
  id: z.number(),
  kind: text,
  type: text,
  unit: text,
  minutes: num,
  days: num,
  workedDate: date,
  from: date,
  to: date,
  reason: text,
  status: text,
  rejectionReason: text,
  createdAt: date,
})

export const compResponseDto = z.object({
  workdayMinutes: num,
  totalAvailable: z.number(),
  balances: z.object({ before: balanceDto, after: balanceDto }),
  expiring: z.array(z.object({ type: text, date, minutes: z.number(), daysLeft: num })),
  requests: z.array(compRequestDto),
})

export const compCandidatesResponseDto = z.array(z.object({ date: z.string(), type: z.string(), minutes: z.number() }))

export const compCreatedResponseDto = z.object({ id: z.number(), minutes: num, message: text })

export type RrhhStatusResponse = z.infer<typeof rrhhStatusResponseDto>
export type AttendanceResponse = z.infer<typeof attendanceResponseDto>
export type PayslipResponse = z.infer<typeof payslipDto>
export type PayslipsResponse = z.infer<typeof payslipsResponseDto>
export type PayslipYearResponse = z.infer<typeof payslipYearResponseDto>
export type PayslipDetailResponse = z.infer<typeof payslipDetailResponseDto>
export type RecordResponse = z.infer<typeof recordResponseDto>
export type CompRequestResponse = z.infer<typeof compRequestDto>
export type CompResponse = z.infer<typeof compResponseDto>
export type CompCandidatesResponse = z.infer<typeof compCandidatesResponseDto>
export type CompCreatedResponse = z.infer<typeof compCreatedResponseDto>
