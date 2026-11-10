// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConflictoBoveda } from '../data/boveda.ts'
import { ESTADO_VACIO, repositorioEnMemoria } from '../data/memoria.ts'
import { useFinanzas } from './useFinanzas.ts'

const gasto = { tipo: 'gasto', categoria: 'esencial', importe: 10, nombre: 'Pan', fecha: '2026-11-10', partida: null, cuenta: null } as const

describe('useFinanzas: errores al guardar', () => {
  it('ConflictoBoveda avisa de que hay cambios en otro dispositivo y no añade el gasto', async () => {
    const repo = repositorioEnMemoria(ESTADO_VACIO, async () => {
      throw new ConflictoBoveda()
    })
    const { result } = renderHook(() => useFinanzas(repo))
    await waitFor(() => expect(result.current.cargando).toBe(false))

    let devuelto: unknown
    await act(async () => {
      devuelto = await result.current.apuntarGasto(gasto)
    })

    expect(devuelto).toBeNull()
    expect(result.current.error).toBe('Hay cambios guardados desde otro dispositivo. Recarga la página para verlos; este cambio no se guardó.')
    expect(result.current.movimientos).toEqual([])
  })

  it('otro fallo muestra el aviso de conexión', async () => {
    const repo = repositorioEnMemoria(ESTADO_VACIO, async () => {
      throw new Error('sin red')
    })
    const { result } = renderHook(() => useFinanzas(repo))
    await waitFor(() => expect(result.current.cargando).toBe(false))

    await act(async () => {
      await result.current.apuntarGasto(gasto)
    })

    expect(result.current.error).toBe('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.')
  })

  it('un guardado correcto limpia el error anterior y añade el gasto', async () => {
    let fallar = true
    const repo = repositorioEnMemoria(ESTADO_VACIO, async () => {
      if (fallar) throw new ConflictoBoveda()
    })
    const { result } = renderHook(() => useFinanzas(repo))
    await waitFor(() => expect(result.current.cargando).toBe(false))

    await act(async () => {
      await result.current.apuntarGasto(gasto)
    })
    expect(result.current.error).not.toBeNull()

    fallar = false
    await act(async () => {
      await result.current.apuntarGasto(gasto)
    })
    expect(result.current.error).toBeNull()
    expect(result.current.movimientos).toHaveLength(1)
  })
})
