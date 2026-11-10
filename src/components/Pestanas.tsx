import { nombreMes } from '../domain/formato.ts'

interface Props {
  meses: string[]
  activo: string
  /** Mes que se crearía con «Adelantar». */
  siguiente: string
  onElegir: (mes: string) => void
  onAdelantar: () => Promise<unknown>
}

/** Un botón por mes de nómina (navegación, no pestañas: debajo no hay paneles distintos) y el botón para adelantar el siguiente. */
export function Pestanas({ meses, activo, siguiente, onElegir, onAdelantar }: Props) {
  return (
    <div className="pestanas-caja">
      <nav className="pestanas" aria-label="Meses de nómina">
        {meses.map((m) => (
          <button key={m} type="button" aria-current={m === activo ? 'true' : undefined} onClick={() => onElegir(m)}>{nombreMes(m)}</button>
        ))}
      </nav>
      <button type="button" className="anadir" onClick={onAdelantar}>+ Adelantar {nombreMes(siguiente).toLowerCase()}</button>
    </div>
  )
}
