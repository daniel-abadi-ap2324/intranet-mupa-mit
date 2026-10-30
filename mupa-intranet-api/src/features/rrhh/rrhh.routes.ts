import { Router } from 'express'

import { authenticateOrGuest } from '../../shared/middlewares/authenticate-or-guest.middleware.ts'
import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { connectRrhhDto } from './dtos/connect-rrhh.dto.ts'
import {
  accreditCompDto,
  candidatesQueryDto,
  compRequestParamsDto,
  monthQueryDto,
  payslipDetailQueryDto,
  payslipsQueryDto,
  useCompDto,
  yearParamsDto,
} from './dtos/rrhh-query.dto.ts'
import { rrhhController } from './rrhh.controller.ts'

/** Los datos de RRHH Express de la propia persona. */
export const rrhhRoutes = Router()

// En mantenimiento (RRHH_MANTENIMIENTO), antes que todo: no se conecta ni se entrega nada.
rrhhRoutes.use(rrhhController.maintenance)
// Sin sesión también: la página de RRHH sabe así si ofrecer la conexión (si RH Link está configurado).
rrhhRoutes.get('/conexion', rrhhController.status)
// Conectar: con sesión (solo el número de cargo) o sin ella (cédula y número de cargo, conexión de invitado).
// Los intentos fallidos los limita el servicio por cédula y por IP (no sirve limitar por persona: sin sesión no la hay).
rrhhRoutes.post('/conexion', validate({ body: connectRrhhDto }), rrhhController.connect)
// Todo lo demás pide sesión de la intranet o conexión de invitado.
rrhhRoutes.use(authenticateOrGuest)
rrhhRoutes.delete('/conexion', rrhhController.disconnect)

rrhhRoutes.get('/marcaciones', validate({ query: monthQueryDto }), rrhhController.attendance)

rrhhRoutes.get('/comprobantes', validate({ query: payslipsQueryDto }), rrhhController.payslips)
rrhhRoutes.get('/comprobantes/resumen/:year', validate({ params: yearParamsDto }), rrhhController.payslipYear)
rrhhRoutes.get('/comprobantes/detalle', validate({ query: payslipDetailQueryDto }), rrhhController.payslipDetail)

rrhhRoutes.get('/expediente', rrhhController.record)

rrhhRoutes.get('/compensatorio', rrhhController.compensatory)
rrhhRoutes.get('/compensatorio/candidatos', validate({ query: candidatesQueryDto }), rrhhController.compCandidates)
rrhhRoutes.post('/compensatorio/acreditacion', validate({ body: accreditCompDto }), rrhhController.accreditComp)
rrhhRoutes.post('/compensatorio/uso', validate({ body: useCompDto }), rrhhController.useComp)
rrhhRoutes.patch('/compensatorio/solicitudes/:id/cancelar', validate({ params: compRequestParamsDto }), rrhhController.cancelComp)
