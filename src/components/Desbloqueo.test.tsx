// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearBoveda, type AlmacenBoveda } from '../data/boveda.ts'
import type { Sobre } from '../data/cifrado.ts'
import { Desbloqueo } from './Desbloqueo.tsx'

afterEach(cleanup)

// Pocas iteraciones para que el test no tarde; el sobre guarda las suyas y se abre con ellas
const IT = 1000

function almacenFalso(sobre: Sobre | null = null): AlmacenBoveda & { sobre: Sobre | null } {
  const a = {
    sobre,
    leer: async () => a.sobre,
    escribir: async (s: Sobre) => {
      a.sobre = s
    },
    leerSinCifrar: async () => null,
    borrarSinCifrar: async () => {},
  }
  return a
}

async function almacenConBoveda(contrasena: string) {
  const almacen = almacenFalso()
  await crearBoveda(almacen, contrasena, IT)
  return almacen
}

describe('Desbloqueo', () => {
  it('con contraseña mala muestra el error y no abre', async () => {
    const almacen = await almacenConBoveda('correcta-123')
    const onAbierto = vi.fn()
    const user = userEvent.setup()
    render(<Desbloqueo almacen={almacen} onAbierto={onAbierto} />)

    await user.type(await screen.findByLabelText('Contraseña'), 'incorrecta-1')
    await user.click(screen.getByRole('button', { name: 'Desbloquear' }))

    expect((await screen.findByRole('alert')).textContent).toBe('La contraseña no es correcta.')
    expect(onAbierto).not.toHaveBeenCalled()
    // El botón vuelve a estar disponible para reintentar
    expect(screen.getByRole('button', { name: 'Desbloquear' })).toHaveProperty('disabled', false)
  })

  it('con la contraseña buena entrega el repositorio', async () => {
    const almacen = await almacenConBoveda('correcta-123')
    const onAbierto = vi.fn()
    const user = userEvent.setup()
    render(<Desbloqueo almacen={almacen} onAbierto={onAbierto} />)

    await user.type(await screen.findByLabelText('Contraseña'), 'correcta-123')
    await user.click(screen.getByRole('button', { name: 'Desbloquear' }))

    await waitFor(() => expect(onAbierto).toHaveBeenCalledTimes(1))
    expect(await onAbierto.mock.calls[0][0].listarMovimientos()).toEqual([])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('la primera vez exige que las dos contraseñas coincidan', async () => {
    const onAbierto = vi.fn()
    const user = userEvent.setup()
    render(<Desbloqueo almacen={almacenFalso()} onAbierto={onAbierto} />)

    await user.type(await screen.findByLabelText('Contraseña'), 'correcta-123')
    await user.type(screen.getByLabelText('Repite la contraseña'), 'otra-distinta')
    await user.click(screen.getByRole('button', { name: 'Cifrar mis datos' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Las dos contraseñas no coinciden.')
    expect(onAbierto).not.toHaveBeenCalled()
  })
})
