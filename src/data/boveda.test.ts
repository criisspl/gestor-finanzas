import { describe, expect, it } from 'vitest'
import { abrirBoveda, crearBoveda, type AlmacenBoveda } from './boveda'
import { abrirLlave, cifrar, crearLlave, type Sobre } from './cifrado'
import { ESTADO_VACIO, type Estado } from './memoria'

const IT = 1000

function almacenFalso(sinCifrar: Estado | null = null) {
  const a = {
    sobre: null as Sobre | null,
    sinCifrar,
    fallarEscritura: false,
    async leer() {
      return a.sobre
    },
    async escribir(s: Sobre) {
      if (a.fallarEscritura) throw new Error('sin red')
      a.sobre = s
    },
    async leerSinCifrar() {
      return a.sinCifrar
    },
    async borrarSinCifrar() {
      a.sinCifrar = null
    },
  }
  return a satisfies AlmacenBoveda
}

const antiguo: Estado = {
  movimientos: [{ id: 'm1', tipo: 'ingreso', nombre: 'Nómina', importe: 1250 }],
  notas: [],
  patrimonio: { fondoEmergencia: 900, totalInvertido: 100, actualizado: null },
}

describe('bóveda', () => {
  it('al crearla cifra los datos antiguos y borra los que estaban en claro', async () => {
    const almacen = almacenFalso(antiguo)
    const repo = await crearBoveda(almacen, 'contraseña', IT)
    expect(await repo.listarMovimientos()).toEqual(antiguo.movimientos)
    expect(almacen.sinCifrar).toBeNull()
    expect(almacen.sobre?.cifrado).not.toContain('Nómina')
  })

  it('sin datos antiguos empieza vacía', async () => {
    const repo = await crearBoveda(almacenFalso(), 'contraseña', IT)
    expect(await repo.listarMovimientos()).toEqual(ESTADO_VACIO.movimientos)
  })

  it('cada cambio se guarda cifrado y se recupera con la contraseña', async () => {
    const almacen = almacenFalso()
    const repo = await crearBoveda(almacen, 'contraseña', IT)
    const gasto = await repo.crearMovimiento({ tipo: 'gasto', nombre: 'Súper', importe: 40, categoria: 'esencial', fecha: '2026-10-01' })
    await repo.guardarPatrimonio({ fondoEmergencia: 500, totalInvertido: 0 })

    // como si hubiera borrado los datos del navegador y vuelto a entrar
    const otra = await abrirBoveda(almacen, almacen.sobre!, 'contraseña')
    expect(await otra.listarMovimientos()).toEqual([gasto])
    expect((await otra.leerPatrimonio()).fondoEmergencia).toBe(500)
  })

  it('las notas se guardan cifradas y se recuperan', async () => {
    const almacen = almacenFalso()
    const repo = await crearBoveda(almacen, 'contraseña', IT)
    const nota = await repo.crearNota({ tipo: 'aviso', titulo: null, texto: 'Revisar suscripciones' })
    await repo.actualizarNota({ ...nota, tipo: 'mal' })
    expect(almacen.sobre?.cifrado).not.toContain('suscripciones')

    const otra = await abrirBoveda(almacen, almacen.sobre!, 'contraseña')
    expect(await otra.listarNotas()).toEqual([{ ...nota, tipo: 'mal' }])
    await otra.borrarNota(nota.id)
    expect(await otra.listarNotas()).toEqual([])
  })

  it('abre un sobre de la versión 1 (sin notas) y lo guarda ya como versión 2', async () => {
    const almacen = almacenFalso()
    const llave = await crearLlave('contraseña', IT)
    const estadoV1 = { movimientos: antiguo.movimientos, patrimonio: antiguo.patrimonio }
    const v1: Sobre = { ...(await cifrar(llave, estadoV1)), version: 1 }
    const repo = await abrirBoveda(almacen, v1, 'contraseña')
    expect(await repo.listarMovimientos()).toEqual(antiguo.movimientos)
    expect(await repo.listarNotas()).toEqual([])
    await repo.crearNota({ tipo: 'ok', titulo: 'Hola', texto: 'x' })
    expect(almacen.sobre?.version).toBe(2)
    expect((await abrirLlave('contraseña', almacen.sobre!)).sal).toBe(v1.sal)
  })

  it('si no se puede guardar, el cambio no se aplica', async () => {
    const almacen = almacenFalso(antiguo)
    const repo = await crearBoveda(almacen, 'contraseña', IT)
    almacen.fallarEscritura = true
    await expect(repo.borrarMovimiento('m1')).rejects.toThrow()
    expect(await repo.listarMovimientos()).toEqual(antiguo.movimientos)
  })

  it('dos cambios seguidos no se pisan', async () => {
    const almacen = almacenFalso()
    const repo = await crearBoveda(almacen, 'contraseña', IT)
    await Promise.all([
      repo.crearMovimiento({ tipo: 'ingreso', nombre: 'A', importe: 1 }),
      repo.crearMovimiento({ tipo: 'ingreso', nombre: 'B', importe: 2 }),
    ])
    const otra = await abrirBoveda(almacen, almacen.sobre!, 'contraseña')
    expect((await otra.listarMovimientos()).map((m) => m.nombre)).toEqual(['A', 'B'])
  })
})
