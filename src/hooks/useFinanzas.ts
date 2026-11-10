import { useCallback, useEffect, useState } from 'react'
import type { Repositorio } from '../data/repositorio'
import { PATRIMONIO_VACIO } from '../data/repositorio'
import type { Movimiento, Nota, NuevaNota, NuevoMovimiento, Patrimonio } from '../domain/tipos'

/** Carga los datos de la persona y expone las operaciones para cambiarlos. */
export function useFinanzas(repo: Repositorio) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [notas, setNotas] = useState<Nota[]>([])
  const [patrimonio, setPatrimonio] = useState<Patrimonio>(PATRIMONIO_VACIO)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    Promise.all([repo.listarMovimientos(), repo.listarNotas(), repo.leerPatrimonio()])
      .then(([m, n, p]) => {
        if (!vigente) return
        setMovimientos(m)
        setNotas(n)
        setPatrimonio(p)
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

  return { movimientos, notas, patrimonio, cargando, error, crear, actualizar, borrar, crearNota, actualizarNota, borrarNota, guardarPatrimonio }
}
