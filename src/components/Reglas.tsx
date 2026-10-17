import type { Regla } from '../domain/reglas'
import { Importe } from './Importe'

export function Reglas({ reglas }: { reglas: Regla[] }) {
  return (
    <section aria-labelledby="t-reglas">
      <div className="head"><h2 id="t-reglas">Las 6 reglas de dinero</h2></div>
      <ol className="reglas">
        {reglas.map((r, i) => (
          <li key={r.id} className="regla">
            <div className="fila">
              <span><span className="n">{i + 1}</span><span className="nombre">{r.titulo}</span></span>
              <span className={`pill ${r.nivel}`}>{r.estado}</span>
            </div>
            <div className="fila cifras">
              <span>Deberías: <b><Importe valor={r.objetivo} /></b></span>
              <span>{r.etiquetaActual}: <b><Importe valor={r.actual} /></b></span>
            </div>
            <div className="medidor" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, r.progreso) * 100)} aria-label={r.titulo}>
              <span className={r.nivel} style={{ width: `${Math.min(100, Math.max(0, r.progreso * 100))}%` }} />
            </div>
            <p className="explicacion">{r.detalle}. {r.explicacion}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
