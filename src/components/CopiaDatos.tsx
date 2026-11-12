import { useState, type FormEvent } from 'react'
import { CONTRASENA_MINIMA, type AlmacenBoveda } from '../data/boveda.ts'
import { leerEstadoDemo } from '../data/demo.ts'
import { descargarFichero, nombreCopia } from '../data/descarga.ts'
import { explicarError, exportarFichero, fuenteDeAlmacen, fuenteEnClaro } from '../data/migracion.ts'
import { ImportarFichero } from './ImportarFichero.tsx'

/** De dónde se exporta: una bóveda abierta, o los datos de ejemplo (que no tienen contraseña). */
export type OrigenDatos = { modo: 'boveda'; almacen: AlmacenBoveda } | { modo: 'demo' }

/**
 * Cambiar de proveedor sin perder datos: se exporta una copia cifrada, se elige el nuevo proveedor (Cambiar dónde se guardan)
 * y allí se importa. Desde el modo de ejemplo también se exporta, con una contraseña nueva.
 */
export function CopiaDatos({ origen, onImportado }: { origen: OrigenDatos; onImportado: () => void }) {
  const [contrasena, setContrasena] = useState('')
  const [repetida, setRepetida] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  const demo = origen.modo === 'demo'

  async function exportar(e: FormEvent) {
    e.preventDefault()
    setHecho(false)
    if (demo && contrasena.length < CONTRASENA_MINIMA) return setError(`La contraseña tiene que tener al menos ${CONTRASENA_MINIMA} caracteres.`)
    if (demo && contrasena !== repetida) return setError('Las dos contraseñas no coinciden.')
    setOcupado(true)
    setError(null)
    try {
      const fuente = origen.modo === 'boveda' ? fuenteDeAlmacen(origen.almacen) : fuenteEnClaro(leerEstadoDemo)
      descargarFichero(nombreCopia('copia'), await exportarFichero(await fuente.leerEstado(contrasena), contrasena))
      setHecho(true)
      setContrasena('')
      setRepetida('')
    } catch (err) {
      setError(explicarError(err))
    }
    setOcupado(false)
  }

  return (
    <>
      <p className="sub">Cambiar de proveedor. Descarga una copia cifrada, elige el nuevo sitio con «Cambiar dónde se guardan» e impórtala allí. Tus datos de ahora no se borran.</p>
      <form className="form" onSubmit={exportar}>
        <label>{demo ? 'Contraseña nueva para cifrar la copia' : 'Tu contraseña'}
          <input id="copia-contrasena" type="password" autoComplete={demo ? 'new-password' : 'current-password'} value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
        </label>
        {demo && (
          <label>Repite la contraseña
            <input type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} required />
          </label>
        )}
        {error && <p className="aviso" role="alert">{error}</p>}
        {hecho && <p className="sub" role="status">Copia descargada. Guárdala con su contraseña: sin ella no se puede abrir.</p>}
        <div className="acciones"><button className="btn suave" type="submit" disabled={ocupado}>{ocupado ? 'Preparando…' : 'Descargar copia cifrada'}</button></div>
      </form>
      {origen.modo === 'boveda' && (
        <>
          <p className="sub">Importar una copia aquí. Sustituye los datos de esta bóveda.</p>
          <ImportarFichero almacen={origen.almacen} sustituye onImportado={onImportado} />
        </>
      )}
    </>
  )
}
