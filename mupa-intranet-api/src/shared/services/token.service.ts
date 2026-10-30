import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto'

/**
 * Tokens de sesión: 32 bytes al azar para la cookie; en la base solo su SHA-256.
 * Lo que la sesión guarde de secreto (el refresh token de Identity Central) se
 * cifra con AES-256-GCM y una clave derivada del token de la cookie: sin la
 * cookie, una copia de la base no sirve para descifrarlo.
 */
export class TokenService {
  generate(): string {
    return randomBytes(32).toString('base64url')
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  /** `purpose` separa las claves: lo cifrado para una cosa no se descifra con la de otra. */
  encrypt(plaintext: string, sessionToken: string, purpose = SESSION_SECRETS): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key(sessionToken, purpose), iv)
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')
  }

  /** Lanza un error si el dato se alteró o la cookie no es la de esa sesión. */
  decrypt(sealed: string, sessionToken: string, purpose = SESSION_SECRETS): string {
    const raw = Buffer.from(sealed, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', this.key(sessionToken, purpose), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
  }

  private key(sessionToken: string, purpose: string): Buffer {
    return Buffer.from(hkdfSync('sha256', sessionToken, '', purpose, 32))
  }
}

const SESSION_SECRETS = 'mupa-intranet:session-secrets'

export const tokenService = new TokenService()
