import { Router } from 'express'

import { rateLimit } from '../../shared/middlewares/rate-limit.middleware.ts'
import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { assistantController } from './assistant.controller.ts'
import { askAssistantDto } from './dtos/ask-assistant.dto.ts'

export const assistantRoutes = Router()

// Si el asistente está prendido: el Inicio lo pregunta antes de ofrecer "Preguntar al asistente".
assistantRoutes.get('/status', assistantController.status)

// Cualquiera (el catálogo público también se lee sin sesión). Cada pregunta usa el modelo
// compartido de la Alcaldía: el límite es lo que evita que alguien lo sature.
assistantRoutes.post(
  '/ask',
  validate({ body: askAssistantDto }),
  rateLimit({ max: 15, windowMs: 10 * 60_000, message: 'Hiciste muchas preguntas seguidas. Espera unos minutos e intenta de nuevo.' }),
  assistantController.ask,
)
