import { describe, expect, it } from 'vitest'
import { consumo, gastadoEn, marcarRecibo, nivelPartida, pendientesPago, repartoMes } from './partidas.ts'
import type { GastoFijo, GastoVariable, Partida } from './tipos.ts'

const partida = (p: Partial<Partida> & Pick<Partida, 'id'>): Partida => ({
  mes: '2026-11', nombre: p.id, detalle: null, importe: 100, variable: true, orden: 1, ...p,
})
const gasto = (importe: number, partida: string | null, fecha = '2026-11-05'): GastoVariable => ({
  id: `g${importe}${fecha}`, tipo: 'gasto', nombre: null, importe, categoria: 'esencial', fecha, partida,
})

describe('gastadoEn', () => {
  it('suma solo los gastos de la partida y de su mes, a céntimos', () => {
    const p = partida({ id: 'a' })
    const gastos = [gasto(0.1, 'a'), gasto(0.2, 'a'), gasto(50, 'b'), gasto(30, 'a', '2026-10-31'), gasto(9, null)]
    expect(gastadoEn(p, gastos)).toBe(0.3)
  })
  it('los gastos sin campo partida (anteriores) no cuentan en ninguna', () => {
    const viejo: GastoVariable = { id: 'v', tipo: 'gasto', nombre: null, importe: 20, categoria: 'esencial', fecha: '2026-11-05' }
    expect(gastadoEn(partida({ id: 'a' }), [viejo])).toBe(0)
  })
})

describe('consumo', () => {
  it('variable: solo lo apuntado', () => {
    expect(consumo({ importe: 100, variable: true }, 30)).toBe(30)
  })
  it('fija: el presupuesto entero, o lo apuntado si es más', () => {
    expect(consumo({ importe: 100, variable: false }, 0)).toBe(100)
    expect(consumo({ importe: 100, variable: false }, 120)).toBe(120)
  })
})

describe('nivelPartida', () => {
  it('ok por debajo del 80 %, aviso desde el 80 % hasta el 100 %, mal si se pasa', () => {
    expect(nivelPartida(100, 79.99)).toBe('ok')
    expect(nivelPartida(100, 80)).toBe('aviso')
    expect(nivelPartida(100, 100)).toBe('aviso')
    expect(nivelPartida(100, 100.01)).toBe('mal')
  })
  it('presupuesto 0: ok sin gasto, mal con gasto', () => {
    expect(nivelPartida(0, 0)).toBe('ok')
    expect(nivelPartida(0, 1)).toBe('mal')
  })
})

describe('repartoMes', () => {
  const partidas = [
    partida({ id: 'fija', importe: 450, variable: false }),
    partida({ id: 'comida', importe: 250 }),
    partida({ id: 'ocio', importe: 60 }),
  ]
  const gastos = [gasto(64.3, 'comida'), gasto(32, 'ocio')]

  it('calcula sin asignar y previsto', () => {
    const r = repartoMes(partidas, gastos, 1250)
    expect(r.asignado).toBe(760)
    expect(r.sinAsignar).toBe(490)
    expect(r.consumo).toBe(546.3)
    expect(r.previsto).toBe(703.7)
  })
  it('sin asignar y previsto pueden ser negativos', () => {
    const r = repartoMes(partidas, gastos, 700)
    expect(r.sinAsignar).toBe(-60)
    expect(r.previsto).toBe(153.7)
    expect(repartoMes(partidas, gastos, 500).previsto).toBe(-46.3)
  })
})

describe('recibos', () => {
  const fijos: GastoFijo[] = [
    { id: 'f1', tipo: 'fijo', nombre: 'Luz', importe: 40.5, categoria: 'esencial' },
    { id: 'f2', tipo: 'fijo', nombre: 'Internet', importe: 30.2, categoria: 'esencial' },
  ]

  it('marca y desmarca por mes sin tocar el original ni otros meses', () => {
    const base = { '2026-10': ['f1'] }
    const marcado = marcarRecibo(base, '2026-11', 'f1', true)
    expect(marcado).toEqual({ '2026-10': ['f1'], '2026-11': ['f1'] })
    expect(base).toEqual({ '2026-10': ['f1'] })
    expect(marcarRecibo(marcado, '2026-11', 'f1', true)).toEqual(marcado)
    expect(marcarRecibo(marcado, '2026-11', 'f1', false)).toEqual({ '2026-10': ['f1'] })
  })

  it('lo que falta por pagar son los fijos sin marcar ese mes', () => {
    const recibos = { '2026-11': ['f1'], '2026-10': ['f2'] }
    const r = pendientesPago(fijos, recibos, '2026-11')
    expect(r.pendientes.map((f) => f.id)).toEqual(['f2'])
    expect(r.total).toBe(30.2)
    expect(pendientesPago(fijos, {}, '2026-11').total).toBe(70.7)
  })
})
