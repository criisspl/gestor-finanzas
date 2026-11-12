import { crearBoveda, type AlmacenBoveda } from './boveda.ts'
import { abrirLlave, cifrar, ContrasenaIncorrecta, crearLlave, descifrar, ITERACIONES, type Sobre } from './cifrado.ts'
import { normalizarEstado, type Estado } from './memoria.ts'

/**
 * Mover los datos de un sitio a otro (local ↔ Supabase, ejemplo → real) o llevarlos en un fichero.
 * Los datos solo se descifran en memoria con la contraseña de la bóveda y se vuelven a cifrar para el destino:
 * al destino llega lo mismo que recibía el origen (el sobre cifrado). La contraseña no se guarda ni se escribe en el fichero.
 */

/** Identifica el fichero de exportación. */
export const FORMATO_FICHERO = 'gestor-finanzas-sobre'
const VERSION_FICHERO = 1
/** Tope del fichero que se acepta: un sobre normal pesa unos KB, así que 5 MB es de sobra y evita cargar basura enorme. */
export const TAMANO_MAXIMO_FICHERO = 5_000_000
const ITERACIONES_MAXIMAS = 10_000_000
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

/** El fichero no es de la app, está estropeado, es de una versión que no se sabe leer o es demasiado grande. */
export class FicheroNoValido extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'FicheroNoValido'
  }
}

/** El destino ya tiene datos y no se ha confirmado que se puedan sustituir. */
export class DestinoNoVacio extends Error {
  constructor() {
    super('El destino ya tiene datos')
    this.name = 'DestinoNoVacio'
  }
}

/** El origen no tiene nada que mover. */
export class SinDatos extends Error {
  constructor() {
    super('No hay datos que migrar')
    this.name = 'SinDatos'
  }
}

/** La migración falló. `destinoRestaurado` dice si el destino quedó como estaba; el origen nunca se toca. */
export class MigracionFallida extends Error {
  readonly destinoRestaurado: boolean
  constructor(destinoRestaurado: boolean) {
    super(destinoRestaurado ? 'La migración falló; el destino sigue como estaba' : 'La migración falló y no se pudo comprobar el destino')
    this.name = 'MigracionFallida'
    this.destinoRestaurado = destinoRestaurado
  }
}

/** De dónde salen los datos. Solo se lee de aquí: el origen no se modifica nunca. */
export interface Fuente {
  /** Lanza ContrasenaIncorrecta si la contraseña no abre los datos, SinDatos si no hay nada. */
  leerEstado(contrasena: string): Promise<Estado>
}

/** Una bóveda (Supabase o este navegador): se abre con su contraseña. Si solo quedan datos en claro de versiones antiguas, se toman de ahí. */
export function fuenteDeAlmacen(almacen: AlmacenBoveda): Fuente {
  return {
    async leerEstado(contrasena) {
      const sobre = await almacen.leer()
      if (!sobre) {
        const antiguo = await almacen.leerSinCifrar()
        if (!antiguo) throw new SinDatos()
        return normalizarEstado(antiguo)
      }
      const llave = await abrirLlave(contrasena, sobre)
      return normalizarEstado(await descifrar<Partial<Estado>>(llave, sobre, almacen.usuario))
    },
  }
}

/** Datos que ya están en claro (los de ejemplo): no hay contraseña que comprobar. */
export function fuenteEnClaro(leer: () => Estado): Fuente {
  return { leerEstado: async () => normalizarEstado(leer()) }
}

/**
 * Un fichero exportado con `exportarFichero`. Se valida antes de descifrar nada.
 * `usuarioCopia`: id de quien guardó el sobre, solo para abrir una copia previa (`copiaDeSobre`) de esa misma cuenta.
 */
