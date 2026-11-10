import { describe, expect, it } from 'vitest'
import { cobrosPendientes, estaSaldada, pagadoDe, pagosDe, restanteDe, totalCobros, totalesDeudas } from './deudas.ts'
import type { Cobro, Deuda, PagoDeuda } from './tipos.ts'

const deuda = (d: Partial<Deuda> & Pick<Deuda, 'id'>): Deuda => ({ nombre: d.id, detalle: null, importe: 100, estado: null, estadoTexto: null, ...d })
const pago = (deuda: string, importe: number, fecha = '2026-11-05'): PagoDeuda => ({ id: `${deuda}${importe}${fecha}`, deuda, importe, fecha, gasto: null })
const cobro = (c: Partial<Cobro> & Pick<Cobro, 'id'>): Cobro => ({ mes: '2026-11', nombre: c.id, detalle: null, importe: 10, cobrado: false, fechaCobro: null, ...c })

describe('pagadoDe y restanteDe', () => {
  it('suma solo los pagos de esa deuda, a céntimos', () => {
    const pagos = [pago('a', 0.1), pago('a', 0.2, '2026-11-06'), pago('b', 50)]
    expect(pagadoDe(deuda({ id: 'a' }), pagos)).toBe(0.3)
    expect(restanteDe(deuda({ id: 'a' }), pagos)).toBe(99.7)
  })
  it('sin pagos queda todo, y nunca queda en negativo', () => {
    expect(restanteDe(deuda({ id: 'a' }), [])).toBe(100)
    expect(restanteDe(deuda({ id: 'a', importe: 20 }), [pago('a', 30)])).toBe(0)
  })
  it('se salda cuando no queda nada', () => {
    expect(estaSaldada(deuda({ id: 'a' }), [pago('a', 60)])).toBe(false)
    expect(estaSaldada(deuda({ id: 'a' }), [pago('a', 60), pago('a', 40, '2026-11-07')])).toBe(true)
  })
})

describe('pagosDe', () => {
  it('ordena del más reciente al más antiguo', () => {
    const pagos = [pago('a', 1, '2026-11-01'), pago('a', 2, '2026-11-09'), pago('b', 3, '2026-11-10')]
    expect(pagosDe(deuda({ id: 'a' }), pagos).map((p) => p.importe)).toEqual([2, 1])
  })
})

describe('totalesDeudas', () => {
  it('vencido cuenta solo las rojas por lo que queda; pendiente, todas', () => {
    const deudas = [
      deuda({ id: 'a', importe: 100, estado: 'mal' }),
      deuda({ id: 'b', importe: 50, estado: 'aviso' }),
      deuda({ id: 'c', importe: 30, estado: null }),
      deuda({ id: 'd', importe: 20, estado: 'mal' }),
    ]
    const pagos = [pago('a', 40), pago('d', 20), pago('b', 10)]
    expect(totalesDeudas(deudas, pagos)).toEqual({ vencido: 60, pendiente: 130 })
  })
  it('sin deudas todo es 0', () => {
    expect(totalesDeudas([], [])).toEqual({ vencido: 0, pendiente: 0 })
  })
})

describe('cobros', () => {
  it('los pendientes son los del mes sin cobrar', () => {
    const cobros = [cobro({ id: 'a' }), cobro({ id: 'b', cobrado: true }), cobro({ id: 'c', mes: '2026-12' })]
    expect(cobrosPendientes(cobros, '2026-11').map((c) => c.id)).toEqual(['a'])
  })
  it('suma a céntimos', () => {
    expect(totalCobros([cobro({ id: 'a', importe: 0.1 }), cobro({ id: 'b', importe: 0.2 })])).toBe(0.3)
  })
})
