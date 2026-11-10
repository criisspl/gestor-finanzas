import { abrirLlave, cifrar, crearLlave, descifrar, ITERACIONES, type Llave, type Sobre } from './cifrado'
import { ESTADO_VACIO, normalizarEstado, repositorioEnMemoria, type Estado } from './memoria'
import type { Repositorio } from './repositorio'

/** Otro dispositivo o pestaña guardó la bóveda después de que esta la leyera. */
export class ConflictoBoveda extends Error {
  constructor() {
    super('Hay cambios guardados desde otro dispositivo')
    this.name = 'ConflictoBoveda'
  }
}

/** Dónde vive el sobre cifrado de una persona. En producción es una fila de Supabase. */
export interface AlmacenBoveda {
  leer(): Promise<Sobre | null>
  escribir(sobre: Sobre): Promise<void>
  /** Datos guardados en claro por versiones anteriores de la app, si quedan. */
  leerSinCifrar(): Promise<Estado | null>
  borrarSinCifrar(): Promise<void>
  /** Id de la persona dueña de la bóveda, si el almacén lo conoce. Se autentica junto al sobre (AAD). */
  readonly usuario?: string
}

/** Longitud mínima de la contraseña de la bóveda. */
export const CONTRASENA_MINIMA = 8

/**
 * `sobre` es el último que se sabe guardado en el almacén: con él se comprueba la contraseña actual al cambiarla.
 * La llave nueva solo sustituye a la vieja cuando el almacén ha aceptado el sobre nuevo.
 */
function repositorioCifrado(almacen: AlmacenBoveda, llaveInicial: Llave, estado: Estado, sobreInicial: Sobre): Repositorio {
  let llave = llaveInicial
  let sobre = sobreInicial

  async function cambiarContrasena(e: Estado, actual: string, nueva: string) {
    // Descifra con la actual: lanza ContrasenaIncorrecta si no vale
    await descifrar(await abrirLlave(actual, sobre), sobre, almacen.usuario)
    const llaveNueva = await crearLlave(nueva, Math.max(llave.iteraciones, ITERACIONES))
    const sobreNuevo = await cifrar(llaveNueva, e, almacen.usuario)
    // Si falla o hay conflicto, lanza y no cambia nada: la contraseña vieja sigue valiendo
    await almacen.escribir(sobreNuevo)
    llave = llaveNueva
    sobre = sobreNuevo
  }

  return repositorioEnMemoria(
    estado,
    async (e) => {
      const nuevo = await cifrar(llave, e, almacen.usuario)
      await almacen.escribir(nuevo)
      sobre = nuevo
    },
    cambiarContrasena,
  )
}

/** Los datos en claro se borran después de tener la copia cifrada. Si falla, se reintenta al abrir. */
async function limpiarSinCifrar(almacen: AlmacenBoveda) {
  try {
    await almacen.borrarSinCifrar()
  } catch {
    // no impide usar la app: quedan como estaban y se vuelve a intentar la próxima vez
  }
}

/** Primera vez: elige contraseña, cifra lo que hubiera en claro y lo sube cifrado. */
export async function crearBoveda(almacen: AlmacenBoveda, contrasena: string, iteraciones = ITERACIONES): Promise<Repositorio> {
  const llave = await crearLlave(contrasena, iteraciones)
  const estado = (await almacen.leerSinCifrar()) ?? ESTADO_VACIO
  const sobre = await cifrar(llave, estado, almacen.usuario)
  await almacen.escribir(sobre)
  await limpiarSinCifrar(almacen)
  return repositorioCifrado(almacen, llave, estado, sobre)
}

/** Lanza ContrasenaIncorrecta si la contraseña no abre el sobre. */
export async function abrirBoveda(almacen: AlmacenBoveda, sobre: Sobre, contrasena: string): Promise<Repositorio> {
  const llave = await abrirLlave(contrasena, sobre)
  // Los sobres anteriores a la versión 5 no tienen notas, partidas, recibos, ajustes, meses, deudas ni cobros: se completan al abrir
  const estado = normalizarEstado(await descifrar<Partial<Estado>>(llave, sobre, almacen.usuario))
  await limpiarSinCifrar(almacen)
  return repositorioCifrado(almacen, llave, estado, sobre)
}
