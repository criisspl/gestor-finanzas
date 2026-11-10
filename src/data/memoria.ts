import type { Movimiento, Nota, Patrimonio } from '../domain/tipos'
import { PATRIMONIO_VACIO, type Repositorio } from './repositorio'

/** Todos los datos de una persona. Es lo que se guarda en el navegador (demo) o cifrado en Supabase. */
export interface Estado {
  movimientos: Movimiento[]
  notas: Nota[]
  patrimonio: Patrimonio
}

export const ESTADO_VACIO: Estado = { movimientos: [], notas: [], patrimonio: PATRIMONIO_VACIO }

/** Completa lo que falte en datos guardados por versiones anteriores (sin notas, por ejemplo). */
export function normalizarEstado(e: Partial<Estado>): Estado {
  return { movimientos: e.movimientos ?? [], notas: e.notas ?? [], patrimonio: e.patrimonio ?? PATRIMONIO_VACIO }
}

/**
 * Repositorio que trabaja sobre el estado en memoria y llama a `persistir` con el estado completo
 * en cada cambio. El estado solo cambia si `persistir` termina bien, y los cambios van en cola
 * para que dos guardados seguidos no se pisen.
 */
export function repositorioEnMemoria(inicial: Estado, persistir: (e: Estado) => Promise<void>): Repositorio {
  let estado = normalizarEstado(inicial)
  let cola: Promise<unknown> = Promise.resolve()

  function cambiar<T>(paso: (e: Estado) => [Estado, T]): Promise<T> {
    const hecho = cola.then(async () => {
      const [nuevo, resultado] = paso(estado)
      await persistir(nuevo)
      estado = nuevo
      return resultado
    })
    cola = hecho.catch(() => undefined)
    return hecho
  }

  return {
    async listarMovimientos() {
      return estado.movimientos
    },
    crearMovimiento(m) {
      const nuevo = { ...m, id: crypto.randomUUID() } as Movimiento
      return cambiar((e) => [{ ...e, movimientos: [...e.movimientos, nuevo] }, nuevo])
    },
    actualizarMovimiento(m) {
      return cambiar((e) => [{ ...e, movimientos: e.movimientos.map((x) => (x.id === m.id ? m : x)) }, undefined])
    },
    borrarMovimiento(id) {
      return cambiar((e) => [{ ...e, movimientos: e.movimientos.filter((x) => x.id !== id) }, undefined])
    },
    async listarNotas() {
      return estado.notas
    },
    crearNota(n) {
      const nueva: Nota = { ...n, id: crypto.randomUUID() }
      return cambiar((e) => [{ ...e, notas: [...e.notas, nueva] }, nueva])
    },
    actualizarNota(n) {
      return cambiar((e) => [{ ...e, notas: e.notas.map((x) => (x.id === n.id ? n : x)) }, undefined])
    },
    borrarNota(id) {
      return cambiar((e) => [{ ...e, notas: e.notas.filter((x) => x.id !== id) }, undefined])
    },
    async leerPatrimonio() {
      return estado.patrimonio ?? PATRIMONIO_VACIO
    },
    guardarPatrimonio(p) {
      const patrimonio = { ...p, actualizado: new Date().toISOString() }
      return cambiar((e) => [{ ...e, patrimonio }, patrimonio])
    },
  }
}
