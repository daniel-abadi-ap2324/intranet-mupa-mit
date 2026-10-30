/**
 * Dibujo de un carnet de ejemplo que muestra dónde está el número de cargo (la «Posición»):
 * debajo del código QR. Todo es ficticio: el nombre, la posición, la
 * silueta y el QR (un patrón cualquiera, no codifica nada). Nunca se usa el carnet ni los datos
 * de una persona real. El logo es el oficial, sin tocar.
 */

// Patrón de 11 x 11: tres esquinas de orientación y relleno cualquiera. No es un código QR real.
const QR = [
  '11111110101',
  '10000010011',
  '10111010110',
  '10111010001',
  '10111011100',
  '10000010101',
  '11111110010',
  '00000000110',
  '10110101011',
  '01001110100',
  '11010011101',
]

export function CarnetEjemplo() {
  return (
    <figure className="rh-carnet-fig">
      <figcaption>¿Dónde está tu número de cargo?</figcaption>
      <div className="rh-carnet-wrap">
        <span className="rh-carnet-etiqueta">Ejemplo</span>
        <div className="rh-carnet" aria-hidden="true">
          <div className="rh-carnet__arriba">
            <img className="rh-carnet__logo" src="/marca/logos/svg/logo-azul-sobre-blanco-horizontal.svg" alt="" width={1462} height={758} />
            <span className="rh-carnet__ipty">I★PTY</span>
          </div>
          <div className="rh-carnet__medio">
            <div className="rh-carnet__foto">
              <svg viewBox="0 0 40 48" focusable="false">
                <circle cx="20" cy="16" r="9" />
                <path d="M3 48c0-11 8-18 17-18s17 7 17 18z" />
              </svg>
            </div>
            <div className="rh-carnet__datos">
              <div className="rh-carnet__qr">
                {QR.flatMap((fila, y) => [...fila].map((c, x) => <i key={`${y}-${x}`} className={c === '1' ? 'on' : undefined} />))}
              </div>
              <p className="rh-carnet__pos">POSICIÓN: 000000</p>
            </div>
          </div>
          <div className="rh-carnet__pie">NOMBRE APELLIDO</div>
        </div>
      </div>
      <p id="rh-carnet-pie">Debajo del código QR: «Posición». Solo números.</p>
    </figure>
  )
}
