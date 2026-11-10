import { useCallback, useEffect, useState } from 'react'
import type { AjusteSaldo, Repositorio } from '../data/repositorio'
import { PATRIMONIO_VACIO } from '../data/repositorio'
import { ConflictoBoveda } from '../data/boveda.ts'
import { ajustarSaldo as ajustarSaldoPuro } from '../domain/cierre.ts'
import { mesDeFecha } from '../domain/ciclo.ts'
import { hoy } from '../domain/formato.ts'
import { marcarRecibo as marcarReciboPuro } from '../domain/partidas.ts'
import {
  AJUSTES_POR_DEFECTO,
  type Ajustes, type Cobro, type DatosMes, type Deuda, type GastoVariable, type Meses, type Movimiento, type Nota, type NuevaDeuda, type NuevaNota,
  type NuevaPartida, type NuevoCobro, type NuevoMovimiento, type NuevoPagoDeuda, type PagoDeuda, type Partida, type Patrimonio, type Recibos,
} from '../domain/tipos.ts'

/** Carga los datos de la persona y expone las operaciones para cambiarlos. */
export function useFinanzas(repo: Repositorio) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [notas, setNotas] = useState<Nota[]>([])
  const [patrimonio, setPatrimonio] = useState<Patrimonio>(PATRIMONIO_VACIO)
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [recibos, setRecibos] = useState<Recibos>({})
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_POR_DEFECTO)
  const [meses, setMeses] = useState<Meses>({})
  const [deudas, setDeudas] = useState<Deuda[]>([])
  const [pagos, setPagos] = useState<PagoDeuda[]>([])
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    Promise.all([repo.listarMovimientos(), repo.listarNotas(), repo.leerPatrimonio(), repo.listarPartidas(), repo.listarRecibos(), repo.leerAjustes(), repo.listarMeses(),
      repo.listarDeudas(), repo.listarPagos(), repo.listarCobros()])
      .then(([m, n, p, pt, r, aj, me, de, pa, co]) => {
        if (!vigente) return
        setMovimientos(m)
        setNotas(n)
        setPatrimonio(p)
        setPartidas(pt)
        setRecibos(r)
        setAjustes(aj)
        setMeses(me)
        setDeudas(de)
        setPagos(pa)
        setCobros(co)
      })
      .catch(() => vigente && setError('No se pudieron cargar tus datos. Recarga la página.'))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [repo])

  // Referencia estable: crearMes depende de ella
  /** Ejecuta una escritura y traduce cualquier fallo a un mensaje para la persona. */
  const intentar = useCallback(async <T,>(accion: () => Promise<T>): Promise<T | null> => {
    setError(null)
    try {
      return await accion()
    } catch (e) {
      setError(
        e instanceof ConflictoBoveda
          ? 'Hay cambios guardados desde otro dispositivo. Recarga la página para verlos; este cambio no se guardó.'
          : 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.',
      )
      return null
    }
  }, [])

  const crear = (m: NuevoMovimiento) =>
    intentar(async () => {
      const nuevo = await repo.crearMovimiento(m)
      setMovimientos((prev) => [...prev, nuevo])
      return nuevo
    })

  const actualizar = (m: Movimiento) =>
    intentar(async () => {
      await repo.actualizarMovimiento(m)
      setMovimientos((prev) => prev.map((x) => (x.id === m.id ? m : x)))
      return m
    })

  const borrar = (id: string) =>
    intentar(async () => {
      await repo.borrarMovimiento(id)
      setMovimientos((prev) => prev.filter((x) => x.id !== id))
      return id
    })

  const crearNota = (n: NuevaNota) =>
    intentar(async () => {
      const nueva = await repo.crearNota(n)
      setNotas((prev) => [...prev, nueva])
      return nueva
    })

  const actualizarNota = (n: Nota) =>
    intentar(async () => {
      await repo.actualizarNota(n)
      setNotas((prev) => prev.map((x) => (x.id === n.id ? n : x)))
      return n
    })

  const borrarNota = (id: string) =>
    intentar(async () => {
      await repo.borrarNota(id)
      setNotas((prev) => prev.filter((x) => x.id !== id))
      return id
    })

  const guardarPatrimonio = (p: Omit<Patrimonio, 'actualizado'>) =>
    intentar(async () => {
      const guardado = await repo.guardarPatrimonio(p)
      setPatrimonio(guardado)
      return guardado
    })

  const crearPartida = (p: NuevaPartida) =>
    intentar(async () => {
      const nueva = await repo.crearPartida(p)
      setPartidas((prev) => [...prev, nueva])
      return nueva
    })

  const actualizarPartida = (p: Partida) =>
    intentar(async () => {
      await repo.actualizarPartida(p)
      setPartidas((prev) => prev.map((x) => (x.id === p.id ? p : x)))
      return p
    })

  const borrarPartida = (id: string) =>
    intentar(async () => {
      await repo.borrarPartida(id)
      setPartidas((prev) => prev.filter((x) => x.id !== id))
      setMovimientos((prev) => prev.map((m) => (m.tipo === 'gasto' && m.partida === id ? { ...m, partida: null } : m)))
      return id
    })

  /** Refleja en pantalla el mismo ajuste de saldo que el repositorio guardó junto a la operación. */
  function reflejarSaldo(ajuste: AjusteSaldo | null) {
    if (ajuste) setMeses((prev) => ajustarSaldoPuro(prev, ajuste.mes, ajuste.cuenta, ajuste.delta))
  }

  /** Apunta un gasto y, si sale de una cuenta con saldo apuntado, se lo resta; todo en un solo guardado. */
  const apuntarGasto = (m: NuevoMovimiento) =>
    intentar(async () => {
      const ajuste =
        m.tipo === 'gasto' && m.cuenta ? { mes: mesDeFecha(m.fecha, ajustes.diaInicio), cuenta: m.cuenta, delta: -m.importe } : null
      const nuevo = await repo.crearMovimiento(m, ajuste)
      setMovimientos((prev) => [...prev, nuevo])
      reflejarSaldo(ajuste)
      return nuevo
    })

  /** Borra un gasto y devuelve su importe a la cuenta de la que salió, en un solo guardado. */
  const borrarGasto = (g: GastoVariable) =>
    intentar(async () => {
      const ajuste = g.cuenta ? { mes: mesDeFecha(g.fecha, ajustes.diaInicio), cuenta: g.cuenta, delta: g.importe } : null
      await repo.borrarMovimiento(g.id, ajuste)
      setMovimientos((prev) => prev.filter((x) => x.id !== g.id))
      reflejarSaldo(ajuste)
      return g.id
    })

  /** Marca o desmarca un recibo; al marcarlo, su importe sale de la cuenta de nómina (la primera). Un solo guardado. */
  const marcarRecibo = (mes: string, id: string, llegado: boolean, importe: number) =>
    intentar(async () => {
      const nomina = ajustes.cuentas[0]
      const ajuste = nomina ? { mes, cuenta: nomina.id, delta: llegado ? -importe : importe } : null
      await repo.marcarRecibo(mes, id, llegado, ajuste)
      setRecibos((prev) => marcarReciboPuro(prev, mes, id, llegado))
      reflejarSaldo(ajuste)
      return id
    })

  const guardarAjustes = (a: Ajustes) =>
    intentar(async () => {
      await repo.guardarAjustes(a)
      setAjustes(a)
      return a
    })

  const guardarMes = (mes: string, datos: DatosMes) =>
    intentar(async () => {
      await repo.guardarMes(mes, datos)
      setMeses((prev) => ({ ...prev, [mes]: datos }))
      return mes
    })

  const crearDeuda = (d: NuevaDeuda) =>
    intentar(async () => {
      const nueva = await repo.crearDeuda(d)
      setDeudas((prev) => [...prev, nueva])
      return nueva
    })

  const actualizarDeuda = (d: Deuda) =>
    intentar(async () => {
      await repo.actualizarDeuda(d)
      setDeudas((prev) => prev.map((x) => (x.id === d.id ? d : x)))
      return d
    })

  /** Borra la deuda con sus pagos y los gastos que esos pagos crearon. */
  const borrarDeuda = (id: string) =>
    intentar(async () => {
      await repo.borrarDeuda(id)
      const gastos = new Set(pagos.filter((p) => p.deuda === id).map((p) => p.gasto))
      setDeudas((prev) => prev.filter((x) => x.id !== id))
      setPagos((prev) => prev.filter((p) => p.deuda !== id))
      setMovimientos((prev) => prev.filter((m) => !gastos.has(m.id)))
      return id
    })

  /** Registra un pago parcial; con `gasto` también lo apunta como gasto de una partida, enlazado al pago. */
  const pagarDeuda = (pago: NuevoPagoDeuda, gasto: Omit<GastoVariable, 'id'> | null) =>
    intentar(async () => {
      const hecho = await repo.registrarPago(pago, gasto)
      setPagos((prev) => [...prev, hecho.pago])
      if (hecho.gasto) {
        const nuevo = hecho.gasto
        setMovimientos((prev) => [...prev, nuevo])
      }
      return hecho.pago
    })

  const borrarPago = (p: PagoDeuda) =>
    intentar(async () => {
      await repo.borrarPago(p.id)
      setPagos((prev) => prev.filter((x) => x.id !== p.id))
      setMovimientos((prev) => prev.filter((m) => m.id !== p.gasto))
      return p.id
    })

  const crearCobro = (c: NuevoCobro) =>
    intentar(async () => {
      const nuevo = await repo.crearCobro(c)
      setCobros((prev) => [...prev, nuevo])
      return nuevo
    })

  const actualizarCobro = (c: Cobro) =>
    intentar(async () => {
      await repo.actualizarCobro(c)
      setCobros((prev) => prev.map((x) => (x.id === c.id ? c : x)))
      return c
    })

  const borrarCobro = (id: string) =>
    intentar(async () => {
      await repo.borrarCobro(id)
      setCobros((prev) => prev.filter((x) => x.id !== id))
      return id
    })

  /** Marca el cobro como llegado y suma su importe a la cuenta de nómina (la primera) en el mes del cobro. */
  const cobrar = (c: Cobro) =>
    intentar(async () => {
      const cobrado: Cobro = { ...c, cobrado: true, fechaCobro: hoy() }
      const nomina = ajustes.cuentas[0]
      const ajuste = nomina ? { mes: c.mes, cuenta: nomina.id, delta: c.importe } : null
      await repo.actualizarCobro(cobrado, ajuste)
      setCobros((prev) => prev.map((x) => (x.id === c.id ? cobrado : x)))
      reflejarSaldo(ajuste)
      return c.id
    })

  // Referencia estable: Panel la usa como dependencia de un useEffect
  /** Crea un mes copiando las partidas del anterior. */
  const crearMes = useCallback(
    (mes: string, copiarDe: string | null) =>
      intentar(async () => {
        await repo.crearMes(mes, copiarDe)
        const [pt, me] = await Promise.all([repo.listarPartidas(), repo.listarMeses()])
        setPartidas(pt)
        setMeses(me)
        return mes
      }),
    [repo, intentar],
  )

  return {
    movimientos, notas, patrimonio, partidas, recibos, ajustes, meses, deudas, pagos, cobros, cargando, error,
    crear, actualizar, borrar, crearNota, actualizarNota, borrarNota, guardarPatrimonio,
    crearPartida, actualizarPartida, borrarPartida, marcarRecibo,
    apuntarGasto, borrarGasto, guardarAjustes, guardarMes, crearMes,
    crearDeuda, actualizarDeuda, borrarDeuda, pagarDeuda, borrarPago, crearCobro, actualizarCobro, borrarCobro, cobrar,
  }
}
