import { pendientesPago, reciboLlegado } from '../domain/partidas.ts'
import { nombreMes } from '../domain/formato.ts'
import type { GastoFijo, Recibos } from '../domain/tipos.ts'
import { NOMBRE_CORTO } from '../domain/tipos.ts'
import { Importe } from './Importe'

interface Props {
  fijos: GastoFijo[]
  recibos: Recibos
  mes: string
  onMarcar: (mes: string, id: string, llegado: boolean, importe: number) => Promise<unknown>
}

/** Casilla «ha llegado» de cada gasto fijo del mes y lo que falta por pagar. */
export function RecibosDelMes({ fijos, recibos, mes, onMarcar }: Props) {
  if (!fijos.length) return null
  const { pendientes, total } = pendientesPago(fijos, recibos, mes)

  return (
    <section aria-labelledby="t-recibos">
      <div className="head"><h2 id="t-recibos">Lo que falta por pagar</h2></div>
      <p className="sub ajustado">Marca cada recibo fijo cuando llegue en {nombreMes(mes).toLowerCase()}.</p>
      <ul className="lista">
        {fijos.map((f) => {
          const llegado = reciboLlegado(recibos, mes, f.id)
          return (
            <li key={f.id} className={llegado ? 'hecho' : ''}>
              <input id={`recibo-${f.id}`} type="checkbox" checked={llegado} onChange={(e) => onMarcar(mes, f.id, e.target.checked, f.importe)} />
              <label htmlFor={`recibo-${f.id}`}>
                <span className="nombre">{f.nombre}</span>
                <span className="donde">{NOMBRE_CORTO[f.categoria]} · {llegado ? 'ha llegado' : 'pendiente'}</span>
              </label>
              <Importe valor={f.importe} />
            </li>
          )
        })}
      </ul>
      <div className="total">
        <span>{pendientes.length ? `Falta por pagar (${pendientes.length})` : 'Todo pagado este mes'}</span>
        <Importe valor={total} />
      </div>
    </section>
  )
}
