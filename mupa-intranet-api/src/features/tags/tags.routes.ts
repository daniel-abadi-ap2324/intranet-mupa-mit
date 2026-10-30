import { Router } from 'express'

import { tagsController } from './tags.controller.ts'

export const tagsRoutes = Router()

tagsRoutes.get('/', tagsController.list)
