import { describe, expect, it } from 'vitest'
import { abrirBoveda, ConflictoBoveda, crearBoveda, type AlmacenBoveda } from './boveda'
import { abrirLlave, cifrar, ContrasenaIncorrecta, crearLlave, type Sobre } from './cifrado'
import { AJUSTES_POR_DEFECTO } from '../domain/tipos'
import { ESTADO_VACIO, type Estado } from './memoria'

const IT = 1000

function almacenFalso(sinCifrar: Estado | null = null) {
  const a = {
    sobre: null as Sobre | null,
    sinCifrar,
    fallarEscritura: false,
    conflicto: false,
    async leer() {
      return a.sobre
    },
    async escribir(s: Sobre) {
      if (a.fallarEscritura) throw new Error('sin red')
      if (a.conflicto) throw new ConflictoBoveda()
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
  partidas: [],
  recibos: {},
  ajustes: AJUSTES_POR_DEFECTO,
  meses: {},
  deudas: [],
  pagos: [],
  cobros: [],
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

  it('partidas, gastos con partida y recibos se guardan cifrados y se recuperan', async () => {
    const almacen = almacenFalso()
    const repo = await crearBoveda(almacen, 'contraseña', IT)
    const partida = await repo.crearPartida({ mes: '2026-11', nombre: 'Comida secreta', detalle: null, importe: 250, variable: true, orden: 1 })
    const gasto = await repo.crearMovimiento({ tipo: 'gasto', nombre: 'Súper', importe: 40, categoria: 'esencial', fecha: '2026-11-02', partida: partida.id })
    await repo.marcarRecibo('2026-11', 'f1', true)
    expect(almacen.sobre?.version).toBe(5)
    expect(almacen.sobre?.cifrado).not.toContain('secreta')

    const otra = await abrirBoveda(almacen, almacen.sobre!, 'contraseña')
    expect(await otra.listarPartidas()).toEqual([partida])
    expect(await otra.listarMovimientos()).toEqual([gasto])
    expect(await otra.listarRecibos()).toEqual({ '2026-11': ['f1'] })

    // al borrar la partida el gasto se conserva, sin partida
    await otra.borrarPartida(partida.id)
    expect(await otra.listarPartidas()).toEqual([])
    expect(await otra.listarMovimientos()).toEqual([{ ...gasto, partida: null }])
  })

  it('abre un sobre de la versión 2 (sin partidas ni recibos) y lo guarda ya como versión 5', async () => {
    const almacen = almacenFalso()
    const llave = await crearLlave('contraseña', IT)
    const nota = { id: 'n1', tipo: 'ok', titulo: null, texto: 'x' }
    const v2: Sobre = { ...(await cifrar(llave, { movimientos: antiguo.movimientos, notas: [nota], patrimonio: antiguo.patrimonio })), version: 2 }
    const repo = await abrirBoveda(almacen, v2, 'contraseña')
    expect(await repo.listarNotas()).toEqual([nota])
    expect(await repo.listarPartidas()).toEqual([])
    expect(await repo.listarRecibos()).toEqual({})
    await repo.marcarRecibo('2026-11', 'f1', true)
    expect(almacen.sobre?.version).toBe(5)
  })

  it('abre un sobre de la versión 1 (sin notas) y lo guarda ya como versión 5', async () => {
    const almacen = almacenFalso()
    const llave = await crearLlave('contraseña', IT)
    const estadoV1 = { movimientos: antiguo.movimientos, patrimonio: antiguo.patrimonio }
    const v1: Sobre = { ...(await cifrar(llave, estadoV1)), version: 1 }
    const repo = await abrirBoveda(almacen, v1, 'contraseña')
    expect(await repo.listarMovimientos()).toEqual(antiguo.movimientos)
    expect(await repo.listarNotas()).toEqual([])
    expect(await repo.listarPartidas()).toEqual([])
    await repo.crearNota({ tipo: 'ok', titulo: 'Hola', texto: 'x' })
    expect(almacen.sobre?.version).toBe(5)
    expect((await abrirLlave('contraseña', almacen.sobre!)).sal).toBe(v1.sal)
  })

  it('abre un sobre de la versión 3 (sin ajustes ni meses) con los valores por defecto', async () => {
    const almacen = almacenFalso()
    const llave = await crearLlave('contraseña', IT)
    const v3: Sobre = { ...(await cifrar(llave, { movimientos: antiguo.movimientos, partidas: [], recibos: {} })), version: 3 }
    const repo = await abrirBoveda(almacen, v3, 'contraseña')
    expect(await repo.leerAjustes()).toEqual(AJUSTES_POR_DEFECTO)
    expect(await repo.listarMeses()).toEqual({})
  })

  it('ajustes y datos del mes se guardan cifrados y se recuperan', async () => {
    const almacen = almacenFalso()
    const repo = await crearBoveda(almacen, 'contraseña', IT)
    await repo.guardarAjustes({ diaInicio: 25, cuentas: [{ id: 'c1', nombre: 'Cuenta secretísima' }] })
    await repo.guardarMes('2026-11', { nomina: 1500, nominaRecibida: true, arrastreReal: null, saldos: { c1: 100 } })
    await repo.ajustarSaldo('2026-11', 'c1', -30)
    expect(almacen.sobre?.cifrado).not.toContain('secretísima')

    const otra = await abrirBoveda(almacen, almacen.sobre!, 'contraseña')
    expect((await otra.leerAjustes()).diaInicio).toBe(25)
    expect((await otra.listarMeses())['2026-11']).toEqual({ nomina: 1500, nominaRecibida: true, arrastreReal: null, saldos: { c1: 70 } })
  })

  it('abre un sobre de la versión 4 (sin deudas ni cobros) y los completa vacíos', async () => {
    const almacen = almacenFalso()
    const llave = await crearLlave('contraseña', IT)
    const v4: Sobre = { ...(await cifrar(llave, { movimientos: antiguo.movimientos, partidas: [], recibos: {}, meses: {} })), version: 4 }
    const repo = await abrirBoveda(almacen, v4, 'contraseña')
    expect(await repo.listarDeudas()).toEqual([])
    expect(await repo.listarPagos()).toEqual([])
    expect(await repo.listarCobros()).toEqual([])
    await repo.crearCobro({ mes: '2026-11', nombre: 'x', detalle: null, importe: 5 })
    expect(almacen.sobre?.version).toBe(5)
  })

  it('deudas, pagos y cobros se guardan cifrados y se recuperan', async () => {
    const almacen = almacenFalso()
    const repo = await crearBoveda(almacen, 'contraseña', IT)
    const deuda = await repo.crearDeuda({ nombre: 'Préstamo reservado', detalle: null, importe: 300, estado: 'mal', estadoTexto: 'Vencida' })
    const cobro = await repo.crearCobro({ mes: '2026-11', nombre: 'Cobro reservado', detalle: null, importe: 80 })
    await repo.actualizarCobro({ ...cobro, cobrado: true, fechaCobro: '2026-11-10' })
    expect(almacen.sobre?.cifrado).not.toContain('reservado')

    const otra = await abrirBoveda(almacen, almacen.sobre!, 'contraseña')
    expect(await otra.listarDeudas()).toEqual([deuda])
    expect(await otra.listarCobros()).toEqual([{ ...cobro, cobrado: true, fechaCobro: '2026-11-10' }])
  })

  it('un pago restado de una partida crea un gasto enlazado que se borra con el pago', async () => {
    const repo = await crearBoveda(almacenFalso(), 'contraseña', IT)
    const deuda = await repo.crearDeuda({ nombre: 'D', detalle: null, importe: 100, estado: null, estadoTexto: null })
    const sin = await repo.registrarPago({ deuda: deuda.id, importe: 10, fecha: '2026-11-05' }, null)
    expect(sin.gasto).toBeNull()
    const con = await repo.registrarPago(
      { deuda: deuda.id, importe: 40, fecha: '2026-11-06' },
      { tipo: 'gasto', nombre: 'Pago: D', importe: 40, categoria: 'otros', fecha: '2026-11-06', partida: 'p1' },
    )
    expect(con.pago.gasto).toBe(con.gasto?.id)
    expect(await repo.listarMovimientos()).toEqual([con.gasto])

    await repo.borrarPago(con.pago.id)
    expect(await repo.listarMovimientos()).toEqual([])
    expect(await repo.listarPagos()).toEqual([sin.pago])
  })

  it('al borrar una deuda se borran sus pagos y los gastos que crearon', async () => {
    const repo = await crearBoveda(almacenFalso(), 'contraseña', IT)
    const deuda = await repo.crearDeuda({ nombre: 'D', detalle: null, importe: 100, estado: null, estadoTexto: null })
    await repo.registrarPago(
      { deuda: deuda.id, importe: 40, fecha: '2026-11-06' },
      { tipo: 'gasto', nombre: 'Pago: D', importe: 40, categoria: 'otros', fecha: '2026-11-06', partida: 'p1' },
    )
    await repo.borrarDeuda(deuda.id)
    expect(await repo.listarDeudas()).toEqual([])
    expect(await repo.listarPagos()).toEqual([])
    expect(await repo.listarMovimientos()).toEqual([])
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
  describe('cambiar la contraseña', () => {
    it('cifra con la nueva y con sal nueva; la vieja deja de valer', async () => {
      const almacen = almacenFalso(antiguo)
      const repo = await crearBoveda(almacen, 'contraseña', IT)
      const salVieja = almacen.sobre!.sal
      await repo.cambiarContrasena!('contraseña', 'otra-contraseña')
      expect(almacen.sobre!.sal).not.toBe(salVieja)

      const otra = await abrirBoveda(almacen, almacen.sobre!, 'otra-contraseña')
      expect(await otra.listarMovimientos()).toEqual(antiguo.movimientos)
      await expect(abrirBoveda(almacen, almacen.sobre!, 'contraseña')).rejects.toBeInstanceOf(ContrasenaIncorrecta)
    })

    it('los guardados posteriores usan la contraseña nueva', async () => {
      const almacen = almacenFalso()
      const repo = await crearBoveda(almacen, 'contraseña', IT)
      await repo.cambiarContrasena!('contraseña', 'otra-contraseña')
      await repo.crearMovimiento({ tipo: 'ingreso', nombre: 'Extra', importe: 5 })
      const otra = await abrirBoveda(almacen, almacen.sobre!, 'otra-contraseña')
      expect((await otra.listarMovimientos()).map((m) => m.nombre)).toEqual(['Extra'])
    })

    it('con la contraseña actual mala no cambia nada', async () => {
      const almacen = almacenFalso(antiguo)
      const repo = await crearBoveda(almacen, 'contraseña', IT)
      const antes = almacen.sobre
      await expect(repo.cambiarContrasena!('equivocada', 'otra-contraseña')).rejects.toBeInstanceOf(ContrasenaIncorrecta)
      expect(almacen.sobre).toBe(antes)
      await abrirBoveda(almacen, almacen.sobre!, 'contraseña')
    })

    it('si falla el guardado, la contraseña vieja sigue valiendo', async () => {
      const almacen = almacenFalso(antiguo)
      const repo = await crearBoveda(almacen, 'contraseña', IT)
      const antes = almacen.sobre
      almacen.fallarEscritura = true
      await expect(repo.cambiarContrasena!('contraseña', 'otra-contraseña')).rejects.toThrow('sin red')
      almacen.fallarEscritura = false
      expect(almacen.sobre).toBe(antes)
      // la sesión sigue guardando con la vieja
      await repo.crearMovimiento({ tipo: 'ingreso', nombre: 'Extra', importe: 5 })
      const otra = await abrirBoveda(almacen, almacen.sobre!, 'contraseña')
      expect((await otra.listarMovimientos()).map((m) => m.nombre)).toEqual(['Nómina', 'Extra'])
      await expect(abrirBoveda(almacen, almacen.sobre!, 'otra-contraseña')).rejects.toBeInstanceOf(ContrasenaIncorrecta)
    })

    it('si hay conflicto con otro dispositivo, lanza ConflictoBoveda y no cambia nada', async () => {
      const almacen = almacenFalso(antiguo)
      const repo = await crearBoveda(almacen, 'contraseña', IT)
      const antes = almacen.sobre
      almacen.conflicto = true
      await expect(repo.cambiarContrasena!('contraseña', 'otra-contraseña')).rejects.toBeInstanceOf(ConflictoBoveda)
      expect(almacen.sobre).toBe(antes)
      await abrirBoveda(almacen, almacen.sobre!, 'contraseña')
    })
  })
})
