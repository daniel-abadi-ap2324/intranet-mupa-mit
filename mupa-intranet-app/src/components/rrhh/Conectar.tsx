/**
 * «Conecta tu cuenta de RRHH Express». Con sesión que ya conoce la cédula solo se pide el número
 * de cargo; sin sesión, cédula y número de cargo. La API se los pasa a RH Link, que los
 * comprueba; la intranet no lo guarda.
 */
import React, { useRef, useState } from 'react'

import { api, ErrorApi } from '../../api'
import { mensajeConexion, validarConexion, type ConexionRrhh, type ErroresConexion } from '../../lib/rrhh'
import { CampoClave, EnlaceEntrar } from '../ui'
import { CarnetEjemplo } from './CarnetEjemplo'

type Errores = ErroresConexion & { general?: string }

export function Conectar({ vencida, cedulaConocida, conSesion, alConectar }: { vencida: boolean; cedulaConocida: boolean; conSesion: boolean; alConectar: (c: ConexionRrhh) => void }) {
  const [cedula, setCedula] = useState('')
  const [clave, setClave] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [enviando, setEnviando] = useState(false)
  const campoCedula = useRef<HTMLInputElement>(null)
  const campoClave = useRef<HTMLInputElement>(null)
  const pedirCedula = !cedulaConocida

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const faltan = validarConexion({ pedirCedula, cedula, clave })
    if (faltan.cedula || faltan.clave) {
      setErrores(faltan)
      ;(faltan.cedula ? campoCedula : campoClave).current?.focus()
      return
    }
    setEnviando(true)
    setErrores({})
    try {
      const c = await api.rrhhConectar(clave.trim(), pedirCedula ? cedula.trim().toUpperCase() : undefined)
      setClave('')
      alConectar(c)
    } catch (err) {
      setEnviando(false)
      if (err instanceof ErrorApi && err.codigo === 'VALIDATION_ERROR') {
        const campo = (f: string) => err.campos.find((x) => x.field === f)?.message
        setErrores({ cedula: campo('cedula'), clave: campo('password') })
        return
      }
      const codigo = err instanceof ErrorApi ? err.codigo : null
      setErrores({
        general: err instanceof ErrorApi ? mensajeConexion(codigo, err.estado, { pedirCedula }) : 'No se pudo conectar con la intranet. Revisa tu conexión e inténtalo de nuevo.',
      })
      if (codigo === 'RRHH_CREDENCIALES') setClave('')
      campoClave.current?.focus()
    }
  }

  return (
    <section className="rh-conectar" aria-labelledby="h-rh-conectar">
      <form className="rh-conectar__form" onSubmit={enviar} noValidate>
        <div className="rh-conectar__tit">
          <h2 id="h-rh-conectar">Conecta tu cuenta de RRHH Express</h2>
          <p>No guardamos tus datos.</p>
        </div>
        {vencida && (
          <p className="rh-conectar__vencida" role="status">
            Tu conexión venció. Vuelve a conectarla.
          </p>
        )}
        {errores.general && (
          <div className="login__error" role="alert">
            <span className="ic" aria-hidden="true">!</span>
            <p>{errores.general}</p>
          </div>
        )}
        {pedirCedula && (
          <div className={'f-field' + (errores.cedula ? ' is-invalid' : '')}>
            <label htmlFor="rh-cedula">Cédula</label>
            <input
              ref={campoCedula}
              className="ds-input"
              id="rh-cedula"
              name="rh-cedula"
              type="text"
              placeholder="8-123-456"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={cedula}
              onChange={(e) => {
                setCedula(e.target.value)
                setErrores((x) => ({ ...x, cedula: undefined }))
              }}
              aria-invalid={errores.cedula ? true : undefined}
              aria-describedby={errores.cedula ? 'rh-cedula-error' : undefined}
            />
            {errores.cedula && (
              <p className="f-err" id="rh-cedula-error">
                {errores.cedula}
              </p>
            )}
          </div>
        )}
        <div className={'f-field' + (errores.clave ? ' is-invalid' : '')}>
          <label htmlFor="rh-clave">Número de cargo</label>
          <CampoClave
            id="rh-clave"
            inputRef={campoClave}
            autoComplete="off"
            inputMode="numeric"
            nombre="número de cargo"
            value={clave}
            onChange={(v) => {
              setClave(v)
              setErrores((x) => ({ ...x, clave: undefined }))
            }}
            invalido={!!errores.clave}
            describedBy={['rh-carnet-pie', errores.clave && 'rh-clave-error'].filter(Boolean).join(' ') || undefined}
          />
          {errores.clave && (
            <p className="f-err" id="rh-clave-error">
              {errores.clave}
            </p>
          )}
        </div>
        <div className="rh-conectar__acciones">
          <button className="ds-btn ds-btn--primary" type="submit" disabled={enviando}>
            {enviando ? 'Conectando…' : 'Ver mis datos'}
          </button>
          {!conSesion && <EnlaceEntrar className="rh-conectar__entrar" />}
        </div>
      </form>

      <CarnetEjemplo />
    </section>
  )
}
