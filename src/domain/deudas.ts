import { redondear } from './reglas.ts'
import type { Cobro, Deuda, PagoDeuda } from './tipos.ts'

/** Lo ya pagado de una deuda, a céntimos. */
export const pagadoDe = (deuda: Pick<Deuda, 'id'>, pagos: PagoDeuda[]): number =>
  redondear(pagos.filter((p) => p.deuda === deuda.id).reduce((a, p) => a + p.importe, 0))

/** Lo que queda por pagar de una deuda (nunca negativo). */
export const restanteDe = (deuda: Pick<Deuda, 'id' | 'importe'>, pagos: PagoDeuda[]): number =>
  Math.max(0, redondear(deuda.importe - pagadoDe(deuda, pagos)))

export const estaSaldada = (deuda: Pick<Deuda, 'id' | 'importe'>, pagos: PagoDeuda[]): boolean => restanteDe(deuda, pagos) === 0

/** Pagos de una deuda, del más reciente al más antiguo. */
export const pagosDe = (deuda: Pick<Deuda, 'id'>, pagos: PagoDeuda[]): PagoDeuda[] =>
  pagos.filter((p) => p.deuda === deuda.id).sort((a, b) => b.fecha.localeCompare(a.fecha))

export interface TotalesDeudas {
  /** Lo que queda de las deudas en rojo. */
  vencido: number
  /** Lo que queda de todas las deudas. */
  pendiente: number
}

export function totalesDeudas(deudas: Deuda[], pagos: PagoDeuda[]): TotalesDeudas {
  const suma = (ds: Deuda[]) => redondear(ds.reduce((a, d) => a + restanteDe(d, pagos), 0))
  return { vencido: suma(deudas.filter((d) => d.estado === 'mal')), pendiente: suma(deudas) }
}

/** Cobros de un mes sin marcar como cobrados. */
export const cobrosPendientes = (cobros: Cobro[], mes: string): Cobro[] => cobros.filter((c) => c.mes === mes && !c.cobrado)

export const totalCobros = (cobros: Cobro[]): number => redondear(cobros.reduce((a, c) => a + c.importe, 0))
