// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearBoveda, type AlmacenBoveda } from '../data/boveda.ts'
import type { Sobre } from '../data/cifrado.ts'
import * as descarga from '../data/descarga.ts'
import { exportarFichero } from '../data/migracion.ts'
import { ESTADO_VACIO, type Estado } from '../data/memoria.ts'
import { CopiaDatos } from './CopiaDatos.tsx'
import { Desbloqueo } from './Desbloqueo.tsx'

afterEach(cleanup)
beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

const PW = 'correcta-123'
const DATOS: Estado = { ...ESTADO_VACIO, notas: [{ id: 'n1', tipo: 'ok', titulo: 'Hola', texto: 'x' }] }

function almacenFalso(sobre: Sobre | null = null) {
  const a = {
    usuario: 'u1' as string | undefined,
    sobre,
    leer: async () => a.sobre,
    escribir: async (s: Sobre) => { a.sobre = s },
    leerSinCifrar: async (): Promise<Estado | null> => null,
    borrarSinCifrar: async () => {},
  }
  return a satisfies AlmacenBoveda & Record<string, unknown>
}

async function almacenConDatos() {
  const a = almacenFalso()
  a.leerSinCifrar = async () => DATOS
  await crearBoveda(a, PW, 1000)
  a.leerSinCifrar = async () => null
  return a
}

function fichero(texto: string) {
  return new File([texto], 'copia.json', { type: 'application/json' })
}

describe('CopiaDatos', () => {
  it('exporta un fichero cifrado: sin la contraseña ni los datos en claro', async () => {
    const descargar = vi.spyOn(descarga, 'descargarFichero').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<CopiaDatos origen={{ modo: 'boveda', almacen: await almacenConDatos() }} onImportado={() => {}} />)
    await user.type(screen.getByLabelText('Tu contraseña'), PW)
    await user.click(screen.getByRole('button', { name: 'Descargar copia cifrada' }))
    await waitFor(() => expect(descargar).toHaveBeenCalledTimes(1))
    const texto = descargar.mock.calls[0][1]
    expect(texto).not.toContain(PW)
    expect(texto).not.toContain('Hola')
    expect((await screen.findByRole('status')).textContent).toMatch(/Copia descargada/)
  })

  it('contraseña mala: no descarga nada', async () => {
    const descargar = vi.spyOn(descarga, 'descargarFichero').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<CopiaDatos origen={{ modo: 'boveda', almacen: await almacenConDatos() }} onImportado={() => {}} />)
    await user.type(screen.getByLabelText('Tu contraseña'), 'mala-contra-1')
    await user.click(screen.getByRole('button', { name: 'Descargar copia cifrada' }))
    expect((await screen.findByRole('alert')).textContent).toBe('La contraseña no es correcta.')
    expect(descargar).not.toHaveBeenCalled()
  })

  it('desde el modo de ejemplo pide contraseña nueva repetida', async () => {
    const descargar = vi.spyOn(descarga, 'descargarFichero').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<CopiaDatos origen={{ modo: 'demo' }} onImportado={() => {}} />)
    await user.type(screen.getByLabelText(/Contraseña nueva/), PW)
    await user.type(screen.getByLabelText('Repite la contraseña'), 'otra-distinta')
    await user.click(screen.getByRole('button', { name: 'Descargar copia cifrada' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Las dos contraseñas no coinciden.')
    expect(descargar).not.toHaveBeenCalled()
  })

  it('importar sustituye solo con confirmación y descarga antes la copia previa', async () => {
    const descargar = vi.spyOn(descarga, 'descargarFichero').mockImplementation(() => {})
    const almacen = await almacenConDatos()
    const previo = almacen.sobre
    const otro: Estado = { ...ESTADO_VACIO, notas: [{ id: 'n2', tipo: 'ok', titulo: 'Otro', texto: 'y' }] }
    const onImportado = vi.fn()
    const user = userEvent.setup()
    render(<CopiaDatos origen={{ modo: 'boveda', almacen }} onImportado={onImportado} />)
    await user.upload(screen.getByLabelText('Fichero de copia'), fichero(await exportarFichero(otro, 'clave-fichero-1', 1000)))
    await user.type(screen.getByLabelText('Contraseña del fichero'), 'clave-fichero-1')

    await user.click(screen.getByRole('button', { name: 'Importar copia' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Confirma/)
    expect(descargar).not.toHaveBeenCalled()
    expect(almacen.sobre).toBe(previo)

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Importar copia' }))
    await waitFor(() => expect(onImportado).toHaveBeenCalledWith('clave-fichero-1'))
    expect(descargar).toHaveBeenCalledTimes(1)
    expect(almacen.sobre).not.toBe(previo)
  })

  it('fichero corrupto: error claro y nada cambia', async () => {
    const descargar = vi.spyOn(descarga, 'descargarFichero').mockImplementation(() => {})
    const almacen = await almacenConDatos()
    const previo = almacen.sobre
    const user = userEvent.setup()
    render(<CopiaDatos origen={{ modo: 'boveda', almacen }} onImportado={() => {}} />)
    await user.upload(screen.getByLabelText('Fichero de copia'), fichero('{"roto'))
    await user.type(screen.getByLabelText('Contraseña del fichero'), 'x')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Importar copia' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/no es válido/)
    expect(descargar).not.toHaveBeenCalled()
    expect(almacen.sobre).toBe(previo)
  })
})

describe('Desbloqueo con bóveda vacía', () => {
  it('importa una copia y abre la bóveda con sus datos', async () => {
    const onAbierto = vi.fn()
    const almacen = almacenFalso()
    const user = userEvent.setup()
    render(<Desbloqueo almacen={almacen} onAbierto={onAbierto} />)
    await user.click(await screen.findByRole('button', { name: 'Ya tengo una copia en un fichero' }))
    await user.upload(screen.getByLabelText('Fichero de copia'), fichero(await exportarFichero(DATOS, 'clave-fichero-1', 1000)))
    await user.type(screen.getByLabelText('Contraseña del fichero'), 'clave-fichero-1')
    await user.click(screen.getByRole('button', { name: 'Importar copia' }))
    await waitFor(() => expect(onAbierto).toHaveBeenCalledTimes(1))
    expect(await onAbierto.mock.calls[0][0].listarNotas()).toEqual(DATOS.notas)
  })

  it('una bóveda que ya existe no ofrece importar', async () => {
    render(<Desbloqueo almacen={await almacenConDatos()} onAbierto={() => {}} />)
    await screen.findByRole('button', { name: 'Desbloquear' })
    expect(screen.queryByRole('button', { name: /copia en un fichero/ })).toBeNull()
  })
})
