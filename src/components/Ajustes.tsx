import { useState, type FormEvent } from 'react'
import { diaInicioValido } from '../domain/ciclo.ts'
import type { Ajustes as DatosAjustes } from '../domain/tipos.ts'
import { BotonBorrar } from './BotonBorrar'
import { CopiaDatos, type OrigenDatos } from './CopiaDatos.tsx'

/** Día en que empieza cada nómina y nombres de las cuentas. La primera cuenta es la de la nómina. */
export function Ajustes({ ajustes, onGuardar, onCambiarAlmacenamiento, origen, onImportado }: {
  ajustes: DatosAjustes
  onGuardar: (a: DatosAjustes) => Promise<unknown>
  onCambiarAlmacenamiento: () => void
  origen: OrigenDatos
  /** Se han sustituido los datos: hay que volver a abrir la bóveda. */
  onImportado: () => void
}) {
  const [dia, setDia] = useState(String(ajustes.diaInicio))
  const [nueva, setNueva] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)

  async function guardarDia(e: FormEvent) {
    e.preventDefault()
    const n = Number(dia)
    if (!diaInicioValido(n)) return setAviso('El día de inicio tiene que ser un número de 1 a 28.')
    setAviso(null)
    await onGuardar({ ...ajustes, diaInicio: n })
  }

  async function anadir(e: FormEvent) {
    e.preventDefault()
    if (!nueva.trim()) return setAviso('Ponle un nombre a la cuenta.')
    setAviso(null)
    if (await onGuardar({ ...ajustes, cuentas: [...ajustes.cuentas, { id: crypto.randomUUID(), nombre: nueva.trim() }] })) setNueva('')
  }

  return (
    <section aria-labelledby="t-ajustes">
      <div className="head"><h2 id="t-ajustes">Ajustes</h2></div>
      <form className="form" onSubmit={guardarDia}>
        <label>Día en que empieza cada nómina (1 a 28)
          <input id="aj-dia" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} />
        </label>
        <div className="acciones"><button className="btn suave" type="submit">Guardar día</button></div>
      </form>
      <p className="sub">Cuentas. La primera es la de la nómina.</p>
      <ul className="lista simple">
        {ajustes.cuentas.map((c, i) => (
          <li key={c.id}>
            <div className="nombre">{c.nombre}{i === 0 && ' (nómina)'}</div>
            <BotonBorrar nombre={`la cuenta ${c.nombre}`} onBorrar={() => onGuardar({ ...ajustes, cuentas: ajustes.cuentas.filter((x) => x.id !== c.id) })} />
          </li>
        ))}
        {!ajustes.cuentas.length && <li><div className="vacio">Aún no tienes cuentas.</div></li>}
      </ul>
      <form className="form" onSubmit={anadir}>
        <label>Nueva cuenta
          <input id="aj-cuenta" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Cuenta nómina, ahorro…" />
        </label>
        {aviso && <p className="aviso" role="alert">{aviso}</p>}
        <div className="acciones"><button className="btn suave" type="submit">+ Añadir cuenta</button></div>
      </form>
      <p className="sub">Almacenamiento. Elige dónde se guardan tus datos; los que ya tienes no se mueven solos.</p>
      <div className="acciones"><button className="btn suave" type="button" onClick={onCambiarAlmacenamiento}>Cambiar dónde se guardan</button></div>
      <CopiaDatos origen={origen} onImportado={onImportado} />
    </section>
  )
}
