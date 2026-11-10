/**
 * Cifrado en el navegador con Web Crypto.
 * La clave se deriva de la contraseña con PBKDF2 y los datos se cifran con AES-GCM:
 * al servidor solo llega el resultado cifrado, nunca la contraseña ni la clave.
 */

/** Lo que se guarda en el servidor. Sin la contraseña no se puede leer. */
export interface Sobre {
  /** 1: movimientos y patrimonio. 2: añade notas. Se sabe abrir ambas. */
  version: 1 | 2
  /** Sal de PBKDF2 en base64. Es única por persona y no es secreta. */
  sal: string
  iteraciones: number
  /** Vector de inicialización de AES-GCM en base64. Nuevo en cada guardado. */
  iv: string
  /** Datos cifrados en base64, con la etiqueta de autenticación de GCM al final. */
  cifrado: string
}

/** Clave ya derivada de la contraseña, con los parámetros necesarios para volver a derivarla. */
export interface Llave {
  clave: CryptoKey
  sal: string
  iteraciones: number
}

/** Versión con la que se escriben los sobres nuevos. */
export const VERSION_SOBRE = 2

/** Recomendación de OWASP para PBKDF2-HMAC-SHA256. */
export const ITERACIONES = 600_000

export class ContrasenaIncorrecta extends Error {
  constructor() {
    super('La contraseña no es correcta')
  }
}

function aBase64(bytes: Uint8Array): string {
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario)
}

function deBase64(texto: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0))
}

async function derivar(contrasena: string, sal: Uint8Array<ArrayBuffer>, iteraciones: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(contrasena), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sal, iterations: iteraciones, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // la clave no se puede exportar desde el navegador
    ['encrypt', 'decrypt'],
  )
}

/** Llave nueva con sal aleatoria, para la primera vez que alguien elige contraseña. */
export async function crearLlave(contrasena: string, iteraciones = ITERACIONES): Promise<Llave> {
  const sal = crypto.getRandomValues(new Uint8Array(16))
  return { clave: await derivar(contrasena, sal, iteraciones), sal: aBase64(sal), iteraciones }
}

/** Vuelve a derivar la llave con la sal y las iteraciones guardadas en el sobre. */
export async function abrirLlave(contrasena: string, sobre: Pick<Sobre, 'sal' | 'iteraciones'>): Promise<Llave> {
  const clave = await derivar(contrasena, deBase64(sobre.sal), sobre.iteraciones)
  return { clave, sal: sobre.sal, iteraciones: sobre.iteraciones }
}

export async function cifrar(llave: Llave, valor: unknown): Promise<Sobre> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const datos = new TextEncoder().encode(JSON.stringify(valor))
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, llave.clave, datos))
  return { version: VERSION_SOBRE, sal: llave.sal, iteraciones: llave.iteraciones, iv: aBase64(iv), cifrado: aBase64(cifrado) }
}

/** Lanza ContrasenaIncorrecta si la llave no es la del sobre (o si alguien lo ha manipulado). */
export async function descifrar<T>(llave: Llave, sobre: Sobre): Promise<T> {
  if (sobre.version !== 1 && sobre.version !== 2) throw new Error(`Versión de sobre no soportada: ${String(sobre.version)}`)
  let datos: ArrayBuffer
  try {
    datos = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deBase64(sobre.iv) }, llave.clave, deBase64(sobre.cifrado))
  } catch {
    throw new ContrasenaIncorrecta()
  }
  return JSON.parse(new TextDecoder().decode(datos)) as T
}
