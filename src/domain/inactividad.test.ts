import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { vigilarInactividad } from './inactividad.ts'

const MIN = 60_000

function entorno() {
  const ventana = new EventTarget()
  const documento = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  const alBloquear = vi.fn()
  const parar = vigilarInactividad({ ms: 10 * MIN, alBloquear, ventana, documento })
  return { ventana, documento, alBloquear, parar }
}

describe('vigilarInactividad', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('bloquea al pasar el tiempo sin actividad', () => {
    const { alBloquear } = entorno()
    vi.advanceTimersByTime(10 * MIN - 1)
    expect(alBloquear).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(alBloquear).toHaveBeenCalledTimes(1)
  })

  it('la actividad aplaza el bloqueo', () => {
    const { ventana, alBloquear } = entorno()
    vi.advanceTimersByTime(9 * MIN)
    ventana.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(9 * MIN)
    expect(alBloquear).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1 * MIN)
    expect(alBloquear).toHaveBeenCalledTimes(1)
  })

  it('bloquea al volver a la pestaña pasado el tiempo', () => {
    const { documento, alBloquear } = entorno()
    documento.visibilityState = 'hidden'
    documento.dispatchEvent(new Event('visibilitychange'))
    // Simula un temporizador congelado: se avanza la hora sin disparar timers
    vi.setSystemTime(Date.now() + 11 * MIN)
    documento.visibilityState = 'visible'
    documento.dispatchEvent(new Event('visibilitychange'))
    expect(alBloquear).toHaveBeenCalledTimes(1)
  })

  it('no bloquea al volver a la pestaña antes de tiempo', () => {
    const { documento, alBloquear } = entorno()
    vi.setSystemTime(Date.now() + 5 * MIN)
    documento.dispatchEvent(new Event('visibilitychange'))
    expect(alBloquear).not.toHaveBeenCalled()
  })

  it('bloquea una sola vez', () => {
    const { documento, alBloquear } = entorno()
    vi.advanceTimersByTime(20 * MIN)
    documento.dispatchEvent(new Event('visibilitychange'))
    expect(alBloquear).toHaveBeenCalledTimes(1)
  })

  it('al parar no bloquea ni escucha', () => {
    const { ventana, alBloquear, parar } = entorno()
    parar()
    vi.advanceTimersByTime(30 * MIN)
    ventana.dispatchEvent(new Event('keydown'))
    expect(alBloquear).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
