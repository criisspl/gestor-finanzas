import { useState, type FormEvent } from 'react'
import { ConflictoBoveda, CONTRASENA_MINIMA } from '../data/boveda'
import { ContrasenaIncorrecta } from '../data/cifrado'

/** Cambia la contraseña con la que se cifran los datos. Todo ocurre en este navegador: las contraseñas no se guardan ni se envían. */
export function CambiarContrasena({ onCambiar }: { onCambiar: (actual: string, nueva: string) => Promise<void> }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setHecho(false)
    if (nueva.length < CONTRASENA_MINIMA) return setAviso(`La contraseña nueva tiene que tener al menos ${CONTRASENA_MINIMA} caracteres.`)
    if (nueva !== repetida) return setAviso('Las dos contraseñas nuevas no coinciden.')
    setOcupado(true)
    setAviso(null)
    try {
      await onCambiar(actual, nueva)
      setActual('')
      setNueva('')
      setRepetida('')
      setHecho(true)
    } catch (err) {
      setAviso(
        err instanceof ContrasenaIncorrecta
          ? 'La contraseña actual no es correcta.'
          : err instanceof ConflictoBoveda
            ? 'Hay cambios guardados desde otro dispositivo. Recarga la página y vuelve a intentarlo; la contraseña no ha cambiado.'
            : 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo; la contraseña no ha cambiado.',
      )
    }
    setOcupado(false)
  }

  return (
    <section aria-labelledby="t-contrasena">
      <div className="head"><h2 id="t-contrasena">Contraseña</h2></div>
      <p className="sub">Se cifra todo de nuevo en este dispositivo. Si la olvidas, no hay forma de recuperar los datos.</p>
      <form className="form" onSubmit={enviar}>
        <label>Contraseña actual
          <input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required />
        </label>
        <label>Contraseña nueva
          <input type="password" autoComplete="new-password" minLength={CONTRASENA_MINIMA} value={nueva} onChange={(e) => setNueva(e.target.value)} required />
        </label>
        <label>Repite la contraseña nueva
          <input type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} required />
        </label>
        {aviso && <p className="aviso" role="alert">{aviso}</p>}
        {hecho && <p className="sub" role="status">Contraseña cambiada.</p>}
        <div className="acciones"><button className="btn suave" type="submit" disabled={ocupado}>{ocupado ? 'Cifrando…' : 'Cambiar contraseña'}</button></div>
      </form>
    </section>
  )
}
