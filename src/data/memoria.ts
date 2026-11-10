import type { Movimiento, Nota, Partida, Patrimonio, Recibos } from '../domain/tipos'
import { marcarRecibo as marcarReciboPuro } from '../domain/partidas.ts'
import { PATRIMONIO_VACIO, type Repositorio } from './repositorio'

/** Todos los datos de una persona. Es lo que se guarda en el navegador (demo) o cifrado en Supabase. */
export interface Estado {
  movimientos: Movimiento[]
  notas: Nota[]
  patrimonio: Patrimonio
  partidas: Partida[]
  recibos: Recibos
}

export const ESTADO_VACIO: Estado = { movimientos: [], notas: [], patrimonio: PATRIMONIO_VACIO, partidas: [], recibos: {} }

/** Completa lo que falte en datos guardados por versiones anteriores (sin notas, partidas o recibos, por ejemplo). */
export function normalizarEstado(e: Partial<Estado>): Estado {
  return {
    movimientos: e.movimientos ?? [],
    notas: e.notas ?? [],
    patrimonio: e.patrimonio ?? PATRIMONIO_VACIO,
    partidas: e.partidas ?? [],
    recibos: e.recibos ?? {},
  }
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
    async listarPartidas() {
      return estado.partidas
    },
    crearPartida(p) {
      const nueva: Partida = { ...p, id: crypto.randomUUID() }
      return cambiar((e) => [{ ...e, partidas: [...e.partidas, nueva] }, nueva])
    },
    actualizarPartida(p) {
      return cambiar((e) => [{ ...e, partidas: e.partidas.map((x) => (x.id === p.id ? p : x)) }, undefined])
    },
    borrarPartida(id) {
      // Los gastos que la usaban se quedan sin partida, no desaparecen
      return cambiar((e) => [
        {
          ...e,
          partidas: e.partidas.filter((x) => x.id !== id),
          movimientos: e.movimientos.map((m) => (m.tipo === 'gasto' && m.partida === id ? { ...m, partida: null } : m)),
        },
        undefined,
      ])
    },
    async listarRecibos() {
      return estado.recibos
    },
    marcarRecibo(mes, id, llegado) {
      return cambiar((e) => [{ ...e, recibos: marcarReciboPuro(e.recibos, mes, id, llegado) }, undefined])
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
