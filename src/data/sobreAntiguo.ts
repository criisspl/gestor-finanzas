import type { Llave, Sobre } from './cifrado'

/** Solo para tests: cifra como lo hacían las versiones 1 a 5, sin datos adicionales autenticados (AAD). */
export async function cifrarAntiguo(llave: Llave, valor: unknown, version: 1 | 2 | 3 | 4 | 5): Promise<Sobre> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const datos = new TextEncoder().encode(JSON.stringify(valor))
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, llave.clave, datos))
  const base64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
  return { version, sal: llave.sal, iteraciones: llave.iteraciones, iv: base64(iv), cifrado: base64(cifrado) }
}
