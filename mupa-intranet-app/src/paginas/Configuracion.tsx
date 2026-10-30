import React, { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { ConfirmarCorreo } from '../components/cuenta/ConfirmarCorreo'
import { Salir } from '../components/Salir'
import { api } from '../api'
import { CabeceraPagina, EnlaceEntrar } from '../components/ui'
import { useDatos } from '../datos'
import { ROL_ETIQUETA, type Rol } from '../lib/roles'
import type { ConexionRrhh } from '../lib/rrhh'

/** Cuentas de otros sistemas conectadas a esta sesión (hoy, RRHH Express). Solo si el servidor lo tiene. */
function CuentasConectadas() {
  const [rrhh, setRrhh] = useState<ConexionRrhh | null>(null)
  const [saliendo, setSaliendo] = useState(false)
  useEffect(() => {
    api.rrhhConexion().then(setRrhh)
  }, [])
  if (!rrhh?.disponible) return null

  async function desconectar() {
    setSaliendo(true)
    await api.rrhhDesconectar().catch(() => undefined)
    setSaliendo(false)
    setRrhh((c) => c && { ...c, conectada: false, nombre: null, vence: null })
  }

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <header><span className="ic">⛓</span><h2>Cuentas conectadas</h2></header>
      <div className="body">
        <div className="pref-row">
          <div className="tx">
            <b>RRHH Express</b>
            <p>
              {rrhh.conectada
                ? 'Conectada' + (rrhh.nombre ? ' como ' + rrhh.nombre : '') + '. Tus marcaciones, comprobantes y expediente se ven en Recursos Humanos.'
                : 'Conéctala en Recursos Humanos para ver tus marcaciones, comprobantes y expediente.'}
            </p>
          </div>
          {rrhh.conectada ? (
            <button type="button" className="ds-btn ds-btn--subtle" onClick={desconectar} disabled={saliendo}>
              {saliendo ? 'Desconectando…' : 'Desconectar'}
            </button>
          ) : (
            <Link className="ds-btn ds-btn--subtle" to="/recursos-humanos">Conectar</Link>
          )}
        </div>
      </div>
    </section>
  )
}

export function Configuracion() {
  const { usuario: u } = useDatos()
  return (
    <div style={{ maxWidth: 760 }}>
      <CabeceraPagina titulo="Configuración" intro="Tu cuenta y tu pantalla de inicio." />
      <section className="panel">
        <header><span className="ic">⚙</span><h2>Tu pantalla de inicio</h2></header>
        <div className="body">
          <div className="pref-row">
            <div className="tx">
              <b>Personalizar inicio</b>
              <p>Elige qué bloques ver, en qué orden y de qué tamaño. {u ? 'Se guarda en tu cuenta.' : 'Sin sesión se guarda solo en este navegador.'}</p>
            </div>
            <Link className="ds-btn ds-btn--subtle" to="/?personalizar=1">Personalizar</Link>
          </div>
          <div className="pref-row">
            <div className="tx">
              <b>Recorrido de la intranet</b>
              <p>Un minuto por lo principal: la búsqueda, el asistente, el menú y dónde pedir ayuda.</p>
            </div>
            <Link className="ds-btn ds-btn--subtle" to="/?recorrido=1">Ver el recorrido</Link>
          </div>
        </div>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <header><span className="ic">◉</span><h2>Tu cuenta</h2></header>
        <div className="body">
          {u ? (
            <>
              <p className="ds-body cuenta-datos"><b>{u.nombre}</b>{u.correo && ` · ${u.correo}`}</p>
              <p className="ds-body-sm">Roles: {u.roles.map((r) => ROL_ETIQUETA[r as Rol] || r).join(', ')}</p>
              {u.correo && u.correoVerificado === false && (
                <div style={{ marginTop: 12 }}>
                  <ConfirmarCorreo correo={u.correo} />
                </div>
              )}
              {u.correo && u.correoVerificado && (
                <p className="correo-codigo__listo">
                  <span aria-hidden="true">✓</span> Correo confirmado
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <Salir />
              </div>
            </>
          ) : (
            <EnlaceEntrar className="ds-btn ds-btn--primary" />
          )}
        </div>
      </section>
      {u && <CuentasConectadas />}
    </div>
  )
}
