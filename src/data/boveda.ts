import { abrirLlave, cifrar, crearLlave, descifrar, ITERACIONES, type Llave, type Sobre } from './cifrado'
import { ESTADO_VACIO, normalizarEstado, repositorioEnMemoria, type Estado } from './memoria'
import type { Repositorio } from './repositorio'

/** Dónde vive el sobre cifrado de una persona. En producción es una fila de Supabase. */
export interface AlmacenBoveda {
  leer(): Promise<Sobre | null>
  escribir(sobre: Sobre): Promise<void>
  /** Datos guardados en claro por versiones anteriores de la app, si quedan. */
  leerSinCifrar(): Promise<Estado | null>
  borrarSinCifrar(): Promise<void>
}

function repositorioCifrado(almacen: AlmacenBoveda, llave: Llave, estado: Estado): Repositorio {
  return repositorioEnMemoria(estado, async (e) => almacen.escribir(await cifrar(llave, e)))
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
  await almacen.escribir(await cifrar(llave, estado))
  await limpiarSinCifrar(almacen)
  return repositorioCifrado(almacen, llave, estado)
}

/** Lanza ContrasenaIncorrecta si la contraseña no abre el sobre. */
export async function abrirBoveda(almacen: AlmacenBoveda, sobre: Sobre, contrasena: string): Promise<Repositorio> {
  const llave = await abrirLlave(contrasena, sobre)
  // Los sobres anteriores a la versión 4 no tienen notas, partidas, recibos, ajustes ni meses: se completan al abrir
  const estado = normalizarEstado(await descifrar<Partial<Estado>>(llave, sobre))
  await limpiarSinCifrar(almacen)
  return repositorioCifrado(almacen, llave, estado)
}
