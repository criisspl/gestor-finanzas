// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BotonBorrar } from './BotonBorrar.tsx'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('BotonBorrar', () => {
  it('el primer toque arma el botón y no borra; el segundo borra', () => {
    const onBorrar = vi.fn()
    render(<BotonBorrar nombre="Mercadona" onBorrar={onBorrar} />)

    fireEvent.click(screen.getByRole('button', { name: 'Borrar Mercadona' }))
    expect(onBorrar).not.toHaveBeenCalled()
    const armado = screen.getByRole('button', { name: '¿Seguro? Pulsa de nuevo para borrar Mercadona' })
    expect(screen.getByRole('status').textContent).toBe('¿Seguro que quieres borrar Mercadona? Pulsa de nuevo para confirmar.')

    fireEvent.click(armado)
    expect(onBorrar).toHaveBeenCalledTimes(1)
    // Tras borrar vuelve a su estado normal y el aviso se vacía
    expect(screen.getByRole('button', { name: 'Borrar Mercadona' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('doble pulsación seguida borra una sola vez', () => {
    const onBorrar = vi.fn()
    render(<BotonBorrar onBorrar={onBorrar} />)
    const boton = screen.getByRole('button', { name: 'Borrar' })

    fireEvent.click(boton)
    fireEvent.click(boton)
    expect(onBorrar).toHaveBeenCalledTimes(1)
    // Un tercer toque vuelve a pedir confirmación, no borra otra vez
    fireEvent.click(boton)
    expect(onBorrar).toHaveBeenCalledTimes(1)
  })

  it('se desarma solo a los 4 s', () => {
    vi.useFakeTimers()
    const onBorrar = vi.fn()
    render(<BotonBorrar onBorrar={onBorrar} />)

    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(screen.getByRole('button', { name: /¿Seguro\?/ })).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('')
    expect(onBorrar).not.toHaveBeenCalled()
  })
})
