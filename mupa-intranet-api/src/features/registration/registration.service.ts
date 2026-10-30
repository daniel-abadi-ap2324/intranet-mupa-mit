import type { UserRow } from '../../database/schema/index.ts'
import { env } from '../../config/env.ts'
import { DomainError } from '../../shared/errors/domain-error.ts'
import { ValidationError } from '../../shared/errors/validation-error.ts'
import { splitRrhhName } from '../../shared/rrhh-name.ts'
import { identityCentralService, type IdentityCentralService } from '../../shared/services/identity-central.service.ts'
import { authService, type AuthService } from '../auth/auth.service.ts'
import { departmentsService, type DepartmentsService } from '../departments/departments.service.ts'
import { usersService, type UsersService } from '../users/users.service.ts'
import type { RegisterDto } from './dtos/register.dto.ts'

/**
 * Alta de cuentas en Identity Central, sin aprobación (es un sistema interno y RHLink
 * no sirve para validar altas nuevas). Al terminar, la persona queda con sesión iniciada.
 */
export class RegistrationService {
  private readonly central: IdentityCentralService | null
  private readonly auth: AuthService
  private readonly users: UsersService
  private readonly departments: DepartmentsService

  constructor(central: IdentityCentralService | null, auth: AuthService, users: UsersService, departments: DepartmentsService) {
    this.central = central
    this.auth = auth
    this.users = users
    this.departments = departments
  }

  async register(data: RegisterDto): Promise<{ user: UserRow; token: string; expiresAt: Date }> {
    if (!this.central) throw new DomainError('El registro no está disponible en este servidor.', 503, 'REGISTRATION_UNAVAILABLE')
    // Antes de crear la cuenta en el central: después ya no se puede deshacer.
    if (data.departmentId) await this.departments.assertExist([data.departmentId])
    // También antes de crear nada en el central: quien no es funcionario no podría entrar después.
    const funcionario = await this.auth.assertIsFuncionario(data.identityNumber)
    // El nombre: lo que escribió la persona o, si no, el de RH Link (no se le pide lo que RH Link ya sabe).
    const rrhhName = funcionario?.fullName ? splitRrhhName(funcionario.fullName, env.RRHH_NOMBRE_ORDEN) : null
    const firstName = data.firstName ?? rrhhName?.firstName
    const lastName = data.lastName ?? rrhhName?.lastName
    if (!firstName || !lastName) {
      throw new ValidationError([
        ...(firstName ? [] : [{ field: 'firstName', message: 'Escribe tu nombre.' }]),
        ...(lastName ? [] : [{ field: 'lastName', message: 'Escribe tu apellido.' }]),
      ])
    }

    await this.central.register({
      identityNumber: data.identityNumber,
      fullName: `${firstName} ${lastName}`,
      email: data.email,
      password: data.password,
      phoneNumber: data.mobile,
    })

    const session = await this.auth.login(data.identityNumber, data.password)
    const user = await this.users.updateProfile(session.user.id, {
      firstName,
      lastName,
      phone: data.phone ?? null,
      jobTitle: data.jobTitle ?? null,
      // Si no lo mandó, se queda el que entró de RH Link (no se pisa con vacío).
      ...(data.departmentId ? { departmentId: data.departmentId } : {}),
    })
    return { ...session, user }
  }
}

export const registrationService = new RegistrationService(identityCentralService, authService, usersService, departmentsService)
