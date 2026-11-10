import { useEffect, useState, type FormEvent } from 'react'
import { abrirBoveda, CONTRASENA_MINIMA, crearBoveda, type AlmacenBoveda } from '../data/boveda'
import { ContrasenaIncorrecta, type Sobre } from '../data/cifrado'
import type { Repositorio } from '../data/repositorio'

/**
 * Pide la contraseña con la que se cifran los datos en este navegador.
 * La primera vez la crea; después la usa para descifrar lo guardado.
 */
export function Desbloqueo({ almacen, onAbierto }: { almacen: AlmacenBoveda; onAbierto: (r: Repositorio) => void }) {
  const [sobre, setSobre] = useState<Sobre | null | undefined>(undefined)
  const [contrasena, setContrasena] = useState('')
  const [repetida, setRepetida] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    almacen.leer().then(setSobre, () => setError('No se pudieron cargar tus datos. Recarga la página.'))
  }, [almacen])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (sobre === null && contrasena !== repetida) return setError('Las dos contraseñas no coinciden.')
    setOcupado(true)
    setError(null)
    try {
      onAbierto(sobre ? await abrirBoveda(almacen, sobre, contrasena) : await crearBoveda(almacen, contrasena))
    } catch (err) {
      setError(err instanceof ContrasenaIncorrecta ? 'La contraseña no es correcta.' : 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.')
      setOcupado(false)
    }
  }

  if (sobre === undefined) return error ? <p className="estado error" role="alert">{error}</p> : <p className="estado">Cargando…</p>

  const nueva = sobre === null
  return (
    <form className="bienvenida" onSubmit={enviar}>
      <h2>{nueva ? 'Elige una contraseña para cifrar tus datos' : 'Desbloquea tus datos'}</h2>
      <p className="sub">
        {nueva
          ? 'Tus datos se cifran en este dispositivo antes de guardarse. Nadie más puede leerlos, ni siquiera quien gestiona la app. Si la olvidas, no hay forma de recuperarlos.'
          : 'Tus datos están cifrados. Escribe tu contraseña para verlos en este dispositivo.'}
      </p>
      <label className="campo">Contraseña
        <input type="password" autoComplete={nueva ? 'new-password' : 'current-password'} minLength={nueva ? CONTRASENA_MINIMA : undefined} value={contrasena} onChange={(e) => setContrasena(e.target.value)} required autoFocus />
      </label>
      {nueva && (
        <label className="campo">Repite la contraseña
          <input type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} required />
        </label>
      )}
      {error && <p className="aviso" role="alert">{error}</p>}
      <div>
        <button className="btn primario" type="submit" disabled={ocupado}>
          {ocupado ? 'Descifrando…' : nueva ? 'Cifrar mis datos' : 'Desbloquear'}
        </button>
      </div>
    </form>
  )
}
