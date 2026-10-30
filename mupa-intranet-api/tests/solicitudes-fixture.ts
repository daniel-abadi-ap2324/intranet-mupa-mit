/** Un formulario y respuestas válidas para las pruebas de eventos, notificaciones y auditoría (ficticio). */
export const FORM_PRUEBA = {
  title: 'Solicitud de equipo',
  area: 'Tecnología',
  destination: 'Mesa de Servicios',
  accepting: true,
  sections: [
    {
      title: 'Quién solicita',
      fields: [
        { k: 'nombre', l: 'Nombre completo', t: 'text', r: true, auto: 'nombreCompleto' },
        { k: 'correo', l: 'Correo', t: 'email', r: true, auto: 'correo' },
      ],
    },
    { title: 'Qué necesitas', fields: [{ k: 'tipo', l: 'Tipo', t: 'radio', r: true, opts: ['Equipo', 'Otro'] }] },
  ],
}

export const RESPUESTAS_BIEN = { v: { s0_nombre: 'Otro nombre', s1_tipo: 'Equipo' }, c: {}, i: {} }
