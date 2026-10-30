/*
 * Manuales y documentos institucionales publicados. Solo lo que existe: no se
 * inventan manuales para llenar huecos. Los PDF están en public/sitio/.
 */
const UP = '/sitio/'

export type Documento = { t: string; meta: string; h: string }

export const MANUALES: Documento[] = [
  { t: 'Manual Plan DIGECA 2020', meta: 'Recursos Humanos · PDF', h: UP + '2020/10/Plan-Digeca-2020.pdf' },
  { t: 'Instructivo del sistema de la Clínica', meta: 'Clínica Municipal · PDF', h: UP + '2023/03/Instructivo-del-sistema-de-clinica-del-Municipio-de-Panama-vf3.pdf' },
]

export const DOCUMENTOS_INSTITUCIONALES: Documento[] = [
  { t: 'Reglamento Interno de Personal', meta: 'Decreto Alcaldicio N.° 024-2019 · PDF', h: UP + '2020/06/Reglamento-Interno-de-Personal-Decreto-024-2019.pdf' },
  { t: 'Código de Ética', meta: 'PDF · 2023', h: UP + '2023/01/CODIGO-DE-ETICA01.pdf' },
  { t: 'Guía de usuario TRANSDOC', meta: 'Sistema de gestión documental · PDF · 3,1 MB', h: UP + '2020/06/GuiadeUsuarioTransdoc-1.pdf' },
  { t: 'Acuerdos de servidores públicos', meta: 'PDF · 2025 · 2,2 MB', h: UP + '2025/01/acuerdos-servidores-publicos.pdf' },
]
