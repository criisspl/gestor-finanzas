import { useEffect, useRef } from 'react'
import { MINUTOS_INACTIVIDAD, vigilarInactividad } from '../domain/inactividad.ts'

/** Mientras `activo`, llama a `alBloquear` tras el tiempo de inactividad. Sin bóveda abierta (demo, bloqueada) no hace nada. */
export function useBloqueoInactividad(activo: boolean, alBloquear: () => void) {
  // Siempre la última versión, sin reiniciar el temporizador en cada render
  const ultimo = useRef(alBloquear)
  useEffect(() => {
    ultimo.current = alBloquear
  })

  useEffect(() => {
    if (!activo) return
    return vigilarInactividad({ ms: MINUTOS_INACTIVIDAD * 60_000, alBloquear: () => ultimo.current(), ventana: window, documento: document })
  }, [activo])
}
