import { nombreMes } from '../domain/formato.ts'

interface Props {
  meses: string[]
  activo: string
  /** Mes que se crearía con «Adelantar». */
  siguiente: string
  onElegir: (mes: string) => void
  onAdelantar: () => Promise<unknown>
}

/** Una pestaña por mes de nómina y el botón para adelantar el siguiente. */
export function Pestanas({ meses, activo, siguiente, onElegir, onAdelantar }: Props) {
  return (
    <div className="pestanas-caja">
      <div className="pestanas" role="tablist" aria-label="Meses de nómina">
        {meses.map((m) => (
          <button key={m} type="button" role="tab" aria-selected={m === activo} onClick={() => onElegir(m)}>{nombreMes(m)}</button>
        ))}
      </div>
      <button type="button" className="anadir" onClick={onAdelantar}>+ Adelantar {nombreMes(siguiente).toLowerCase()}</button>
    </div>
  )
}
