/*
 * Directorio institucional. En esta copia los nombres de las personas son inventados (las
 * direcciones y oficinas son las de la estructura municipal; las extensiones, ficticias). El original se importa con
 * scripts/importar-directorio.mjs a directorio-personas.json. Las extensiones clave,
 * la central y el organigrama también son los publicados.
 */
import PERSONAS from './directorio-personas.json'

export type PersonaDirectorio = {
  nombre: string
  apellido: string
  direccion: string
  unidad?: string
  ext: string
  ubicacion: string
  /** Un equipo de la central (bocina, sala, parada…): no sale en la lista, solo al buscarlo. */
  soloBusqueda?: boolean
}

const personas: PersonaDirectorio[] = PERSONAS

export const DIRECTORIO = {
  central: '524-8900',
  organigrama: '/sitio/2021/03/Organigrama-Municipal-scaled.jpg',
  /** Las direcciones que aparecen en el directorio, por nombre. */
  direcciones: [...new Set(personas.map((p) => p.direccion).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
  extensionesClave: [
    { ext: '1400', t: 'Mesa de Ayuda · Tecnología' },
    { ext: '1200', t: 'Recepción · Participación Ciudadana' },
    { ext: '1600', t: 'Recepción · Tecnología' },
    { ext: '1614', t: 'Telefonía' },
    { ext: '1621', t: 'Cuarto de Servidores' },
    { ext: '1657', t: 'Administración DTI' },
    { ext: '1670', t: 'Desarrollo · Tecnología' },
  ],
  personas,
}
