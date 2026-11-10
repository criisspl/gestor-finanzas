import { describe, expect, it } from 'vitest'
import { aplicarCierre, arrastre, ajustarSaldo, copiarPartidas, planTraspasos, sobranteDe, type DatosCiclo } from './cierre.ts'
import { DATOS_MES_VACIO, type Cuenta, type GastoVariable, type Partida } from './tipos.ts'

const partida = (p: Partial<Partida> & Pick<Partida, 'id' | 'mes'>): Partida => ({
  nombre: p.id, detalle: null, importe: 100, variable: false, orden: 1, ...p,
})
const gasto = (importe: number, partida: string, fecha: string): GastoVariable => ({
  id: `g${fecha}${importe}`, tipo: 'gasto', nombre: 'x', importe, categoria: 'esencial', fecha, partida,
})
const cuentas: Cuenta[] = [{ id: 'n', nombre: 'Cuenta nómina' }, { id: 'g', nombre: 'Cuenta gastos' }]

const base = (extra: Partial<DatosCiclo> = {}): DatosCiclo => ({
  diaInicio: 27,
  partidas: [partida({ id: 'a', mes: '2026-10', importe: 100 }), partida({ id: 'b', mes: '2026-11', importe: 100 })],
  gastos: [],
  meses: {},
  ingresoBase: 1000,
  hoy: '2026-11-01',
  ...extra,
})

describe('arrastre y sobrante', () => {
  it('el sobrante es nómina más arrastre menos lo consumido', () => {
    expect(sobranteDe('2026-10', base())).toBe(900)
  })

  it('el mes siguiente arrastra el sobrante una vez empezado', () => {
    expect(arrastre('2026-11', base())).toBe(900)
    expect(arrastre('2026-11', base({ hoy: '2026-10-20' }))).toBe(0)
  })

  it('el arrastre real apuntado manda sobre el calculado', () => {
    const d = base({ meses: { '2026-11': { ...DATOS_MES_VACIO, arrastreReal: 50 } } })
    expect(arrastre('2026-11', d)).toBe(50)
    expect(sobranteDe('2026-11', d)).toBe(950)
  })

  it('usa la nómina real del mes si se apuntó', () => {
    const d = base({ meses: { '2026-10': { ...DATOS_MES_VACIO, nomina: 1200 } } })
    expect(sobranteDe('2026-10', d)).toBe(1100)
  })

  it('una partida variable cuenta lo gastado dentro de su ciclo', () => {
    const d = base({
      partidas: [partida({ id: 'v', mes: '2026-11', variable: true })],
      gastos: [gasto(30, 'v', '2026-10-28'), gasto(20, 'v', '2026-11-26'), gasto(10, 'v', '2026-11-27')],
    })
    expect(sobranteDe('2026-11', d)).toBe(950)
  })
})

describe('copiarPartidas', () => {
  it('copia con id nuevo y no pisa un mes que ya tiene partidas', () => {
    let n = 0
    const ps = [partida({ id: 'a', mes: '2026-10' })]
    const copia = copiarPartidas(ps, '2026-10', '2026-11', () => `nuevo${++n}`)
    expect(copia).toEqual([{ ...ps[0], id: 'nuevo1', mes: '2026-11' }])
    expect(copiarPartidas([...ps, ...copia], '2026-10', '2026-11', () => 'otro')).toEqual([])
  })
})

describe('ajustarSaldo', () => {
  it('suma al saldo ya apuntado y redondea', () => {
    const meses = { '2026-11': { ...DATOS_MES_VACIO, saldos: { n: 10.1 } } }
    expect(ajustarSaldo(meses, '2026-11', 'n', 0.2)['2026-11'].saldos.n).toBe(10.3)
  })

  it('si no hay saldo apuntado no inventa uno', () => {
    expect(ajustarSaldo({}, '2026-11', 'n', 5)).toEqual({})
  })
})

describe('aplicarCierre', () => {
  it('rellena solo lo que se indica', () => {
    const actual = { ...DATOS_MES_VACIO, saldos: { n: 1, g: 2 } }
    expect(aplicarCierre(actual, { saldos: { g: 9 } })).toEqual({ ...actual, saldos: { n: 1, g: 9 } })
    expect(aplicarCierre(actual, { nomina: 1500, sobrante: 40, saldos: {} })).toEqual({
      nomina: 1500, nominaRecibida: true, arrastreReal: 40, saldos: { n: 1, g: 2 },
    })
  })
})

describe('planTraspasos', () => {
  const ps = [
    partida({ id: 'a', mes: '2026-11', importe: 300, cuenta: 'g' }),
    partida({ id: 'b', mes: '2026-11', importe: 200, cuenta: 'n' }),
    partida({ id: 'c', mes: '2026-11', importe: 50, cuenta: 'borrada' }),
  ]

  it('transfiere a cada cuenta y el resto se queda en la de nómina', () => {
    const plan = planTraspasos(cuentas, ps, 1000, 100)
    expect(plan?.disponible).toBe(1100)
    expect(plan?.transferir).toHaveLength(1)
    expect(plan?.transferir[0].total).toBe(300)
    expect(plan?.seQueda.total).toBe(800)
    expect(plan?.seQueda.partidas.map((p) => p.id)).toEqual(['b', 'c'])
    expect(plan?.sinAsignar).toBe(550)
  })

  it('avisa con sinAsignar negativo si las partidas superan la nómina', () => {
    expect(planTraspasos(cuentas, ps, 400, 0)?.sinAsignar).toBe(-150)
  })

  it('sin cuentas no hay plan', () => {
    expect(planTraspasos([], ps, 1000, 0)).toBeNull()
  })
})
