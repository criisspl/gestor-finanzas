import { useCallback, useEffect, useState } from 'react'
import type { Repositorio } from '../data/repositorio'
import { PATRIMONIO_VACIO } from '../data/repositorio'
import { mesDeFecha } from '../domain/ciclo.ts'
import { marcarRecibo as marcarReciboPuro } from '../domain/partidas.ts'
import {
  AJUSTES_POR_DEFECTO,
  type Ajustes, type DatosMes, type GastoVariable, type Meses, type Movimiento, type Nota, type NuevaNota, type NuevaPartida,
  type NuevoMovimiento, type Partida, type Patrimonio, type Recibos,
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
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    Promise.all([repo.listarMovimientos(), repo.listarNotas(), repo.leerPatrimonio(), repo.listarPartidas(), repo.listarRecibos(), repo.leerAjustes(), repo.listarMeses()])
      .then(([m, n, p, pt, r, aj, me]) => {
        if (!vigente) return
        setMovimientos(m)
        setNotas(n)
        setPatrimonio(p)
        setPartidas(pt)
        setRecibos(r)
        setAjustes(aj)
        setMeses(me)
      })
      .catch(() => vigente && setError('No se pudieron cargar tus datos. Recarga la página.'))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [repo])

  /** Ejecuta una escritura y traduce cualquier fallo a un mensaje para la persona. */
  const intentar = useCallback(async <T,>(accion: () => Promise<T>): Promise<T | null> => {
    setError(null)
    try {
      return await accion()
    } catch {
      setError('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.')
      return null
    }
  }, [])

  const crear = useCallback(
    (m: NuevoMovimiento) =>
      intentar(async () => {
        const nuevo = await repo.crearMovimiento(m)
        setMovimientos((prev) => [...prev, nuevo])
        return nuevo
      }),
    [repo, intentar],
  )

  const actualizar = useCallback(
    (m: Movimiento) =>
      intentar(async () => {
        await repo.actualizarMovimiento(m)
        setMovimientos((prev) => prev.map((x) => (x.id === m.id ? m : x)))
        return m
      }),
    [repo, intentar],
  )

  const borrar = useCallback(
    (id: string) =>
      intentar(async () => {
        await repo.borrarMovimiento(id)
        setMovimientos((prev) => prev.filter((x) => x.id !== id))
        return id
      }),
    [repo, intentar],
  )

  const crearNota = useCallback(
    (n: NuevaNota) =>
      intentar(async () => {
        const nueva = await repo.crearNota(n)
        setNotas((prev) => [...prev, nueva])
        return nueva
      }),
    [repo, intentar],
  )

  const actualizarNota = useCallback(
    (n: Nota) =>
      intentar(async () => {
        await repo.actualizarNota(n)
        setNotas((prev) => prev.map((x) => (x.id === n.id ? n : x)))
        return n
      }),
    [repo, intentar],
  )

  const borrarNota = useCallback(
    (id: string) =>
      intentar(async () => {
        await repo.borrarNota(id)
        setNotas((prev) => prev.filter((x) => x.id !== id))
        return id
      }),
    [repo, intentar],
  )

  const guardarPatrimonio = useCallback(
    (p: Omit<Patrimonio, 'actualizado'>) =>
      intentar(async () => {
        const guardado = await repo.guardarPatrimonio(p)
        setPatrimonio(guardado)
        return guardado
      }),
    [repo, intentar],
  )

  const crearPartida = useCallback(
    (p: NuevaPartida) =>
      intentar(async () => {
        const nueva = await repo.crearPartida(p)
        setPartidas((prev) => [...prev, nueva])
        return nueva
      }),
    [repo, intentar],
  )

  const actualizarPartida = useCallback(
    (p: Partida) =>
      intentar(async () => {
        await repo.actualizarPartida(p)
        setPartidas((prev) => prev.map((x) => (x.id === p.id ? p : x)))
        return p
      }),
    [repo, intentar],
  )

  const borrarPartida = useCallback(
    (id: string) =>
      intentar(async () => {
        await repo.borrarPartida(id)
        setPartidas((prev) => prev.filter((x) => x.id !== id))
        setMovimientos((prev) => prev.map((m) => (m.tipo === 'gasto' && m.partida === id ? { ...m, partida: null } : m)))
        return id
      }),
    [repo, intentar],
  )

  /** Ajusta el saldo de una cuenta en un mes (si ya se había apuntado) y recarga los meses. */
  const ajustarSaldo = useCallback(
    async (mes: string, cuenta: string, delta: number) => {
      try {
        await repo.ajustarSaldo(mes, cuenta, delta)
        setMeses(await repo.listarMeses())
      } catch {
        setError('Guardado, pero no se pudo actualizar el saldo de la cuenta.')
      }
    },
    [repo],
  )

  /** Apunta un gasto y, si sale de una cuenta con saldo apuntado, se lo resta. */
  const apuntarGasto = useCallback(
    async (m: NuevoMovimiento) => {
      const nuevo = await crear(m)
      if (nuevo?.tipo === 'gasto' && nuevo.cuenta) await ajustarSaldo(mesDeFecha(nuevo.fecha, ajustes.diaInicio), nuevo.cuenta, -nuevo.importe)
      return nuevo
    },
    [crear, ajustarSaldo, ajustes.diaInicio],
  )

  /** Borra un gasto y devuelve su importe a la cuenta de la que salió. */
  const borrarGasto = useCallback(
    async (g: GastoVariable) => {
      const id = await borrar(g.id)
      if (id && g.cuenta) await ajustarSaldo(mesDeFecha(g.fecha, ajustes.diaInicio), g.cuenta, g.importe)
      return id
    },
    [borrar, ajustarSaldo, ajustes.diaInicio],
  )

  /** Marca o desmarca un recibo; al marcarlo, su importe sale de la cuenta de nómina (la primera). */
  const marcarRecibo = useCallback(
    async (mes: string, id: string, llegado: boolean, importe: number) => {
      const hecho = await intentar(async () => {
        await repo.marcarRecibo(mes, id, llegado)
        setRecibos((prev) => marcarReciboPuro(prev, mes, id, llegado))
        return id
      })
      const nomina = ajustes.cuentas[0]
      if (hecho && nomina) await ajustarSaldo(mes, nomina.id, llegado ? -importe : importe)
      return hecho
    },
    [repo, intentar, ajustarSaldo, ajustes.cuentas],
  )

  const guardarAjustes = useCallback(
    (a: Ajustes) =>
      intentar(async () => {
        await repo.guardarAjustes(a)
        setAjustes(a)
        return a
      }),
    [repo, intentar],
  )

  const guardarMes = useCallback(
    (mes: string, datos: DatosMes) =>
      intentar(async () => {
        await repo.guardarMes(mes, datos)
        setMeses((prev) => ({ ...prev, [mes]: datos }))
        return mes
      }),
    [repo, intentar],
  )

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
    movimientos, notas, patrimonio, partidas, recibos, ajustes, meses, cargando, error,
    crear, actualizar, borrar, crearNota, actualizarNota, borrarNota, guardarPatrimonio,
    crearPartida, actualizarPartida, borrarPartida, marcarRecibo,
    apuntarGasto, borrarGasto, guardarAjustes, guardarMes, crearMes,
  }
}
