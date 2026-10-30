import { DomainError } from '../../shared/errors/domain-error.ts'
import { departmentsRepository, type DepartmentsRepository, type DepartmentWithCounts } from './departments.repository.ts'

const NOT_FOUND = () => new DomainError('El departamento no existe.', 404, 'DEPARTMENT_NOT_FOUND')

export class DepartmentsService {
  private readonly repository: DepartmentsRepository

  constructor(repository: DepartmentsRepository) {
    this.repository = repository
  }

  list(): Promise<DepartmentWithCounts[]> {
    return this.repository.findMany()
  }

  /** Para que cada quien elija el suyo al registrarse (administración lo puede corregir después). */
  options(): Promise<{ id: number; name: string }[]> {
    return this.repository.findOptions()
  }

  async create(name: string): Promise<DepartmentWithCounts> {
    await this.assertNameAvailable(name)
    const created = await this.repository.create(name)
    return { ...created, users: 0, applications: 0 }
  }

  async rename(id: number, name: string): Promise<DepartmentWithCounts> {
    const current = await this.repository.findById(id)
    if (!current) throw NOT_FOUND()
    if (current.name !== name) await this.assertNameAvailable(name)
    await this.repository.update(id, name)
    return { ...current, name }
  }

  /**
   * Solo se borra un departamento vacío. Con personas, quedarían sin departamento sin
   * que nadie lo decida; con aplicaciones, una app restringida quedaría visible para todos.
   */
  async delete(id: number): Promise<void> {
    const current = await this.repository.findById(id)
    if (!current) throw NOT_FOUND()
    if (current.users || current.applications) {
      const partes = [current.users && `${current.users} persona(s)`, current.applications && `${current.applications} aplicación(es)`].filter(Boolean)
      throw new DomainError(`«${current.name}» todavía tiene ${partes.join(' y ')}. Cámbialas de departamento antes de borrarlo.`, 409, 'DEPARTMENT_IN_USE')
    }
    await this.repository.delete(id)
  }

  /** Para otras features: 400 si alguno de los departamentos no existe. */
  /** El departamento que en RH Link tiene ese código de ubicación (los de la lista de las 62 direcciones), o undefined. */
  findByRrhhCode(code: number) {
    return this.repository.findByRrhhCode(code)
  }

  async assertExist(ids: number[]): Promise<void> {
    const unique = [...new Set(ids)]
    if ((await this.repository.countExisting(unique)) !== unique.length) {
      throw new DomainError('Uno de los departamentos no existe.', 400, 'DEPARTMENT_NOT_FOUND')
    }
  }

  private async assertNameAvailable(name: string): Promise<void> {
    if (await this.repository.findByName(name)) throw new DomainError(`Ya existe el departamento «${name}».`, 409, 'DEPARTMENT_NAME_TAKEN')
  }
}

export const departmentsService = new DepartmentsService(departmentsRepository)
