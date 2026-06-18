import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { globalConfig } from '../config';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function chave(): Buffer {
  const raw = Buffer.from(globalConfig.ENCRYPTION_KEY, 'base64');
  if (raw.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY precisa ter 32 bytes em base64. Gere com: openssl rand -base64 32`,
    );
  }
  return raw;
}

/** Cifra string. Formato de saída: base64(iv | tag | ciphertext). */
export function cifrar(textoPlano: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, chave(), iv);
  const enc = Buffer.concat([cipher.update(textoPlano, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/** Decifra string no formato base64(iv | tag | ciphertext). */
export function decifrar(cifrado: string): string {
  const buf = Buffer.from(cifrado, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error('Texto cifrado inválido (curto demais).');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
