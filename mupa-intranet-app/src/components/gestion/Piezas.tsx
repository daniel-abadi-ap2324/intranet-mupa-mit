/**
 * Piezas del Centro de Gestión: tarjetas de cifras (KPI), tarjetas de sección y
 * los gráficos (barras por día, dona por estado, barras de avance). SVG propio,
 * sin librerías; cada gráfico trae su tabla para lectores de pantalla.
 */
import React, { useState } from 'react'
import { Link } from 'react-router'

import { IconoGestion, type NombreIcono } from './Iconos'

export type Tono = 'azul' | 'ambar' | 'rojo' | 'verde' | 'morado' | 'cian' | 'gris'

const numero = (n: number) => n.toLocaleString('es-PA')

/** Una cifra: ícono, valor grande y etiqueta. Con `to` u `onClick`, lleva a donde se atiende. */
export function Kpi(p: { tono: Tono; icono: NombreIcono; valor: React.ReactNode; etiqueta: string; detalle?: string; to?: string; onClick?: () => void; alerta?: boolean }) {
  const cls = 'cg-kpi cg-kpi--' + p.tono + (p.alerta ? ' is-alerta' : '') + (p.to || p.onClick ? ' is-accion' : '')
  const cuerpo = (
    <>
      <span className="cg-kpi__ic">
        <IconoGestion nombre={p.icono} />
      </span>
      <span className="cg-kpi__tx">
        <span className="cg-kpi__val">{typeof p.valor === 'number' ? numero(p.valor) : p.valor}</span>
        <span className="cg-kpi__k">{p.etiqueta}</span>
        {p.detalle && (
          <span className="cg-kpi__d" title={p.detalle}>
            {p.detalle}
          </span>
        )}
      </span>
    </>
  )
  if (p.to)
    return (
      <Link className={cls} to={p.to}>
        {cuerpo}
      </Link>
    )
  if (p.onClick)
    return (
      <button type="button" className={cls} onClick={p.onClick}>
        {cuerpo}
      </button>
    )
  return <div className={cls}>{cuerpo}</div>
}

/** Cuántas tarjetas hay de verdad (entrando en los fragmentos y sin contar los `false`). */
function contar(children: React.ReactNode): number {
  return React.Children.toArray(children).reduce<number>((n, c) => n + (React.isValidElement<{ children?: React.ReactNode }>(c) && c.type === React.Fragment ? contar(c.props.children) : 1), 0)
}

/** Fila de cifras: las columnas se ajustan a cuántas hay, para que no quede una tarjeta sola en una fila. */
export function FilaKpi({ children, etiqueta }: { children: React.ReactNode; etiqueta: string }) {
  const n = Math.max(1, contar(children))
  // Hasta 6 en una fila; con más, en dos filas parejas (7 → 4 + 3). En laptop, hasta 4 siguen en una fila.
  const fila = n > 6 ? Math.ceil(n / 2) : n
  const laptop = n <= 4 ? n : Math.ceil(n / 2)
  return (
    <section className="cg-kpis" aria-label={etiqueta} data-impar={n % 2 ? '' : undefined} style={{ '--cg-n': fila, '--cg-n2': laptop } as React.CSSProperties}>
      {children}
    </section>
  )
}

