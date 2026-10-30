import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { aFecha, diaLargo, fechaCorta, fechaLarga, hoyIso, mesAnio, recientesSinVer } from '@/lib/fechas'
import { idActual } from '@/lib/menu'

describe('idActual: un solo ítem marcado en el menú', () => {
  it.each([
    ['/', 'inicio'],
    ['/aplicaciones', 'aplicaciones'],
    // El soporte técnico no está en el menú: se abre desde Aplicaciones.
    ['/mesa-servicios', 'aplicaciones'],
    ['/sap-istmo', 'aplicaciones'],
    ['/formularios', 'aplicaciones'],
    ['/formularios/acceso-ari', 'aplicaciones'],
    // Recursos Humanos es un destino sin submenú.
    ['/recursos-humanos', 'rrhh'],
    // Sin ítem propio: el de la ruta más larga que lo contiene.
    ['/gestion/anuncios/nuevo', 'gestion-anuncios'],
    // La Clínica es un destino propio, fuera de Recursos Humanos.
    ['/clinica', 'clinica'],
    ['/clinica-recetas', 'recetas'],
    ['/directorio/', 'directorio'],
    ['/configuracion', 'config'],
    // Pantalla de gestión (solo se muestra con el rol, pero se marca igual).
    ['/gestion/anuncios', 'gestion-anuncios'],
    ['/no-existe', null],
  ])('%s → %s', (ruta, id) => expect(idActual(ruta)).toBe(id))
})

describe('fechas "AAAA-MM-DD" sin corrimiento de zona horaria', () => {
  it('se leen a mano', () => {
    expect(fechaLarga('2026-08-05')).toBe('5 de agosto de 2026')
    expect(mesAnio('2025-12-01')).toBe('diciembre de 2025')
    expect(aFecha('2026-01-01').getDate()).toBe(1)
    expect(hoyIso(new Date(2026, 8, 24, 23, 30))).toBe('2026-09-24')
    expect(fechaCorta('2026-08-05')).toBe('5 ago 2026')
    expect(diaLargo('2026-08-05')).toBe('miércoles 5 de agosto de 2026')
  })
})

describe('boletines nuevos (contador del menú)', () => {
  const hoy = new Date(2026, 8, 24)
  const fechas = ['2026-05-01', '2026-06-30', '2026-08-01', '2026-09-20']

  it('cuenta los de los últimos 90 días que no se vieron', () => {
    expect(recientesSinVer(fechas, '', hoy)).toBe(3)
    expect(recientesSinVer(fechas, '2026-08-01', hoy)).toBe(1)
    expect(recientesSinVer(fechas, '2026-09-20', hoy)).toBe(0)
  })
})

describe('regla del proyecto: sin IPs internas', () => {
  const raiz = fileURLToPath(new URL('../../', import.meta.url))
  const IP_PRIVADA = /\b(10(\.\d{1,3}){3}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|192\.168(\.\d{1,3}){2})\b/
  const TEXTO = /\.(tsx?|json|css|html|md|conf|template)$/

  function archivos(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name)
      return e.isDirectory() ? archivos(p) : TEXTO.test(e.name) ? [p] : []
    })
  }

  it('ni en src/, nginx/, index.html ni el README', () => {
    const lista = [...archivos(path.join(raiz, 'src')), ...archivos(path.join(raiz, 'nginx')), path.join(raiz, 'index.html'), path.join(raiz, 'README.md')]
    const con = lista.filter((f) => IP_PRIVADA.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(raiz, f))
    expect(con).toEqual([])
  })
})
