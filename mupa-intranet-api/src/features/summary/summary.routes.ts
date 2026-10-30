import { Router } from 'express'

import { requireAuth } from '../auth/auth.middleware.ts'
import { summaryController } from './summary.controller.ts'

export const summaryRoutes = Router()

summaryRoutes.get('/', requireAuth, summaryController.get)
