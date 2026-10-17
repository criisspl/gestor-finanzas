import { describe, expect, it } from 'vitest'
import { calcularReglas, resumirMes } from './reglas'
import type { Movimiento, Patrimonio } from './tipos'

const movimientos: Movimiento[] = [
  { id: '1', tipo: 'ingreso', nombre: 'Nómina', importe: 1250 },
  { id: '2', tipo: 'fijo', nombre: 'Alquiler', importe: 450, categoria: 'alquiler' },
  { id: '3', tipo: 'fijo', nombre: 'Luz', importe: 60, categoria: 'esencial' },
  { id: '4', tipo: 'gasto', nombre: 'Cena', importe: 80, categoria: 'ocio', fecha: '2026-10-05' },
  { id: '5', tipo: 'gasto', nombre: 'Fondo indexado', importe: 100, categoria: 'inversion', fecha: '2026-10-01' },
  { id: '6', tipo: 'gasto', nombre: 'Del mes pasado', importe: 999, categoria: 'ocio', fecha: '2026-09-30' },
]
const patrimonio: Patrimonio = { fondoEmergencia: 1500, totalInvertido: 4000, actualizado: null }
const regla = (id: string) => calcularReglas(resumirMes(movimientos, '2026-10'), patrimonio).find((r) => r.id === id)!

describe('resumirMes', () => {
  it('cuenta los fijos cada mes y los variables solo en su mes', () => {
    const r = resumirMes(movimientos, '2026-10')
    expect(r.ingreso).toBe(1250)
    expect(r.porCategoria.ocio).toBe(80)
    expect(r.esenciales).toBe(510)
    expect(r.gastado).toBe(590)
    expect(r.invertido).toBe(100)
    expect(r.queda).toBe(560)
  })

  it('en un mes sin variables solo quedan los fijos', () => {
    const r = resumirMes(movimientos, '2026-11')
    expect(r.gastado).toBe(510)
    expect(r.invertido).toBe(0)
  })

  it('redondea a céntimos sin errores de coma flotante', () => {
    const r = resumirMes(
      [
        { id: 'a', tipo: 'ingreso', nombre: 'x', importe: 0.1 },
        { id: 'b', tipo: 'ingreso', nombre: 'y', importe: 0.2 },
      ],
      '2026-10',
    )
    expect(r.ingreso).toBe(0.3)
  })
})

describe('calcularReglas (ejemplo del reel: ingreso de 1.250 €)', () => {
  it('objetivo de libertad = ingreso × 300', () => {
    expect(regla('libertad').objetivo).toBe(375000)
  })

  it('esenciales = 50 %, ocio = 5 %, alquiler = 35 %, inversión = 20 %', () => {
    expect(regla('esenciales').objetivo).toBe(625)
    expect(regla('ocio').objetivo).toBe(62.5)
    expect(regla('alquiler').objetivo).toBe(437.5)
    expect(regla('inversion').objetivo).toBe(250)
  })

  it('fondo de emergencia = 3 meses de esenciales', () => {
    expect(regla('fondo').objetivo).toBe(1530)
    expect(regla('fondo').estado).toBe('En marcha')
  })

  it('marca "al límite" hasta un 10 % por encima y "te pasas" más allá', () => {
    expect(regla('esenciales').nivel).toBe('ok')
    expect(regla('alquiler').nivel).toBe('aviso') // 450 sobre 437,50
    expect(regla('ocio').nivel).toBe('mal') // 80 sobre 62,50
  })

  it('la inversión parcial cuenta como "empezando"', () => {
    expect(regla('inversion').estado).toBe('Empezando')
  })

  it('sin ingresos no divide entre cero', () => {
    const reglas = calcularReglas(resumirMes([], '2026-10'), patrimonio)
    for (const r of reglas) expect(Number.isFinite(r.progreso)).toBe(true)
  })
})
