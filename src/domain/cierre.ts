import { inicioDe } from './ciclo.ts'
import { consumo, gastadoEn } from './partidas.ts'
import { redondear } from './reglas.ts'
import { DATOS_MES_VACIO, type Cuenta, type DatosMes, type GastoVariable, type Meses, type Partida } from './tipos.ts'

/** Todo lo que hace falta para calcular el arrastre entre meses. */
export interface DatosCiclo {
  diaInicio: number
  partidas: Partida[]
  gastos: GastoVariable[]
  meses: Meses
  /** Suma de los ingresos mensuales: la nómina de un mes en el que no se ha apuntado la real. */
  ingresoBase: number
  /** Fecha de hoy (YYYY-MM-DD). */
  hoy: string
}

export const datosMes = (meses: Meses, mes: string): DatosMes => meses[mes] ?? DATOS_MES_VACIO

/** Meses de nómina que existen (con datos o con partidas), del más antiguo al más reciente. */
export const listaMeses = (partidas: Partida[], meses: Meses): string[] =>
  [...new Set([...Object.keys(meses), ...partidas.map((p) => p.mes)])].sort()

export const ingresoDe = (mes: string, d: DatosCiclo): number => datosMes(d.meses, mes).nomina ?? d.ingresoBase

/** Lo que pasa del mes anterior a este: el valor apuntado a mano, o el sobrante calculado una vez empezado el mes. */
export function arrastre(mes: string, d: DatosCiclo): number {
  const real = datosMes(d.meses, mes).arrastreReal
  if (real !== null) return real
  const lista = listaMeses(d.partidas, d.meses)
  const k = lista.indexOf(mes)
  return k > 0 && d.hoy >= inicioDe(mes, d.diaInicio) ? sobranteDe(lista[k - 1], d) : 0
}

/** Nómina más arrastre menos lo que consumen las partidas del mes. Negativo si falta. */
export function sobranteDe(mes: string, d: DatosCiclo): number {
  const consumido = d.partidas
    .filter((p) => p.mes === mes)
    .reduce((a, p) => a + consumo(p, gastadoEn(p, d.gastos, d.diaInicio)), 0)
  return redondear(ingresoDe(mes, d) + arrastre(mes, d) - consumido)
}

/** Copia las partidas de un mes a otro (con id nuevo). No hace nada si el mes de destino ya tiene partidas. */
export function copiarPartidas(partidas: Partida[], desde: string, hasta: string, nuevoId: () => string): Partida[] {
  if (partidas.some((p) => p.mes === hasta)) return []
  return partidas.filter((p) => p.mes === desde).map((p) => ({ ...p, id: nuevoId(), mes: hasta }))
}

/** Suma `delta` al saldo de una cuenta en un mes. Si ese saldo no se ha apuntado, no se inventa: queda igual. */
export function ajustarSaldo(meses: Meses, mes: string, cuenta: string, delta: number): Meses {
  const actual = datosMes(meses, mes)
  const saldo = actual.saldos[cuenta]
  if (saldo === undefined) return meses
  return { ...meses, [mes]: { ...actual, saldos: { ...actual.saldos, [cuenta]: redondear(saldo + delta) } } }
}

/** Lo que se rellena en «Ha llegado la nómina». Lo que falta (undefined) no se toca. */
export interface Cierre {
  nomina?: number
  sobrante?: number
  saldos: Record<string, number>
}

export function aplicarCierre(actual: DatosMes, c: Cierre): DatosMes {
  return {
    ...actual,
    ...(c.nomina !== undefined ? { nomina: c.nomina, nominaRecibida: true } : {}),
    ...(c.sobrante !== undefined ? { arrastreReal: c.sobrante } : {}),
    saldos: { ...actual.saldos, ...c.saldos },
  }
}

/** Cuenta de la partida: la suya si existe, y si no la de nómina (la primera). */
export function cuentaDePartida(p: Pick<Partida, 'cuenta'>, cuentas: Cuenta[]): Cuenta | null {
  return cuentas.find((c) => c.id === p.cuenta) ?? cuentas[0] ?? null
}

export interface Traspaso {
  cuenta: Cuenta
  partidas: Partida[]
  total: number
}

export interface PlanTraspasos {
  /** Nómina más arrastre: lo que entra en la cuenta de nómina. */
  disponible: number
  /** Lo que hay que transferir a cada una de las demás cuentas. */
  transferir: Traspaso[]
  /** Lo que se queda en la cuenta de nómina. */
  seQueda: Traspaso
  /** Disponible menos todas las partidas (negativo si las partidas superan la nómina). */
  sinAsignar: number
}

/** Cómo repartir lo cobrado entre las cuentas. null si todavía no hay cuentas. */
export function planTraspasos(cuentas: Cuenta[], partidas: Partida[], nomina: number, arrastreMes: number): PlanTraspasos | null {
  const [principal, ...otras] = cuentas
  if (!principal) return null
  const total = (ps: Partida[]) => redondear(ps.reduce((a, p) => a + p.importe, 0))
  const de = (c: Cuenta) => partidas.filter((p) => cuentaDePartida(p, cuentas)?.id === c.id)
  const disponible = redondear(nomina + arrastreMes)
  const transferir = otras.map((cuenta) => ({ cuenta, partidas: de(cuenta), total: total(de(cuenta)) }))
  const aOtras = redondear(transferir.reduce((a, t) => a + t.total, 0))
  return {
    disponible,
    transferir,
    seQueda: { cuenta: principal, partidas: de(principal), total: redondear(disponible - aOtras) },
    sinAsignar: redondear(disponible - total(partidas)),
  }
}
