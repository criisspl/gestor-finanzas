import { describe, expect, it } from 'vitest'
import { ESTADO_VACIO, repositorioEnMemoria, type Estado } from './memoria.ts'
import type { GastoVariable } from '../domain/tipos.ts'

const MES = '2026-11'
const inicial: Estado = {
  ...ESTADO_VACIO,
  meses: { [MES]: { nomina: 1000, nominaRecibida: true, arrastreReal: null, saldos: { c1: 500 } } },
}
const gasto = { tipo: 'gasto', nombre: 'Cena', importe: 30, categoria: 'ocio', fecha: '2026-11-12', cuenta: 'c1' } as unknown as Omit<GastoVariable, 'id'>
const ajuste = { mes: MES, cuenta: 'c1', delta: -30 }

describe('operaciones compuestas del repositorio en memoria', () => {
  it('crear un gasto con ajuste guarda movimiento y saldo en un solo guardado', async () => {
    const guardados: Estado[] = []
    const repo = repositorioEnMemoria(inicial, async (e) => void guardados.push(e))
    await repo.crearMovimiento(gasto, ajuste)
    expect(guardados).toHaveLength(1)
    expect(guardados[0].movimientos).toHaveLength(1)
    expect((await repo.listarMeses())[MES].saldos.c1).toBe(470)
  })

  it('si el guardado falla no cambia ni el gasto ni el saldo', async () => {
    const repo = repositorioEnMemoria(inicial, async () => {
      throw new Error('sin red')
    })
    await expect(repo.crearMovimiento(gasto, ajuste)).rejects.toThrow('sin red')
    expect(await repo.listarMovimientos()).toEqual([])
    expect((await repo.listarMeses())[MES].saldos.c1).toBe(500)
  })

  it('borrar un gasto devuelve el importe al saldo en el mismo guardado', async () => {
    const repo = repositorioEnMemoria(inicial, async () => undefined)
    const creado = await repo.crearMovimiento(gasto, ajuste)
    await repo.borrarMovimiento(creado.id, { mes: MES, cuenta: 'c1', delta: 30 })
    expect(await repo.listarMovimientos()).toEqual([])
    expect((await repo.listarMeses())[MES].saldos.c1).toBe(500)
  })

  it('marcar un recibo y cobrar ajustan el saldo atómicamente; sin saldo apuntado no se inventa', async () => {
    const repo = repositorioEnMemoria(inicial, async () => undefined)
    await repo.marcarRecibo(MES, 'r1', true, { mes: MES, cuenta: 'c1', delta: -20 })
    expect((await repo.listarRecibos())[MES]).toBeDefined()
    expect((await repo.listarMeses())[MES].saldos.c1).toBe(480)
    await repo.marcarRecibo(MES, 'r2', true, { mes: MES, cuenta: 'otra', delta: -20 })
    expect((await repo.listarMeses())[MES].saldos).toEqual({ c1: 480 })
  })

  it('cobrar falla entero: ni cobro ni saldo cambian', async () => {
    let fallar = false
    const repo = repositorioEnMemoria(inicial, async () => {
      if (fallar) throw new Error('sin red')
    })
    const cobro = await repo.crearCobro({ nombre: 'Bizum', detalle: null, importe: 50, mes: MES })
    fallar = true
    await expect(repo.actualizarCobro({ ...cobro, cobrado: true, fechaCobro: '2026-11-12' }, { mes: MES, cuenta: 'c1', delta: 50 })).rejects.toThrow()
    expect((await repo.listarCobros())[0].cobrado).toBe(false)
    expect((await repo.listarMeses())[MES].saldos.c1).toBe(500)
  })
})
