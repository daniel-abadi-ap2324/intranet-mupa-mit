/**
 * Iniciar sesión con la cuenta de la Alcaldía (Identity Central): cédula o correo
 * institucional y la contraseña de siempre. Página propia, sin menú, para que lo
 * único a la vista sea entrar. El backend hace el login contra el central y guarda
 * los tokens; aquí solo llega la cuenta y una cookie de sesión. En desarrollo también
 * sirven las cuentas ficticias (admin@, comunicacion@, gestor@, prueba1@ejemplo.test…).
 * El departamento es obligatorio: quien entra sin uno tiene que elegirlo antes de pasar
 * (la guarda de App.tsx manda aquí a cualquiera con sesión y sin departamento).
 */
import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { api, ErrorApi } from '../api'
import { Salir } from '../components/Salir'
import { SinLlave } from '../components/SinLlave'
import { CampoClave } from '../components/ui'
import { useDatos } from '../datos'
import { destinoSeguro } from '../lib/url'
import { useTitulo } from './titulo'

type Errores = { usuario?: string; clave?: string; general?: string }

const MESA = 'Mesa de Servicios, ext. 1400'

/** Qué decirle a la persona según lo que respondió el backend: qué pasó y qué hacer. */
function mensajeDeError(err: unknown): string {
  if (!(err instanceof ErrorApi)) return 'No se pudo conectar con la intranet. Revisa tu conexión e inténtalo de nuevo.'
  switch (err.codigo) {
    case 'INVALID_CREDENTIALS':
      return 'La cédula o el correo, o la contraseña, no son correctos. Revisa las mayúsculas y vuelve a intentarlo.'
    case 'APP_ACCESS_DENIED':
      return `Tu usuario existe, pero todavía no tiene acceso a la intranet. Pídelo a la ${MESA}.`
    case 'IDENTITY_UNAVAILABLE':
    case 'IDENTITY_ERROR':
      return 'El sistema de inicio de sesión de la Alcaldía no responde. Espera unos minutos y vuelve a intentarlo.'
    // Bloqueo, o RH Link: no es funcionario activo, falta la cédula o RRHH no responde (el mensaje ya dice qué hacer).
    case 'ACCOUNT_LOCKED':
    case 'NOT_FUNCIONARIO':
    case 'CEDULA_REQUIRED':
    case 'RRHH_UNAVAILABLE':
    case 'RRHH_ERROR':
      return err.message
  }
  if (err.estado >= 500 || err.codigo.startsWith('HTTP_')) return 'No se pudo conectar con la intranet. Inténtalo de nuevo en unos minutos.'
  return err.message
}

