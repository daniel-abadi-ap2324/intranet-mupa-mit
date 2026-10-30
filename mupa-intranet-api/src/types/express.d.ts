import type { UserResponse } from '../features/users/dtos/user-response.dto.ts'

declare global {
  namespace Express {
    interface Request {
      /** Persona con la sesión iniciada (lo llena el middleware `authenticate`). */
      user?: UserResponse
      /** Cookie de invitado de RRHH Express, si no hay sesión (la llena `authenticateOrGuest`). */
      guestToken?: string
    }
  }
}

export {}
