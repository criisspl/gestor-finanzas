import { useState, type FormEvent } from 'react'
import type { AlmacenBoveda } from '../data/boveda.ts'
import { descargarFichero, leerTexto, nombreCopia } from '../data/descarga.ts'
import { copiaDeSobre, explicarError, fuenteDeFichero, migrar, TAMANO_MAXIMO_FICHERO } from '../data/migracion.ts'

/**
 * Lleva a `almacen` los datos de un fichero exportado. La contraseña del fichero se usa en memoria y no se guarda.
 * `sustituye`: el almacén ya tiene datos; hay que confirmar y antes se descarga una copia de lo que hay.
 * Los datos nuevos quedan cifrados con la contraseña del fichero.
 */
export function ImportarFichero({ almacen, sustituye, onImportado }: {
  almacen: AlmacenBoveda
  sustituye: boolean
  onImportado: (contrasena: string) => void | Promise<void>
}) {
  const [fichero, setFichero] = useState<File | null>(null)
  const [contrasena, setContrasena] = useState('')
  const [confirmado, setConfirmado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!fichero) return setError('Elige un fichero.')
    if (fichero.size > TAMANO_MAXIMO_FICHERO) return setError('El fichero es demasiado grande.')
    if (sustituye && !confirmado) return setError('Confirma que quieres sustituir tus datos actuales.')
    setOcupado(true)
    setError(null)
    try {
      await migrar({
        fuente: fuenteDeFichero(await leerTexto(fichero), almacen.usuario),
        destino: almacen,
        contrasena,
        sobrescribir: sustituye,
        // Copia de lo que hay ahora: si no se puede guardar, no se sustituye nada
        copiaPrevia: (sobre) => descargarFichero(nombreCopia('copia-previa'), copiaDeSobre(sobre)),
      })
      await onImportado(contrasena)
    } catch (err) {
      setError(explicarError(err))
      setOcupado(false)
    }
  }

  return (
    <form className="form" onSubmit={enviar}>
      <label>Fichero de copia
        <input type="file" accept="application/json,.json" onChange={(e) => setFichero(e.target.files?.[0] ?? null)} />
      </label>
      <label>Contraseña del fichero
        <input type="password" autoComplete="off" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
      </label>
      {sustituye && (
        <>
          <p className="nota-demo">
            Se <b>sustituyen</b> los datos que tienes ahora y tu contraseña pasa a ser la del fichero. Antes se descarga una copia de lo actual; guárdala.
          </p>
          <label className="opcion">
            <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
            <span>Entiendo que se sustituyen mis datos actuales</span>
          </label>
        </>
      )}
      {error && <p className="aviso" role="alert">{error}</p>}
      <div className="acciones">
        <button className="btn suave" type="submit" disabled={ocupado}>{ocupado ? 'Importando…' : 'Importar copia'}</button>
      </div>
    </form>
  )
}