export function fuenteDeFichero(texto: string, usuarioCopia?: string): Fuente {
  const sobre = leerFichero(texto)
  return {
    async leerEstado(contrasena) {
      const llave = await abrirLlave(contrasena, sobre)
      // Los ficheros exportados se cifran sin usuario: valen para cualquier destino
      try {
        return validarEstado(await descifrar<unknown>(llave, sobre))
      } catch (e) {
        if (!(e instanceof ContrasenaIncorrecta) || !usuarioCopia) throw e
        return validarEstado(await descifrar<unknown>(llave, sobre, usuarioCopia))
      }
    },
  }
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function cadenaBase64(v: unknown, maximo: number): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= maximo && v.length % 4 === 0 && BASE64.test(v)
}

/** Fichero → sobre limpio (solo los campos conocidos). Lanza FicheroNoValido. */
export function leerFichero(texto: string): Sobre {
  if (typeof texto !== 'string' || texto.length > TAMANO_MAXIMO_FICHERO) throw new FicheroNoValido('El fichero es demasiado grande.')
  let datos: unknown
  try {
    datos = JSON.parse(texto)
  } catch {
    throw new FicheroNoValido('El fichero no es válido: no se puede leer.')
  }
  if (!esObjeto(datos) || datos.formato !== FORMATO_FICHERO) throw new FicheroNoValido('El fichero no es una copia de esta app.')
  if (datos.version !== VERSION_FICHERO) throw new FicheroNoValido('Este fichero es de una versión que esta app no sabe leer.')
  const s = datos.sobre
  if (!esObjeto(s)) throw new FicheroNoValido('El fichero está incompleto.')
  const { version, sal, iteraciones, iv, cifrado } = s
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > 6) throw new FicheroNoValido('El fichero usa una versión de cifrado desconocida.')
  if (typeof iteraciones !== 'number' || !Number.isInteger(iteraciones) || iteraciones < 1 || iteraciones > ITERACIONES_MAXIMAS) throw new FicheroNoValido('El fichero tiene parámetros de cifrado fuera de rango.')
  if (!cadenaBase64(sal, 64) || !cadenaBase64(iv, 64) || !cadenaBase64(cifrado, TAMANO_MAXIMO_FICHERO)) throw new FicheroNoValido('El fichero está estropeado.')
  return { version: version as Sobre['version'], sal, iteraciones, iv, cifrado }
}

/** Comprueba la forma de lo descifrado y se queda solo con los campos conocidos. Lanza FicheroNoValido. */
export function validarEstado(valor: unknown): Estado {
  if (!esObjeto(valor)) throw new FicheroNoValido('Los datos del fichero están estropeados.')
  for (const lista of ['movimientos', 'notas', 'partidas', 'deudas', 'pagos', 'cobros'] as const) {
    if (valor[lista] !== undefined && !Array.isArray(valor[lista])) throw new FicheroNoValido('Los datos del fichero están estropeados.')
  }
  for (const mapa of ['recibos', 'meses', 'ajustes', 'patrimonio'] as const) {
    if (valor[mapa] !== undefined && !esObjeto(valor[mapa])) throw new FicheroNoValido('Los datos del fichero están estropeados.')
  }
  const ajustes = valor.ajustes as Record<string, unknown> | undefined
  if (ajustes && (typeof ajustes.diaInicio !== 'number' || !Array.isArray(ajustes.cuentas))) throw new FicheroNoValido('Los ajustes del fichero están estropeados.')
  return normalizarEstado(valor as Partial<Estado>)
}

/**
 * Fichero portable con los datos cifrados con `contrasena` (sin usuario: se puede importar en cualquier destino).
 * Solo lleva el sobre cifrado: ni la contraseña ni configuración ni claves.
 */
export async function exportarFichero(estado: Estado, contrasena: string, iteraciones = ITERACIONES): Promise<string> {
  const sobre = await cifrar(await crearLlave(contrasena, iteraciones), estado)
  return JSON.stringify({ formato: FORMATO_FICHERO, version: VERSION_FICHERO, sobre })
}

