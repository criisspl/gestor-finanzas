import { useState, type FormEvent } from 'react'
import type { Patrimonio } from '../domain/tipos'
import { parsearImporte } from '../domain/formato'
import { Importe } from './Importe'

interface Props {
  patrimonio: Patrimonio
  onGuardar: (p: Omit<Patrimonio, 'actualizado'>) => Promise<unknown>
}

export function PatrimonioAcumulado({ patrimonio: p, onGuardar }: Props) {
  const [editando, setEditando] = useState(false)
  const [fondo, setFondo] = useState('')
  const [invertido, setInvertido] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)

  function abrir() {
    setFondo(String(p.fondoEmergencia).replace('.', ','))
    setInvertido(String(p.totalInvertido).replace('.', ','))
    setEditando(true)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const f = parsearImporte(fondo || '0')
    const i = parsearImporte(invertido || '0')
    if (f == null || i == null) return setAviso('Las cantidades tienen que ser números.')
    setAviso(null)
    if (await onGuardar({ fondoEmergencia: f, totalInvertido: i })) setEditando(false)
  }

  const fecha = p.actualizado ? new Date(p.actualizado).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : null

  return (
    <section aria-labelledby="t-patrimonio">
      <div className="head">
        <h2 id="t-patrimonio">Ahorro e inversión acumulados</h2>
        {!editando && <button type="button" className="icono" onClick={abrir}>Editar</button>}
      </div>
      <p className="sub ajustado">Lo que ya tienes guardado. Sirve para las reglas 1 y 4.{fecha && ` Actualizado el ${fecha}.`}</p>
      {editando ? (
        <form className="form" onSubmit={enviar}>
          <div className="fila2">
            <label>Fondo de emergencia (€)<input id="p-fondo" inputMode="decimal" value={fondo} onChange={(e) => setFondo(e.target.value)} /></label>
            <label>Total invertido (€)<input id="p-invertido" inputMode="decimal" value={invertido} onChange={(e) => setInvertido(e.target.value)} /></label>
          </div>
          {aviso && <p className="aviso" role="alert">{aviso}</p>}
          <div className="acciones">
            <div className="grupo">
              <button className="btn primario" type="submit">Guardar</button>
              <button className="btn suave" type="button" onClick={() => setEditando(false)}>Cancelar</button>
            </div>
          </div>
        </form>
      ) : (
        <ul className="lista simple">
          <li><div className="nombre">Fondo de emergencia</div><Importe valor={p.fondoEmergencia} /></li>
          <li><div className="nombre">Total invertido</div><Importe valor={p.totalInvertido} /></li>
        </ul>
      )}
    </section>
  )
}
