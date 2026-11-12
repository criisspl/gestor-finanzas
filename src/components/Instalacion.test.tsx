// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLAVE_CONFIGURACION } from '../data/configuracion.ts'
import { Instalacion } from './Instalacion.tsx'

const sugerida = { proveedor: 'supabase', parametros: { url: 'https://abc.supabase.co', clave: 'sb_publishable_x' } }

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('Instalacion', () => {
  it('preselecciona lo sugerido, lo marca y rellena sus campos', () => {
    render(<Instalacion sugerida={sugerida} onGuardar={() => {}} />)
    expect((screen.getByRole('radio', { name: /Supabase/ }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText(/· sugerido/)).toBeDefined()
    expect((screen.getByLabelText(/URL del proyecto/) as HTMLInputElement).value).toBe('https://abc.supabase.co')
  })

  it('avisa de que perder la contraseña es perder los datos', () => {
    render(<Instalacion sugerida={sugerida} onGuardar={() => {}} />)
    expect(screen.getByText(/pierdes los datos/)).toBeDefined()
  })

  it('rechaza una url http, no guarda ni continúa', async () => {
    const onGuardar = vi.fn()
    render(<Instalacion sugerida={sugerida} onGuardar={onGuardar} />)
    const url = screen.getByLabelText(/URL del proyecto/)
    await userEvent.clear(url)
    await userEvent.type(url, 'http://abc.supabase.co')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
    expect(screen.getByRole('alert').textContent).toContain('https://')
    expect(onGuardar).not.toHaveBeenCalled()
    expect(localStorage.getItem(CLAVE_CONFIGURACION)).toBeNull()
  })

  it('guarda la configuración elegida y la devuelve', async () => {
    const onGuardar = vi.fn()
    render(<Instalacion sugerida={sugerida} onGuardar={onGuardar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
    expect(onGuardar).toHaveBeenCalledWith(sugerida)
    expect(JSON.parse(localStorage.getItem(CLAVE_CONFIGURACION)!)).toMatchObject(sugerida)
  })

  it('se puede elegir otro proveedor distinto del sugerido, sin campos que rellenar', async () => {
    const onGuardar = vi.fn()
    render(<Instalacion sugerida={sugerida} onGuardar={onGuardar} />)
    await userEvent.click(screen.getByRole('radio', { name: /Solo en este navegador/ }))
    expect(screen.queryByLabelText(/URL del proyecto/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
    expect(onGuardar).toHaveBeenCalledWith({ proveedor: 'local', parametros: {} })
  })

  it('Cancelar solo aparece si ya había configuración', async () => {
    const onCancelar = vi.fn()
    const { rerender } = render(<Instalacion sugerida={sugerida} onGuardar={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()
    rerender(<Instalacion sugerida={sugerida} onGuardar={() => {}} onCancelar={onCancelar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancelar).toHaveBeenCalled()
  })
})
