import { redondear } from './reglas.ts'
import type { GastoFijo, GastoVariable, Partida, Recibos } from './tipos.ts'

/** Lo apuntado en una partida: gastos de su mes que llevan su id. */
export function gastadoEn(partida: Partida, gastos: GastoVariable[]): number {
  return redondear(
    gastos.filter((g) => g.partida === partida.id && g.fecha.startsWith(partida.mes)).reduce((a, g) => a + g.importe, 0),
  )
}

/** Lo que cuenta la partida: las variables, lo apuntado; las fijas, el presupuesto entero o lo apuntado si es más. */
export function consumo(partida: Pick<Partida, 'importe' | 'variable'>, gastado: number): number {
  return partida.variable ? gastado : Math.max(partida.importe, gastado)
}

export type NivelPartida = 'ok' | 'aviso' | 'mal'

/** Estado de una partida según lo apuntado: aviso desde el 80 %, mal si se pasa del presupuesto. */
export function nivelPartida(importe: number, gastado: number): NivelPartida {
  if (gastado > importe) return 'mal'
  return importe > 0 && gastado / importe >= 0.8 ? 'aviso' : 'ok'
}

export interface RepartoMes {
  /** Suma de los presupuestos de las partidas. */
  asignado: number
  /** Ingreso menos lo asignado (negativo si asignas de más). */
  sinAsignar: number
  /** Suma de `consumo` de todas las partidas. */
  consumo: number
  /** Ingreso menos consumo: lo que previsiblemente sobrará (o faltará). */
  previsto: number
}

export function repartoMes(partidas: Partida[], gastos: GastoVariable[], ingreso: number): RepartoMes {
  const asignado = redondear(partidas.reduce((a, p) => a + p.importe, 0))
  const gastadoTotal = redondear(partidas.reduce((a, p) => a + consumo(p, gastadoEn(p, gastos)), 0))
  return { asignado, sinAsignar: redondear(ingreso - asignado), consumo: gastadoTotal, previsto: redondear(ingreso - gastadoTotal) }
}

export const ordenarPartidas = (partidas: Partida[]): Partida[] => [...partidas].sort((a, b) => a.orden - b.orden)

export const reciboLlegado = (recibos: Recibos, mes: string, id: string): boolean => (recibos[mes] ?? []).includes(id)

/** Fijos del mes sin marcar como llegados, con su total. */
export function pendientesPago(fijos: GastoFijo[], recibos: Recibos, mes: string): { pendientes: GastoFijo[]; total: number } {
  const pendientes = fijos.filter((f) => !reciboLlegado(recibos, mes, f.id))
  return { pendientes, total: redondear(pendientes.reduce((a, f) => a + f.importe, 0)) }
}

/** Devuelve los recibos con el fijo marcado o desmarcado en ese mes, sin tocar el original. */
export function marcarRecibo(recibos: Recibos, mes: string, id: string, llegado: boolean): Recibos {
  const resto = (recibos[mes] ?? []).filter((x) => x !== id)
  const ids = llegado ? [...resto, id] : resto
  const otros = Object.fromEntries(Object.entries(recibos).filter(([m]) => m !== mes))
  return ids.length ? { ...otros, [mes]: ids } : otros
}
