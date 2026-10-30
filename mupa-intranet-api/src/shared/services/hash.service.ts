import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

const N = 16384
const r = 8
const p = 1
const LARGO = 64

function derivar(clave: string, sal: Buffer, opciones: ScryptOptions): Promise<Buffer> {
  return new Promise((ok, falla) => scrypt(clave, sal, LARGO, opciones, (e, k) => (e ? falla(e) : ok(k))))
}

// Hash de relleno: se compara contra él cuando la cuenta no existe, para que la
// respuesta tarde lo mismo y no revele qué correos tienen cuenta.
const RELLENO = 'scrypt$16384$8$1$' + Buffer.alloc(16).toString('base64') + '$' + Buffer.alloc(LARGO).toString('base64')

/** Contraseñas con scrypt (incluido en Node: sin módulos nativos). Formato: scrypt$N$r$p$sal$hash */
export class HashService {
  async hash(clave: string): Promise<string> {
    const sal = randomBytes(16)
    const k = await derivar(clave, sal, { N, r, p })
    return ['scrypt', N, r, p, sal.toString('base64'), k.toString('base64')].join('$')
  }

  /** Compara en tiempo constante. `guardado` null = cuenta sin clave local (siempre false). */
  async verify(clave: string, guardado: string | null): Promise<boolean> {
    const partes = (guardado ?? RELLENO).split('$')
    if (partes.length !== 6 || partes[0] !== 'scrypt') return false
    const [, n, rr, pp, sal, hash] = partes
    const esperado = Buffer.from(hash, 'base64')
    const k = await derivar(clave, Buffer.from(sal, 'base64'), { N: Number(n), r: Number(rr), p: Number(pp) })
    return guardado !== null && k.length === esperado.length && timingSafeEqual(k, esperado)
  }
}

export const hashService = new HashService()
