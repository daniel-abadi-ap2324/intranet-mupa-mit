import { Router } from 'express'

import { healthController } from './health.controller.ts'

export const healthRoutes = Router()

healthRoutes.get('/', healthController.check)