/** Segundo paso del login para quien todavía no tiene departamento: elegirlo es obligatorio. */
function ElegirDepartamento({ alElegir }: { alElegir: () => Promise<void> }) {
  const [lista, setLista] = useState<{ id: number; nombre: string }[] | null>(null)
  const [elegido, setElegido] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const campo = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    api.opcionesDepartamento().then(setLista, () => {
      setLista([])
      setError(`No se pudo cargar la lista de departamentos. Inténtalo de nuevo en unos minutos, o llama a la ${MESA}.`)
    })
  }, [])

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!elegido) {
      setError('Elige tu departamento para continuar.')
      campo.current?.focus()
      return
    }
    setEnviando(true)
    setError('')
    try {
      await api.elegirDepartamento(Number(elegido))
      await alElegir()
    } catch (err) {
      setEnviando(false)
      // 409: ya tenía uno (lo asignó administración mientras tanto): se recarga y se sigue.
      if (err instanceof ErrorApi && err.codigo === 'DEPARTMENT_ALREADY_SET') return alElegir()
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar tu departamento. Revisa tu conexión e inténtalo de nuevo.')
    }
  }

  return (
    <>
      <h1 id="login-t">Elige tu departamento</h1>
      <p className="login__intro">No pudimos saber tu departamento desde Recursos Humanos. Elígelo para continuar: decide qué aplicaciones ves, y si te equivocas, administración lo corrige.</p>
      <form className="login__form" onSubmit={enviar} noValidate>
        <div className={'f-field' + (error ? ' is-invalid' : '')}>
          <label htmlFor="departamento">
            Departamento<span className="f-req" aria-hidden="true">*</span>
          </label>
          <select
            ref={campo}
            className="ds-input"
            id="departamento"
            name="departamento"
            required
            autoFocus
            value={elegido}
            disabled={lista === null}
            onChange={(e) => {
              setElegido(e.target.value)
              setError('')
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'departamento-error' : undefined}
          >
            <option value="">{lista === null ? 'Cargando…' : 'Elige tu departamento'}</option>
            {(lista ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
          {error && (
            <p className="f-err" id="departamento-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <button className="ds-btn ds-btn--primary login__entrar" type="submit" disabled={enviando || lista === null}>
          {enviando ? 'Guardando…' : 'Continuar'}
        </button>
      </form>
      <div className="login__acciones">
        <Salir />
      </div>
    </>
  )
}

export function Entrar() {
  useTitulo('Iniciar sesión')
  const navegar = useNavigate()
  const { state } = useLocation()
  const { usuario: sesion, recargar } = useDatos()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [enviando, setEnviando] = useState(false)
  const [entro, setEntro] = useState(false)
  const campoUsuario = useRef<HTMLInputElement>(null)
  const campoClave = useRef<HTMLInputElement>(null)
  const volver = destinoSeguro((state as { volver?: unknown } | null)?.volver)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const faltan: Errores = {}
    if (!usuario.trim()) faltan.usuario = 'Escribe tu cédula o tu correo.'
    if (!clave) faltan.clave = 'Escribe tu contraseña.'
    if (faltan.usuario || faltan.clave) {
      setErrores(faltan)
      ;(faltan.usuario ? campoUsuario : campoClave).current?.focus()
      return
    }
    setEnviando(true)
    setErrores({})
    try {
      await api.entrar(usuario.trim(), clave)
    } catch (err) {
      setEnviando(false)
      setErrores({ general: mensajeDeError(err) })
      // Con credenciales malas se borra la contraseña y se vuelve a ella (como en GOV.UK).
      if (err instanceof ErrorApi && err.codigo === 'INVALID_CREDENTIALS') setClave('')
      campoClave.current?.focus()
      return
    }
    await recargar()
    // Con departamento se pasa de largo; sin él se queda aquí y se lo pide (efecto de abajo).
    setEntro(true)
  }

  const sinDepartamento = !!sesion && sesion.departamentoId == null
  useEffect(() => {
    if (entro && sesion && !sinDepartamento) navegar(volver, { replace: true })
  }, [entro, sesion, sinDepartamento, navegar, volver])

  async function departamentoElegido() {
    await recargar()
    navegar(volver, { replace: true })
  }


  return (
    <div className="login">
      <main className="login__main" id="login">
        <section className="login__card" aria-labelledby="login-t">
          <div className="login__marca">
            <img src="/marca/logos/svg/logo-azul-sobre-blanco-horizontal.svg" alt="Alcaldía de Panamá" width={200} height={104} />
            <b>Intranet</b>
          </div>

          {sinDepartamento ? (
            <ElegirDepartamento alElegir={departamentoElegido} />
          ) : sesion ? (
            <>
              <h1 id="login-t">Ya iniciaste sesión</h1>
              <p className="login__intro">
                Entraste como <b>{sesion.nombre}</b>.
              </p>
              <div className="login__acciones">
                <Link className="ds-btn ds-btn--primary" to={volver}>
                  {volver === '/' ? 'Ir al inicio' : 'Seguir donde estaba'}
                </Link>
                <Salir />
              </div>
            </>
          ) : (
            <>
              <h1 id="login-t">Entra a la intranet</h1>
              {errores.general && (
                <div className="login__error" role="alert">
                  <span className="ic" aria-hidden="true">!</span>
                  <p>{errores.general}</p>
                </div>
              )}

              <form className="login__form" onSubmit={enviar} noValidate>
                <div className={'f-field' + (errores.usuario ? ' is-invalid' : '')}>
                  <label htmlFor="username">Cédula o correo</label>
                  <input
                    ref={campoUsuario}
                    className="ds-input"
                    id="username"
                    name="username"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    value={usuario}
                    onChange={(e) => {
                      setUsuario(e.target.value)
                      setErrores((x) => ({ ...x, usuario: undefined }))
                    }}
                    aria-invalid={errores.usuario ? true : undefined}
                    aria-describedby={errores.usuario ? 'username-error' : undefined}
                  />
                  {errores.usuario && (
                    <p className="f-err" id="username-error">
                      {errores.usuario}
                    </p>
                  )}
                </div>

                <div className={'f-field' + (errores.clave ? ' is-invalid' : '')}>
                  <label htmlFor="password">Contraseña</label>
                  <CampoClave
                    id="password"
                    inputRef={campoClave}
                    autoComplete="current-password"
                    value={clave}
                    onChange={(v) => {
                      setClave(v)
                      setErrores((x) => ({ ...x, clave: undefined }))
                    }}
                    invalido={!!errores.clave}
                    describedBy={errores.clave ? 'password-error' : undefined}
                  />
                  {errores.clave && (
                    <p className="f-err" id="password-error">
                      {errores.clave}
                    </p>
                  )}
                </div>

                <button className="ds-btn ds-btn--primary login__entrar" type="submit" disabled={enviando}>
                  {enviando ? 'Entrando…' : 'Entrar'}
                </button>
              </form>

              <div className="login__otras">
                <Link className="ds-btn login__sec" to="/registro">
                  Crear cuenta
                </Link>
                <Link className="ds-btn login__sec" to={volver}>
                  Entrar sin cuenta
                </Link>
              </div>

              <SinLlave que="El ingreso con la cuenta de la Alcaldía (Identity Central)">
                Entra con una cuenta ficticia: <b>admin@ejemplo.test</b>, <b>comunicacion@ejemplo.test</b>, <b>gestor@ejemplo.test</b>, <b>prueba1@ejemplo.test</b> o <b>prueba2@ejemplo.test</b>, con la contraseña <b>password</b>.
              </SinLlave>

              <p className="login__olvido">
                ¿Olvidaste tu contraseña? Llama a la {MESA}.
              </p>
            </>
          )}
        </section>

      </main>
    </div>
  )
}
