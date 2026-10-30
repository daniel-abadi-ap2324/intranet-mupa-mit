import { describe, expect, it } from 'vitest'

import { splitRrhhName, titleCase } from '../src/shared/rrhh-name.ts'

describe('nombre de RH Link', () => {
  it('pasa de mayúsculas a «Nombre Propio» y deja las partículas en minúscula', () => {
    expect(titleCase('JUAN CARLOS')).toBe('Juan Carlos')
    expect(titleCase('MARIA DE LOS ANGELES')).toBe('Maria de los Angeles')
  })

  it('nombres-primero: 4 palabras = 2 nombres y 2 apellidos; 2 o 3 palabras = 1 nombre', () => {
    expect(splitRrhhName('JUAN CARLOS PEREZ GOMEZ', 'nombres-primero')).toEqual({ fullName: 'Juan Carlos Perez Gomez', firstName: 'Juan Carlos', lastName: 'Perez Gomez' })
    expect(splitRrhhName('JUAN PEREZ GOMEZ', 'nombres-primero')).toMatchObject({ firstName: 'Juan', lastName: 'Perez Gomez' })
    expect(splitRrhhName('JUAN PEREZ', 'nombres-primero')).toMatchObject({ firstName: 'Juan', lastName: 'Perez' })
  })

  it('apellidos-primero: los apellidos van primero', () => {
    expect(splitRrhhName('PEREZ GOMEZ JUAN CARLOS', 'apellidos-primero')).toEqual({ fullName: 'Perez Gomez Juan Carlos', firstName: 'Juan Carlos', lastName: 'Perez Gomez' })
    expect(splitRrhhName('PEREZ GOMEZ JUAN', 'apellidos-primero')).toMatchObject({ firstName: 'Juan', lastName: 'Perez Gomez' })
    expect(splitRrhhName('PEREZ JUAN', 'apellidos-primero')).toMatchObject({ firstName: 'Juan', lastName: 'Perez' })
  })

  it('un nombre de una sola palabra no se puede separar', () => {
    expect(splitRrhhName('JUAN', 'nombres-primero')).toBeNull()
    expect(splitRrhhName('   ', 'apellidos-primero')).toBeNull()
  })
})
