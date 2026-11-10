import { describe, expect, it } from 'vitest'
import { diasDesdeInicio, fechaEnMes, inicioDe, mesDeFecha } from './ciclo.ts'

describe('ciclo de nómina', () => {
  it('el mes se llama como el mes en que termina', () => {
    expect(inicioDe('2026-11', 27)).toBe('2026-10-27')
    expect(inicioDe('2026-01', 27)).toBe('2025-12-27')
    expect(inicioDe('2026-11', 1)).toBe('2026-11-01')
  })

  it('asigna cada fecha a su mes de nómina', () => {
    expect(mesDeFecha('2026-10-26', 27)).toBe('2026-10')
    expect(mesDeFecha('2026-10-27', 27)).toBe('2026-11')
    expect(mesDeFecha('2026-12-31', 27)).toBe('2027-01')
    expect(mesDeFecha('2026-10-31', 1)).toBe('2026-10')
  })

  it('fechaEnMes comprueba la pertenencia', () => {
    expect(fechaEnMes('2026-11-26', '2026-11', 27)).toBe(true)
    expect(fechaEnMes('2026-11-27', '2026-11', 27)).toBe(false)
  })

  it('cuenta los días desde el inicio', () => {
    expect(diasDesdeInicio('2026-11', 27, '2026-10-27')).toBe(0)
    expect(diasDesdeInicio('2026-11', 27, '2026-10-30')).toBe(3)
    expect(diasDesdeInicio('2026-11', 27, '2026-10-20')).toBe(-7)
  })
})
