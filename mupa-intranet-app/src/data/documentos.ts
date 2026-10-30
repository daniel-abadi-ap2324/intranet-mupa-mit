/*
 * Reglamentos, manuales, procedimientos y permisos (PDF guardados en public/sitio/).
 * `h: null` = «Próximamente»: el lugar existe pero RRHH todavía no envía el archivo
 * (no se crea ningún PDF ni enlace de relleno).
 */
export type Documento = { title: string; meta: string; cat: string; h: string | null; ext?: boolean; pdf?: boolean }

export const DOCUMENTOS: Documento[] = [
  {
    "title": "Instructivo del sistema de la Clínica",
    "meta": "Cómo pedir cita y medicamentos · PDF",
    "cat": "Manuales",
    "h": "/sitio/2023/03/Instructivo-del-sistema-de-clinica-del-Municipio-de-Panama-vf3.pdf",
    "ext": true,
    "pdf": true
  },
  {
    "title": "Reglamento Interno de Personal",
    "meta": "Decreto Alcaldicio N.° 024-2019",
    "cat": "Reglamentos",
    "h": "/sitio/2020/06/Reglamento-Interno-de-Personal-Decreto-024-2019.pdf",
    "ext": true,
    "pdf": true
  },
  {
    "title": "Código de Ética",
    "meta": "PDF · 2023",
    "cat": "Reglamentos",
    "h": "/sitio/2023/01/CODIGO-DE-ETICA01.pdf",
    "ext": true,
    "pdf": true
  },
  {
    "title": "Formularios de Equiparación de Oportunidades",
    "meta": "Recursos Humanos",
    "cat": "Equiparación de Oportunidades",
    "h": null
  },
  {
    "title": "Acuerdos de servidores públicos",
    "meta": "PDF · 2025 · 2,2 MB",
    "cat": "Reglamentos",
    "h": "/sitio/2025/01/acuerdos-servidores-publicos.pdf",
    "ext": true,
    "pdf": true
  },
  {
    "title": "Manual Plan DIGECA 2020",
    "meta": "PDF · Recursos Humanos · 2020",
    "cat": "Manuales",
    "h": "/sitio/2020/10/Plan-Digeca-2020.pdf",
    "ext": true,
    "pdf": true
  },
  {
    "title": "Guía de usuario TRANSDOC",
    "meta": "PDF · 3,1 MB",
    "cat": "Manuales",
    "h": "/sitio/2020/06/GuiadeUsuarioTransdoc-1.pdf",
    "ext": true,
    "pdf": true
  },
  {
    "title": "Guía rápida: portal de Mesa de Ayuda MEF",
    "meta": "PDF · ISTMO · 2020",
    "cat": "Procedimientos",
    "h": "/sitio/Guia-Rapida-Portal-Mesa-de-Ayuda-290420-1.pdf",
    "ext": true,
    "pdf": true
  },
  {
    "title": "Comunicado DNC-0006: usuario ISTMO",
    "meta": "PDF · DNC–MEF · 29 de abril de 2020",
    "cat": "Procedimientos",
    "h": "/sitio/Comunicado-DNC-0006-29ABR20-Portal-Mesa-de-Ayuda-Centro-de-Atencion-.pdf",
    "ext": true,
    "pdf": true
  },
  {
    "title": "Permiso para actividades que generan ruido de forma temporal",
    "meta": "PDF · Hasta 100 personas · uso interno",
    "cat": "Permisos",
    "h": "/sitio/2025/01/Formulario-ACTIVIDAD-QUE-GENERAN-RUIDO-DE-FORMA-TEMPORAL.pdf",
    "ext": true,
    "pdf": true
  },
  {
    "title": "Permiso para espectáculo público o actividad de diversión temporal (hasta 500 personas)",
    "meta": "PDF · uso interno",
    "cat": "Permisos",
    "h": "/sitio/2025/01/Formulario-ESPECTACULO-PUBLICO-MENOS-DE-500-PERSONAS-MUNICIPIO.pdf",
    "ext": true,
    "pdf": true
  },
  {
    "title": "Permiso para espectáculo público o actividad de diversión temporal (más de 500 personas)",
    "meta": "PDF · uso interno",
    "cat": "Permisos",
    "h": "/sitio/2025/01/Formulario-ESPECTACULO-PUBLICO-MAS-DE-500-PERSONAS.pdf",
    "ext": true,
    "pdf": true
  }
]
