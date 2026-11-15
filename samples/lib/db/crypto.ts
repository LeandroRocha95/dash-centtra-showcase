import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

export type EncryptedSecret = { iv: string; tag: string; data: string } // base64

function keyBytes(keyB64: string): Buffer {
  const k = Buffer.from(keyB64, 'base64')
  if (k.length !== 32) throw new Error('ENCRYPTION_KEY deve ter 32 bytes (base64)')
  return k
}

export function encryptSecret(plain: string, keyB64: string): EncryptedSecret {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBytes(keyB64), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), data: data.toString('base64') }
}

export function decryptSecret(enc: EncryptedSecret, keyB64: string): string {
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(keyB64), Buffer.from(enc.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(enc.data, 'base64')), decipher.final()]).toString('utf8')
}
