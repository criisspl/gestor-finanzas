/** Minutos sin actividad tras los que se bloquea la bóveda. Fijo: configurarlo exigiría tocar el formato de los ajustes cifrados. */
export const MINUTOS_INACTIVIDAD = 10

export const EVENTOS_ACTIVIDAD = ['pointerdown', 'pointermove', 'mousedown', 'keydown', 'touchstart', 'wheel'] as const

/** Lo mínimo que hace falta de `document`: se inyecta para poder probarlo sin navegador. */
type Documento = EventTarget & { readonly visibilityState: string }

/**
 * Llama a `alBloquear` una sola vez cuando pasan `ms` sin actividad, o cuando la pestaña vuelve a
 * estar visible habiendo pasado ese tiempo (los temporizadores de una pestaña oculta no son fiables,
 * por eso se compara con la hora). Devuelve la función que quita todo lo registrado.
 */
export function vigilarInactividad(opciones: {
  ms: number
  alBloquear: () => void
  ventana: EventTarget
  documento: Documento
  ahora?: () => number
}): () => void {
  const { ms, alBloquear, ventana, documento, ahora = Date.now } = opciones
  let ultima = ahora()
  let temporizador: ReturnType<typeof setTimeout> | undefined
  let bloqueado = false

  const bloquear = () => {
    if (bloqueado) return
    bloqueado = true
    clearTimeout(temporizador)
    alBloquear()
  }
  const programar = (espera: number) => {
    temporizador = setTimeout(comprobar, espera)
  }
  function comprobar() {
    const transcurrido = ahora() - ultima
    if (transcurrido >= ms) bloquear()
    else programar(ms - transcurrido)
  }

  const alHaberActividad = () => {
    // Si la pestaña estuvo oculta más de `ms`, la actividad no la salva: ya tocaba bloquear
    if (ahora() - ultima >= ms) return bloquear()
    ultima = ahora()
  }
  const alCambiarVisibilidad = () => {
    if (documento.visibilityState === 'visible') comprobar()
  }

  for (const evento of EVENTOS_ACTIVIDAD) ventana.addEventListener(evento, alHaberActividad, { passive: true })
  documento.addEventListener('visibilitychange', alCambiarVisibilidad)
  programar(ms)

  return () => {
    clearTimeout(temporizador)
    for (const evento of EVENTOS_ACTIVIDAD) ventana.removeEventListener(evento, alHaberActividad)
    documento.removeEventListener('visibilitychange', alCambiarVisibilidad)
  }
}
