import type { ResumenMes } from '../domain/reglas'
import { NOMBRE_CORTO, type Categoria } from '../domain/tipos'
import { nombreMes } from '../domain/formato'
import { Importe } from './Importe'

const PARTES: Categoria[] = ['alquiler', 'esencial', 'ocio', 'otros', 'inversion']

interface Props {
  resumen: ResumenMes
  mes: string
}

export function Resumen({ resumen: r, mes }: Props) {
  const base = Math.max(r.ingreso, r.gastado + r.invertido) || 1
  return (
    <section aria-labelledby="t-resumen">
      <div className="head">
        <h2 id="t-resumen">Tu mes</h2>
        <span className="mes-nombre" aria-live="polite">{nombreMes(mes)}</span>
      </div>

      <dl className="stats">
        <div><dt>Ingresos</dt><dd><Importe valor={r.ingreso} /></dd></div>
        <div><dt>Gastado</dt><dd><Importe valor={r.gastado} /></dd></div>
        <div><dt>Invertido</dt><dd><Importe valor={r.invertido} /></dd></div>
        <div>
          <dt>{r.queda < 0 ? 'Te faltan' : 'Te queda para ahorrar'}</dt>
          <dd><Importe valor={Math.abs(r.queda)} className={r.queda < 0 ? 'mal' : 'bien'} /></dd>
        </div>
      </dl>

      <div className="barra" role="img" aria-label="Reparto del ingreso del mes">
        {PARTES.map((c) => (
          <span key={c} title={NOMBRE_CORTO[c]} style={{ width: `${(r.porCategoria[c] / base) * 100}%`, background: `var(--c-${c})` }} />
        ))}
        {r.queda > 0 && <span title="Sin gastar" style={{ width: `${(r.queda / base) * 100}%`, background: 'var(--c-libre)' }} />}
      </div>
      <ul className="leyenda">
        {PARTES.filter((c) => r.porCategoria[c] > 0).map((c) => (
          <li key={c}>
            <i style={{ background: `var(--c-${c})` }} />
            {NOMBRE_CORTO[c]} <Importe valor={r.porCategoria[c]} />
          </li>
        ))}
      </ul>
    </section>
  )
}
