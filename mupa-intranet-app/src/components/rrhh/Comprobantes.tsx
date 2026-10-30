/**
 * Comprobantes de pago (RRHH Express): resumen del año, historial por páginas y el
 * detalle de cada pago, que se puede imprimir. La cuenta bancaria llega enmascarada.
 */
import React, { useEffect, useState } from 'react'

import { api } from '../../api'
import { fechaCorta, MES } from '../../lib/fechas'
import { FORMA_PAGO, moneda, pagosPorFecha, periodo, TIPO_CUENTA, type Comprobante, type DetalleComprobante, type DiaDePago } from '../../lib/rrhh'
import { FilaKpi, Kpi } from '../gestion/Piezas'
import { Dialogo } from '../ui'
import { Cargando, Datos, ErrorCarga, esDesconexion, useRrhh } from './comun'

function DetallePago({ c, onCerrar, alDesconectar }: { c: Comprobante; onCerrar: () => void; alDesconectar: () => void }) {
  const [detalle, setDetalle] = useState<DetalleComprobante | null>(null)
  const [sinDetalle, setSinDetalle] = useState(false)

  useEffect(() => {
    api
      .rrhhDetalle(c.planilla)
      .then(setDetalle)
      .catch((e) => (esDesconexion(e) ? alDesconectar() : setSinDetalle(true)))
  }, [c.planilla, alDesconectar])

  const d = c.descuentos
  return (
    <Dialogo
      id="rh-pago"
      titulo={'Comprobante · ' + periodo(c)}
      onCerrar={onCerrar}
      pie={
        <div className="home-dlg__foot">
          <button type="button" className="ds-btn ds-btn--primary" onClick={() => window.print()} data-foco>
            Imprimir
          </button>
        </div>
      }
    >
      <div className="home-dlg__body rh-pago" id="rh-pago-imprimir">
        <div className="rh-pago__neto">
          <span>Neto pagado</span>
          <b>{moneda(c.neto)}</b>
        </div>
        <table className="ds-table rh-tabla rh-pago__tabla">
          <tbody>
            <tr>
              <th scope="row">Salario bruto</th>
              <td>{moneda(c.bruto)}</td>
            </tr>
            {(
              [
                ['Seguro Social', d.seguroSocial],
                ['Seguro Educativo', d.seguroEducativo],
                ['Impuesto sobre la renta', d.impuestoRenta],
                ['Fondo complementario', d.fondoComplementario],
                ['ASEMUP', d.asemup],
                ['Otros descuentos', d.otros],
              ] as [string, number][]
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>− {moneda(v)}</td>
                </tr>
              ))}
            <tr className="rh-pago__total">
              <th scope="row">Total de descuentos</th>
              <td>− {moneda(d.total)}</td>
            </tr>
            <tr className="rh-pago__total">
              <th scope="row">Neto</th>
              <td>{moneda(c.neto)}</td>
            </tr>
          </tbody>
        </table>

        {detalle && detalle.lineas.length > 0 && (
          <>
            <h3 className="rh-sub">Descuentos directos</h3>
            <table className="ds-table rh-tabla">
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Descuento</th>
                  <th scope="col">Saldo pendiente</th>
                </tr>
              </thead>
              <tbody>
                {detalle.lineas.map((l, i) => (
                  <tr key={i}>
                    <td>{l.codigo}</td>
                    <td>{moneda(l.monto)}</td>
                    <td>{l.saldo ? moneda(l.saldo) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {!detalle && !sinDetalle && <Cargando t="Cargando el detalle…" />}

        <Datos
          filas={[
            ['Fecha de pago', c.fecha ? fechaCorta(c.fecha) : null],
            ['Cargo', c.cargo],
            ['Días pagados', c.diasPagados],
            ['Forma de pago', c.formaPago ? FORMA_PAGO[c.formaPago] ?? c.formaPago : null],
            ['Cuenta', c.cuenta ? [c.tipoCuenta ? TIPO_CUENTA[c.tipoCuenta] ?? c.tipoCuenta : null, c.cuenta].filter(Boolean).join(' ') : null],
            ['Planilla n.º', c.planilla],
            ['Comprobante n.º', c.cheque],
          ]}
        />
      </div>
    </Dialogo>
  )
}

function ResumenDelAnio({ alDesconectar }: { alDesconectar: () => void }) {
  const actual = new Date().getFullYear()
  const [anio, setAnio] = useState(actual)
  const { datos, error, cargando, recargar } = useRrhh(() => api.rrhhResumenAnual(anio), alDesconectar, [anio])
  const dias = pagosPorFecha(datos?.items ?? [])
  const max = Math.max(1, ...dias.map((d) => d.bruto))
  const titulo = (d: DiaDePago) => (d.pagos.length > 1 ? d.pagos.length + ' pagos del ' + (d.fecha ? fechaCorta(d.fecha) : periodo(d.base)) : periodo(d.base))

  return (
    <section className="rh-anio" aria-labelledby="h-rh-anio">
      <div className="rh-anio__head">
        <h3 id="h-rh-anio" className="rh-sub">
          Resumen del año
        </h3>
        <label className="rh-anio__sel">
          <span className="sr-only">Año</span>
          <select className="ds-input" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => actual - i).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>
      {cargando && !datos && <Cargando />}
      {error && <ErrorCarga t={error} reintentar={recargar} />}
      {datos && (
        <>
          <FilaKpi etiqueta={'Totales de ' + datos.anio}>
            <Kpi tono="azul" icono="barras" valor={moneda(datos.totales.bruto)} etiqueta="Salario bruto" />
            <Kpi tono="ambar" icono="capas" valor={moneda(datos.totales.descuentos)} etiqueta="Descuentos" />
            <Kpi tono="verde" icono="listo" valor={moneda(datos.totales.neto)} etiqueta="Neto recibido" />
          </FilaKpi>
          {datos.items.length > 0 ? (
            <figure className="rh-barras">
              <ol aria-hidden="true">
                {dias.map((d) => (
                  <li key={d.clave} title={titulo(d) + ': neto ' + moneda(d.neto)}>
                    <span className="rh-barras__barra" style={{ height: (d.bruto / max) * 100 + '%' }}>
                      <span className="rh-barras__neto" style={{ height: d.bruto ? (d.neto / d.bruto) * 100 + '%' : 0 }} />
                    </span>
                    <span className="rh-barras__k">{d.base.periodo.mes ? MES[d.base.periodo.mes - 1].slice(0, 3) : '·'}</span>
                  </li>
                ))}
              </ol>
              <figcaption className="rh-nota">
                Cada barra es un día de pago (si ese día hubo más de un pago, se suman): la parte oscura es lo que recibiste y la clara, los descuentos.
              </figcaption>
              {/* Una tabla no respeta el alto de 1 px de .sr-only y alargaba la página: va dentro de un div. */}
              <div className="sr-only">
                <table>
                  <caption>Pagos de {datos.anio}</caption>
                  <tbody>
                    {dias.map((d) => (
                      <tr key={d.clave}>
                        <th scope="row">{titulo(d)}</th>
                        <td>Bruto {moneda(d.bruto)}</td>
                        <td>Neto {moneda(d.neto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </figure>
          ) : (
            <p className="rh-vacio">No hay pagos registrados en {datos.anio}.</p>
          )}
        </>
      )}
    </section>
  )
}

export function Comprobantes({ alDesconectar }: { alDesconectar: () => void }) {
  const [pagina, setPagina] = useState(1)
  const [abierto, setAbierto] = useState<Comprobante | null>(null)
  const { datos, error, cargando, recargar } = useRrhh(() => api.rrhhComprobantes(pagina), alDesconectar, [pagina])

  return (
    <div className="rh-compr">
      <ResumenDelAnio alDesconectar={alDesconectar} />

      <h3 className="rh-sub">Historial de pagos</h3>
      {cargando && !datos && <Cargando t="Cargando tus comprobantes…" />}
      {error && <ErrorCarga t={error} reintentar={recargar} />}
      {datos && !datos.items.length && <p className="rh-vacio">No hay comprobantes de pago registrados.</p>}
      {datos && datos.items.length > 0 && (
        <>
          <div className="rh-tabla-wrap">
            <table className="ds-table rh-tabla">
              <thead>
                <tr>
                  <th scope="col">Período</th>
                  <th scope="col">Fecha</th>
                  <th scope="col" className="num">
                    Bruto
                  </th>
                  <th scope="col" className="num">
                    Descuentos
                  </th>
                  <th scope="col" className="num">
                    Neto
                  </th>
                  <th scope="col">
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((c, i) => (
                  <tr key={c.planilla + '-' + (c.cheque ?? i)}>
                    <td>{periodo(c)}</td>
                    <td>{c.fecha ? fechaCorta(c.fecha) : '—'}</td>
                    <td className="num">{moneda(c.bruto)}</td>
                    <td className="num">{moneda(c.descuentos.total)}</td>
                    <td className="num">
                      <b>{moneda(c.neto)}</b>
                    </td>
                    <td>
                      <button type="button" className="ds-btn ds-btn--ghost rh-btn-sm" onClick={() => setAbierto(c)} aria-label={'Ver el comprobante de ' + periodo(c)}>
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {datos.paginas > 1 && (
            <nav className="rh-paginas" aria-label="Páginas del historial">
              <button type="button" className="ds-btn ds-btn--ghost" disabled={pagina <= 1 || cargando} onClick={() => setPagina((p) => p - 1)}>
                ‹ Más recientes
              </button>
              <span>
                Página {datos.pagina} de {datos.paginas}
              </span>
              <button type="button" className="ds-btn ds-btn--ghost" disabled={pagina >= datos.paginas || cargando} onClick={() => setPagina((p) => p + 1)}>
                Anteriores ›
              </button>
            </nav>
          )}
        </>
      )}
      {abierto && <DetallePago c={abierto} onCerrar={() => setAbierto(null)} alDesconectar={alDesconectar} />}
    </div>
  )
}

