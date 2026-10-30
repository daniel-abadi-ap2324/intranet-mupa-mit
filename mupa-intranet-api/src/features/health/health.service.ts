import { DomainError } from '../../shared/errors/domain-error.ts'
import { healthRepository, type HealthRepository } from './health.repository.ts'

export class HealthService {
  private readonly repository: HealthRepository

  constructor(repository: HealthRepository) {
    this.repository = repository
  }

  /** La API está sana si responde la base de datos. */
  async check(): Promise<{ status: 'ok' }> {
    try {
      await this.repository.ping()
    } catch (err) {
      console.error(err)
      throw new DomainError('La base de datos no responde.', 503, 'DATABASE_UNAVAILABLE')
    }
    return { status: 'ok' }
  }
}

export const healthService = new HealthService(healthRepository)
