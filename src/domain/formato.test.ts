import { describe, expect, it } from 'vitest'
import { euros, moverMes, parsearImporte } from './formato'

describe('parsearImporte', () => {
  it.each([
    ['1.250', 1250],
    ['1250', 1250],
    ['12,50', 12.5],
    ['1.250,75', 1250.75],
    ['12.5', 12.5],
    ['12,50 €', 12.5],
  ])('"%s" → %d', (texto, esperado) => {
    expect(parsearImporte(texto)).toBe(esperado)
  })

  it.each(['', 'abc', '12,5,0', '-5'])('rechaza "%s"', (texto) => {
    expect(parsearImporte(texto)).toBeNull()
  })
})

describe('moverMes', () => {
  it('cruza el cambio de año', () => {
    expect(moverMes('2026-12', 1)).toBe('2027-01')
    expect(moverMes('2026-01', -1)).toBe('2025-12')
  })
})

describe('euros', () => {
  it('separa los miles también con 4 cifras', () => {
    expect(euros(1250).replace(/\s/g, ' ')).toBe('1.250,00 €')
  })
})
