// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApuntarGasto } from './ApuntarGasto.tsx'

afterEach(cleanup)

function montar(onApuntar = vi.fn<() => Promise<unknown>>(async () => ({ id: 'g1' }))) {
  render(<ApuntarGasto partidas={[]} diaInicio={1} cuentas={[{ id: 'c1', nombre: 'Nómina' }]} onApuntar={onApuntar} />)
  return onApuntar
}

describe('ApuntarGasto', () => {
  it('da de alta un gasto con importe en formato español', async () => {
    const onApuntar = montar()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Importe (€)'), '1.234,56')
    await user.type(screen.getByLabelText('Concepto (opcional)'), '  Mercadona ')
    await user.selectOptions(screen.getByLabelText('Cuenta de la que sale'), 'c1')
    await user.click(screen.getByRole('button', { name: 'Apuntar' }))

    await waitFor(() => expect(onApuntar).toHaveBeenCalledTimes(1))
    expect(onApuntar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'gasto', categoria: 'esencial', importe: 1234.56, nombre: 'Mercadona', cuenta: 'c1', partida: null }),
    )
    // Tras apuntar se limpia el formulario
    await waitFor(() => expect((screen.getByLabelText('Importe (€)') as HTMLInputElement).value).toBe(''))
  })

  it('un importe no válido muestra el aviso y no apunta nada', async () => {
    const onApuntar = montar()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Importe (€)'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Apuntar' }))

    expect((await screen.findByRole('alert')).textContent).toBe('El importe tiene que ser un número mayor que 0, por ejemplo 12,50.')
    expect(onApuntar).not.toHaveBeenCalled()
  })

  it('si no se pudo guardar conserva lo escrito', async () => {
    const onApuntar = montar(vi.fn<() => Promise<unknown>>(async () => null))
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Importe (€)'), '12,50')
    await user.click(screen.getByRole('button', { name: 'Apuntar' }))

    await waitFor(() => expect(onApuntar).toHaveBeenCalledTimes(1))
    expect((screen.getByLabelText('Importe (€)') as HTMLInputElement).value).toBe('12,50')
  })
})