/** Texto del fichero con una copia del sobre que ya hay en un almacén (ya está cifrado y ligado a su usuario: no se descifra). */
export function copiaDeSobre(sobre: Sobre): string {
  return JSON.stringify({ formato: FORMATO_FICHERO, version: VERSION_FICHERO, copia: true, sobre })
}

export interface OpcionesMigracion {
  fuente: Fuente
  destino: AlmacenBoveda
  contrasena: string
  /**
   * Hace falta si el destino ya tiene datos: confirmar que se sustituyen. Sin ello, lanza DestinoNoVacio y no toca nada.
   * Con ello, `copiaPrevia` recibe el sobre actual del destino y tiene que dejarlo guardado (por ejemplo, descargarlo); si lanza, se aborta.
   */
  sobrescribir?: boolean
  copiaPrevia?: (sobreActual: Sobre) => void | Promise<void>
  iteraciones?: number
}

/**
 * Copia los datos de `fuente` en `destino`, cifrados con `contrasena` para el usuario del destino.
 * El origen solo se lee. Después de escribir se vuelve a leer el destino y se comprueba que se abre y coincide:
 * si algo falla, se intenta dejar el destino como estaba y se avisa con MigracionFallida.
 */
export async function migrar({ fuente, destino, contrasena, sobrescribir = false, copiaPrevia, iteraciones }: OpcionesMigracion): Promise<void> {
  const estado = await fuente.leerEstado(contrasena)
  const previo = await destino.leer()
  if (previo) {
    if (!sobrescribir) throw new DestinoNoVacio()
    if (!copiaPrevia) throw new Error('Para sustituir los datos del destino hace falta una copia previa')
    await copiaPrevia(previo)
  }

  // crearBoveda cifra lo que devuelve leerSinCifrar: aquí, los datos que vienen del origen. Nada se borra del origen ni del destino en claro
  const entrante: AlmacenBoveda = {
    usuario: destino.usuario,
    leer: () => destino.leer(),
    escribir: (s) => destino.escribir(s),
    leerSinCifrar: async () => estado,
    borrarSinCifrar: async () => {},
  }
  try {
    await crearBoveda(entrante, contrasena, iteraciones)
    const escrito = await destino.leer()
    if (!escrito) throw new Error('El destino no guardó los datos')
    const copia = await descifrar<Partial<Estado>>(await abrirLlave(contrasena, escrito), escrito, destino.usuario)
    if (JSON.stringify(normalizarEstado(copia)) !== JSON.stringify(normalizarEstado(estado))) throw new Error('Lo guardado no coincide con el origen')
  } catch {
    let restaurado: boolean
    try {
      // Sin datos previos no hay nada que restaurar; con ellos, se vuelve a escribir el sobre anterior
      if (previo) {
        await destino.leer()
        await destino.escribir(previo)
      }
      restaurado = !!previo || (await destino.leer()) === null
    } catch {
      restaurado = false
    }
    throw new MigracionFallida(restaurado)
  }
}

/** Mensaje para la persona. Nunca incluye datos ni contraseñas. */
export function explicarError(e: unknown): string {
  if (e instanceof ContrasenaIncorrecta) return 'La contraseña no es correcta.'
  if (e instanceof FicheroNoValido) return e.message
  if (e instanceof DestinoNoVacio) return 'El destino ya tiene datos. Confirma que quieres sustituirlos.'
  if (e instanceof SinDatos) return 'No hay datos que copiar.'
  if (e instanceof MigracionFallida) {
    return e.destinoRestaurado
      ? 'No se pudo completar. Tus datos siguen como estaban; inténtalo de nuevo.'
      : 'No se pudo completar y no se pudo comprobar el destino. Tus datos de origen no se han tocado: revisa el destino antes de seguir.'
  }
  return 'No se pudo completar. No se ha cambiado nada; revisa tu conexión e inténtalo de nuevo.'
}
