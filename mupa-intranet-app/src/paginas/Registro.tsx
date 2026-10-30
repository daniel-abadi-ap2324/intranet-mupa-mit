/**
 * Crear cuenta (/registro): sin aprobación, con la cédula. La cuenta se crea en
 * Identity Central (el login de la Alcaldía) y la intranet no guarda la cédula.
 * Página propia, sin menú, como /entrar. Al terminar la persona queda con sesión
 * y se le ofrece confirmar el correo con un código.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { api, CAMPOS_REGISTRO, ErrorApi, type DatosRegistro } from '../api'
import { ConfirmarCorreo } from '../components/cuenta/ConfirmarCorreo'
import { Salir } from '../components/Salir'
import { SinLlave } from '../components/SinLlave'
import { BotonOjo } from '../components/ui'
import { useDatos } from '../datos'
import { useTitulo } from './titulo'

// Identity Central todavía exige el correo (medido el 2026-09-29). Cuando lo haga opcional, basta con poner false.
const CORREO_OBLIGATORIO = true

const CEDULA = /^(PE|E|N|[1-9]|1[0-3])(AV|PI)?-\d{1,4}-\d{1,6}$/i
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Solo correos institucionales: los mismos dominios que CORREO_DOMINIOS de la API (que es la que decide).
const DOMINIOS_CORREO = ['pty.gob.pa']
const esInstitucional = (correo: string) => DOMINIOS_CORREO.includes(correo.toLowerCase().split('@').pop() ?? '')
const MESA = 'Mesa de Servicios, ext. 1400'

type Campo = keyof DatosRegistro | 'confirmar'
type Errores = Partial<Record<Campo | 'general', string>>
// Orden del formulario: el foco va al primer campo con error.
const ORDEN: Campo[] = ['cedula', 'nombre', 'apellido', 'correo', 'clave', 'confirmar', 'celular', 'telefono', 'cargo']

const VACIO: DatosRegistro = { cedula: '', nombre: '', apellido: '', clave: '', correo: '', celular: '', telefono: '', cargo: '' }

function revisar(d: DatosRegistro, confirmar: string, pedirNombre: boolean): Errores {
  const e: Errores = {}
  if (!d.cedula.trim()) e.cedula = 'Escribe tu cédula.'
  else if (!CEDULA.test(d.cedula.trim())) e.cedula = 'Escribe la cédula con guiones, por ejemplo 8-123-456.'
  // El nombre sale de Recursos Humanos: solo se pide si no se pudo saber (lo dice el servidor).
  if (pedirNombre && !d.nombre.trim()) e.nombre = 'Escribe tu nombre.'
  if (pedirNombre && !d.apellido.trim()) e.apellido = 'Escribe tu apellido.'
  if (!d.correo.trim()) {
    if (CORREO_OBLIGATORIO) e.correo = 'Escribe tu correo.'
  } else if (!CORREO.test(d.correo.trim())) e.correo = 'Escribe un correo válido, por ejemplo nombre@pty.gob.pa.'
  else if (!esInstitucional(d.correo.trim())) e.correo = 'Usa tu correo institucional (@pty.gob.pa).'
  if (d.clave.length < 8) e.clave = 'La contraseña debe tener al menos 8 caracteres.'
  if (!confirmar) e.confirmar = 'Vuelve a escribir la contraseña.'
  else if (confirmar !== d.clave) e.confirmar = 'Las dos contraseñas no son iguales.'
  return e
}

/** Errores del backend: cada campo en su lugar; lo demás, arriba del formulario. */
function erroresDelServidor(err: unknown): Errores {
  if (err instanceof ErrorApi && err.campos.length) {
    const e: Errores = {}
    for (const c of err.campos) {
      const campo = CAMPOS_REGISTRO[c.field]
      if (campo && !e[campo]) e[campo] = c.message
      else if (!campo) e.general = c.message
    }
    return e
  }
  if (!(err instanceof ErrorApi)) return { general: 'No se pudo conectar con la intranet. Revisa tu conexión e inténtalo de nuevo.' }
  switch (err.codigo) {
    case 'ALREADY_REGISTERED':
      return { general: err.message }
    case 'IDENTITY_UNAVAILABLE':
    case 'IDENTITY_ERROR':
      return { general: 'El sistema de cuentas de la Alcaldía no responde. Espera unos minutos y vuelve a intentarlo.' }
    case 'NOT_FUNCIONARIO':
    case 'RRHH_UNAVAILABLE':
    case 'RRHH_ERROR':
      return { general: err.message }
    case 'REGISTRATION_UNAVAILABLE':
      return { general: `Crear cuentas todavía no está disponible en este servidor (falta conectarlo con el login de la Alcaldía). Si ya tienes cuenta, entra con ella; si no, pídela a la ${MESA}.` }
    case 'APP_ACCESS_DENIED':
      return { general: `Tu cuenta se creó, pero todavía no tiene acceso a la intranet. Pídelo a la ${MESA}.` }
  }
  if (err.estado >= 500 || err.codigo.startsWith('HTTP_')) return { general: 'No se pudo conectar con la intranet. Inténtalo de nuevo en unos minutos.' }
  return { general: err.message }
}