/** Tarjeta de sección: título en versalitas con su ícono y, a la derecha, un contador o una acción. */
export function Tarjeta(p: { id: string; titulo: string; icono: NombreIcono; extra?: React.ReactNode; cls?: string; children: React.ReactNode }) {
  return (
    <section className={'cg-card' + (p.cls ? ' ' + p.cls : '')} aria-labelledby={'cg-' + p.id}>
      <header className="cg-card__head">
        <IconoGestion nombre={p.icono} className="cg-card__ic" />
        <h2 id={'cg-' + p.id}>{p.titulo}</h2>
        {p.extra && <span className="cg-card__extra">{p.extra}</span>}
      </header>
      <div className="cg-card__body">{p.children}</div>
    </section>
  )
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const diaCorto = (ymd: string) => Number(ymd.slice(8, 10)) + ' ' + MES[Number(ymd.slice(5, 7)) - 1]

/** Una serie por día: barras finas, el valor del día más alto y el de hoy, y el detalle al pasar el puntero. */
export function BarrasDiarias({ datos, etiqueta }: { datos: { date: string; n: number }[]; etiqueta: string }) {
  const [activo, setActivo] = useState<number | null>(null)
  const paso = 20
  const ancho = datos.length * paso
  const alto = 150
  const base = alto - 22
  const max = Math.max(1, ...datos.map((d) => d.n))
  const iMax = datos.findIndex((d) => d.n === max)
  const h = (n: number) => (n / max) * (base - 22)
  const total = datos.reduce((s, d) => s + d.n, 0)
  const act = activo === null ? null : datos[activo]
  return (
    <figure className="cg-barras">
      <div className="cg-barras__plot" onMouseLeave={() => setActivo(null)}>
        <svg viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" role="img" aria-label={`${etiqueta}: ${total} en ${datos.length} días`}>
          <line x1="0" x2={ancho} y1={base + 0.5} y2={base + 0.5} className="cg-eje" />
          {datos.map((d, i) => {
            const x = i * paso + 4
            const alt = h(d.n)
            return (
              <g key={d.date}>
                {d.n > 0 && <path className={'cg-barra' + (activo === i ? ' is-activa' : '')} d={barra(x, base, 12, alt)} />}
                <rect x={i * paso} y={0} width={paso} height={alto} fill="transparent" onMouseEnter={() => setActivo(i)} />
              </g>
            )
          })}
        </svg>
        {/* Etiquetas en HTML: con preserveAspectRatio="none" el texto del SVG se deformaría. */}
        {datos.map((d, i) =>
          d.n > 0 && (i === iMax || i === datos.length - 1) ? (
            <span key={d.date} className="cg-barras__v" style={{ left: `${((i + 0.5) / datos.length) * 100}%`, bottom: `${((alto - base + h(d.n)) / alto) * 100}%` }}>
              {d.n}
            </span>
          ) : null,
        )}
        {act && activo !== null && (
          <span className="cg-tip" style={{ left: `${((activo + 0.5) / datos.length) * 100}%` }} role="status">
            <b>{act.n}</b> · {diaCorto(act.date)}
          </span>
        )}
      </div>
      <div className="cg-barras__x" aria-hidden="true">
        {datos.map((d, i) => (
          <span key={d.date}>{i === datos.length - 1 ? 'Hoy' : i % 7 === 0 && i < datos.length - 4 ? diaCorto(d.date) : ''}</span>
        ))}
      </div>
      {/* Una tabla no respeta el alto de 1 px de .sr-only y alargaba la página: va dentro de un div. */}
      <div className="sr-only">
        <table>
          <caption>{etiqueta}</caption>
          <tbody>
            {datos.map((d) => (
              <tr key={d.date}>
                <th scope="row">{diaCorto(d.date)}</th>
                <td>{d.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

/** Barra vertical con la punta redondeada (4px) y la base recta sobre el eje. */
function barra(x: number, base: number, w: number, alt: number): string {
  const r = Math.min(4, alt, w / 2)
  const y = base - alt
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`
}

/** Partes de un todo (pocas): dona con el total al centro y la leyenda con cifra y porcentaje. */
export function Dona({ partes, centro, etiqueta }: { partes: { k: string; t: string; n: number; color: string }[]; centro: string; etiqueta: string }) {
  const total = partes.reduce((s, p) => s + p.n, 0)
  const r = 42
  const c = 2 * Math.PI * r
  const visibles = partes.filter((p) => p.n > 0)
  const hueco = visibles.length > 1 ? 2 : 0
  let acumulado = 0
  return (
    <figure className="cg-dona">
      <svg viewBox="0 0 110 110" role="img" aria-label={etiqueta + ': ' + partes.map((p) => `${p.t} ${p.n}`).join(', ')}>
        <circle cx="55" cy="55" r={r} className="cg-dona__fondo" />
        {visibles.map((p) => {
          const largo = (p.n / total) * c
          const seg = (
            <circle
              key={p.k}
              cx="55"
              cy="55"
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="14"
              strokeDasharray={`${Math.max(0, largo - hueco)} ${c}`}
              strokeDashoffset={-acumulado}
              transform="rotate(-90 55 55)"
            >
              <title>{`${p.t}: ${p.n}`}</title>
            </circle>
          )
          acumulado += largo
          return seg
        })}
      </svg>
      <div className="cg-dona__centro" aria-hidden="true">
        <b>{numero(total)}</b>
        <span>{centro}</span>
      </div>
      <ul className="cg-leyenda">
        {partes.map((p) => (
          <li key={p.k}>
            <span className="cg-leyenda__m" style={{ background: p.color }} aria-hidden="true" />
            <span className="cg-leyenda__t">{p.t}</span>
            <b>{numero(p.n)}</b>
            <span className="cg-leyenda__p">{total ? Math.round((p.n / total) * 100) + '%' : '—'}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

/** Avance: una parte de un total, con las dos cifras a la derecha. */
export function Avance({ t, n, de, tono = 'azul', detalle }: { t: string; n: number; de: number; tono?: Tono; detalle?: string }) {
  const pct = de ? Math.min(100, (n / de) * 100) : 0
  return (
    <div className="cg-avance">
      <div className="cg-avance__fila">
        <span className="cg-avance__t">{t}</span>
        <span className="cg-avance__n">
          {numero(n)} <span>/ {numero(de)}</span>
        </span>
      </div>
      <div className={'cg-avance__barra cg-avance__barra--' + tono} role="progressbar" aria-label={t} aria-valuemin={0} aria-valuemax={de} aria-valuenow={n}>
        <span style={{ width: pct + '%' }} />
      </div>
      {detalle && <span className="cg-avance__d">{detalle}</span>}
    </div>
  )
}
