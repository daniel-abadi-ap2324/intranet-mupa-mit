/**
 * Confirmar el correo de la cuenta: Identity Central manda un código al correo y la
 * persona lo escribe aquí. El correo es siempre el de la sesión (el backend no acepta otro).
 */
import React, { useEffect, useRef, useState } from 'react'

import { api, ErrorApi } from '../../api'
import { useDatos } from '../../datos'

type Paso = 'inicio' | 'enviado' | 'listo'

function mensaje(err: unknown): string {
  if (!(err instanceof ErrorApi) || err.estado >= 500 || err.codigo.startsWith('HTTP_')) {
    return 'No se pudo hablar con el sistema de la Alcaldía. Espera unos minutos y vuelve a intentarlo.'
  }
  return err.message
}

export function ConfirmarCorreo({ correo }: { correo: string }) {
  const { recargar } = useDatos()
  const [paso, setPaso] = useState<Paso>('inicio')
  const [aviso, setAviso] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  // Cuántos códigos se mandaron: con cada uno, el foco va al campo del código.
  const [envios, setEnvios] = useState(0)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (envios) campo.current?.focus()
  }, [envios])

  async function enviarCodigo() {
    setOcupado(true)
    setError('')
    try {
      const r = await api.pedirCodigoCorreo()
      setAviso(`Te mandamos un código a ${r.correoOculto || correo}.` + (r.minutos ? ` Vence en ${r.minutos} minutos.` : ''))
      setPaso('enviado')
      setCodigo('')
      setEnvios((n) => n + 1)
    } catch (err) {
      if (err instanceof ErrorApi && err.codigo === 'EMAIL_ALREADY_VERIFIED') {
        setPaso('listo')
        await recargar()
      } else setError(mensaje(err))
    } finally {
      setOcupado(false)
    }
  }

  async function confirmar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!codigo.trim()) {
      setError('Escribe el código que te llegó al correo.')
      campo.current?.focus()
      return
    }
    setOcupado(true)
    setError('')
    try {
      await api.verificarCorreo(codigo)
      setPaso('listo')
      await recargar()
    } catch (err) {
      setError(mensaje(err))
      campo.current?.focus()
    } finally {
      setOcupado(false)
    }
  }

  if (paso === 'listo') {
    return (
      <p className="correo-codigo__listo" role="status">
        <span aria-hidden="true">✓</span> Confirmaste tu correo <b>{correo}</b>.
      </p>
    )
  }

  return (
    <div className="correo-codigo">
      {paso === 'inicio' ? (
        <>
          <p className="ds-body-sm">
            Confirma tu correo <b>{correo}</b>: te mandamos un código y lo escribes aquí. Así puedes recuperar tu contraseña si la olvidas.
          </p>
          <button type="button" className="ds-btn ds-btn--primary" onClick={enviarCodigo} disabled={ocupado}>
            {ocupado ? 'Enviando…' : 'Enviar código'}
          </button>
          {error && (
            <p className="f-err" role="alert">
              {error}
            </p>
          )}
        </>
      ) : (
        <form onSubmit={confirmar} noValidate>
          <p className="ds-body-sm" role="status">
            {aviso} Si no lo ves, revisa la carpeta de correo no deseado.
          </p>
          <div className={'f-field' + (error ? ' is-invalid' : '')}>
            <label htmlFor="codigo-correo">Código</label>
            <div className="correo-codigo__fila">
              <input
                ref={campo}
                className="ds-input"
                id="codigo-correo"
                name="codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={12}
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value)
                  setError('')
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'codigo-correo-error' : undefined}
              />
              <button type="submit" className="ds-btn ds-btn--primary" disabled={ocupado}>
                {ocupado ? 'Confirmando…' : 'Confirmar'}
              </button>
            </div>
            {error && (
              <p className="f-err" id="codigo-correo-error">
                {error}
              </p>
            )}
          </div>
          <button type="button" className="ds-btn ds-btn--ghost correo-codigo__reenviar" onClick={enviarCodigo} disabled={ocupado}>
            Mandar otro código
          </button>
        </form>
      )}
    </div>
  )
}