export function Registro() {
  useTitulo('Crear cuenta')
  const navegar = useNavigate()
  const { usuario: sesion, recargar } = useDatos()
  const [datos, setDatos] = useState<DatosRegistro>(VACIO)
  const [confirmar, setConfirmar] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [errores, setErrores] = useState<Errores>({})
  const [pedirNombre, setPedirNombre] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [creada, setCreada] = useState(false)
  // Se decide al crear la cuenta: si dependiera de la sesión, el aviso de "confirmado" desaparecería al recargarla.
  const [correoPorConfirmar, setCorreoPorConfirmar] = useState('')
  const formulario = useRef<HTMLFormElement>(null)
  const alerta = useRef<HTMLDivElement>(null)

  const [cargos, setCargos] = useState<string[]>([])

  useEffect(() => {
    // Catálogo de cargos de RRHH (solo sugerencias: se puede escribir otro). Aparte, para no pesar en el resto del sitio.
    import('../data/cargos.json').then((m) => setCargos(m.default.cargos), () => setCargos([]))
  }, [])

  const cambiar = (campo: keyof DatosRegistro) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setDatos((d) => ({ ...d, [campo]: e.target.value }))
    setErrores((x) => ({ ...x, [campo]: undefined }))
  }

  function enfocar(e: Errores) {
    const primero = ORDEN.find((c) => e[c])
    if (primero) formulario.current?.querySelector<HTMLElement>(`#reg-${primero}`)?.focus()
    else if (e.general) alerta.current?.focus()
  }

  async function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    // Al enviar, las contraseñas vuelven a taparse.
    setMostrar(false)
    const faltan = revisar(datos, confirmar, pedirNombre)
    if (Object.keys(faltan).length) {
      setErrores(faltan)
      enfocar(faltan)
      return
    }
    setEnviando(true)
    setErrores({})
    try {
      const cuenta = await api.registrar(datos)
      if (cuenta.correo && cuenta.correoVerificado === false) setCorreoPorConfirmar(cuenta.correo)
    } catch (err) {
      setEnviando(false)
      const e = erroresDelServidor(err)
      // RH Link no pudo dar el nombre: ahora sí se pide.
      if (e.nombre || e.apellido) setPedirNombre(true)
      setErrores(e)
      // requestAnimationFrame: el aviso general recién aparece en el próximo render.
      requestAnimationFrame(() => enfocar(e))
      return
    }
    setCreada(true)
    await recargar()
  }

  /** Un campo del formulario, con su etiqueta, ayuda y error en el mismo lugar de siempre. */
  function campo(
    nombre: keyof DatosRegistro | 'confirmar',
    etiqueta: string,
    control: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string; className: string }) => React.ReactNode,
    opciones: { obligatorio?: boolean; ayuda?: string } = {},
  ) {
    const id = `reg-${nombre}`
    const error = errores[nombre]
    const describe = [opciones.ayuda && `${id}-ayuda`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
    return (
      <div className={'f-field' + (error ? ' is-invalid' : '')}>
        <label htmlFor={id}>
          {etiqueta}
          {opciones.obligatorio ? <span className="f-req" aria-hidden="true">*</span> : <span className="registro__opcional"> (opcional)</span>}
        </label>
        {opciones.ayuda && (
          <span className="f-hint" id={`${id}-ayuda`}>
            {opciones.ayuda}
          </span>
        )}
        {control({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describe, className: 'ds-input' })}
        {error && (
          <p className="f-err" id={`${id}-error`}>
            {error}
          </p>
        )}
      </div>
    )
  }

  const texto = (nombre: keyof DatosRegistro, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (p: object) => (
    <input {...p} name={nombre} value={datos[nombre]} onChange={cambiar(nombre)} {...extra} />
  )

  return (
    <div className="login">
      <main className="login__main" id="registro">
        <section className="login__card registro__card" aria-labelledby="registro-t">
          <div className="login__marca">
            <img src="/sitio/2024/08/LogoMupa.png" alt="" width={38} height={44} />
            <div>
              <b>Intranet</b>
              <span>Alcaldía de Panamá</span>
            </div>
          </div>

          {creada && sesion ? (
            <>
              <h1 id="registro-t">Tu cuenta está lista</h1>
              <p className="login__intro">
                Ya entraste como <b>{sesion.nombre}</b>. Con tu cédula (o tu correo) y tu contraseña entras a la intranet y a los demás sistemas de la Alcaldía que usan
                el mismo inicio de sesión.
              </p>
              {correoPorConfirmar && <ConfirmarCorreo correo={correoPorConfirmar} />}
              <div className="login__acciones registro__seguir">
                <button type="button" className="ds-btn ds-btn--primary" onClick={() => navegar('/', { replace: true })}>
                  Ir al inicio
                </button>
              </div>
            </>
          ) : sesion ? (
            <>
              <h1 id="registro-t">Ya tienes sesión</h1>
              <p className="login__intro">
                Estás en la intranet como <b>{sesion.nombre}</b>. Para crear otra cuenta, primero cierra esta sesión.
              </p>
              <div className="login__acciones">
                <Link className="ds-btn ds-btn--primary" to="/">
                  Ir al inicio
                </Link>
                <Salir />
              </div>
            </>
          ) : (
            <>
              <h1 id="registro-t">Crea tu cuenta</h1>
              <p className="login__intro">Para el personal de la Alcaldía. Con esta cuenta entras a la intranet y a los sistemas que usan el login de la Alcaldía.</p>

              {errores.general && (
                <div className="login__error" role="alert" tabIndex={-1} ref={alerta}>
                  <span className="ic" aria-hidden="true">!</span>
                  <p>
                    {errores.general}
                    {errores.general.startsWith('Ya hay una cuenta') && (
                      <>
                        {' '}
                        <Link to="/entrar">Entrar</Link>
                      </>
                    )}
                  </p>
                </div>
              )}

              <SinLlave que="Crear una cuenta (Identity Central y RH Link)">
                <Link to="/entrar">Entra con una cuenta ficticia</Link>.
              </SinLlave>

              <p className="registro__nota">
                Los campos con <span className="f-req">*</span> son obligatorios.
              </p>

              <form className="login__form" ref={formulario} onSubmit={enviar} noValidate>
                {campo('cedula', 'Cédula', texto('cedula', { autoComplete: 'off', spellCheck: false, autoCapitalize: 'characters', autoFocus: true }), {
                  obligatorio: true,
                  ayuda: 'Con guiones, como aparece en tu cédula. Ejemplo: 8-123-456. Tu nombre y tu departamento los tomamos de Recursos Humanos.',
                })}
                {pedirNombre && (
                  <div className="registro__fila">
                    {campo('nombre', 'Nombre', texto('nombre', { autoComplete: 'given-name' }), { obligatorio: true })}
                    {campo('apellido', 'Apellido', texto('apellido', { autoComplete: 'family-name' }), { obligatorio: true })}
                  </div>
                )}
                {campo('correo', 'Correo', texto('correo', { type: 'email', inputMode: 'email', autoComplete: 'email', autoCapitalize: 'none', spellCheck: false }), {
                  obligatorio: CORREO_OBLIGATORIO,
                  ayuda: 'Tu correo institucional (@pty.gob.pa). Te mandaremos un código para confirmarlo y sirve para recuperar tu contraseña.',
                })}
                {campo(
                  'clave',
                  'Contraseña',
                  (p) => (
                    <div className="login__clave">
                      <input
                        {...p}
                        name="clave"
                        type={mostrar ? 'text' : 'password'}
                        autoComplete="new-password"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={datos.clave}
                        onChange={cambiar('clave')}
                      />
                      <BotonOjo visible={mostrar} onAlternar={() => setMostrar((m) => !m)} controla="reg-clave reg-confirmar" nombre="contraseñas" />
                    </div>
                  ),
                  { obligatorio: true, ayuda: 'Al menos 8 caracteres. Es la misma para los sistemas de la Alcaldía.' },
                )}
                {campo(
                  'confirmar',
                  'Repite la contraseña',
                  (p) => (
                    <input
                      {...p}
                      name="confirmar"
                      type={mostrar ? 'text' : 'password'}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={confirmar}
                      onChange={(e) => {
                        setConfirmar(e.target.value)
                        setErrores((x) => ({ ...x, confirmar: undefined }))
                      }}
                    />
                  ),
                  { obligatorio: true },
                )}
                <div className="registro__fila">
                  {campo('celular', 'Celular', texto('celular', { type: 'tel', inputMode: 'tel', autoComplete: 'tel' }))}
                  {campo('telefono', 'Teléfono o extensión', texto('telefono', { type: 'tel', inputMode: 'tel' }))}
                </div>
                {campo('cargo', 'Cargo', texto('cargo', { autoComplete: 'off', list: 'reg-cargos' }), { ayuda: 'Escribe y elige de la lista de RRHH, o escribe el tuyo si no está.' })}
                <datalist id="reg-cargos">
                  {cargos.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>

                <button className="ds-btn ds-btn--primary login__entrar" type="submit" disabled={enviando}>
                  {enviando ? 'Creando tu cuenta…' : 'Crear cuenta'}
                </button>
              </form>

              <p className="login__registro">
                ¿Ya tienes cuenta? <Link to="/entrar">Entra</Link>
              </p>
            </>
          )}
        </section>
      </main>
      <footer className="login__pie">
        ¿Necesitas ayuda? {MESA} · <a href="mailto:mesadeayuda@pty.gob.pa">mesadeayuda@pty.gob.pa</a>
      </footer>
    </div>
  )
}
