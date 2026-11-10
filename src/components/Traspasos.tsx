import type { PlanTraspasos, Traspaso } from '../domain/cierre.ts'
import { Importe } from './Importe'

const detalle = (t: Traspaso) => (t.partidas.length ? `Para: ${t.partidas.map((p) => p.nombre).join(' · ')}` : 'Nada este mes')

/** Ya cobrada la nómina: cuánto transferir a cada cuenta y cuánto se queda en la de nómina. */
export function Traspasos({ plan, nomina, arrastre }: { plan: PlanTraspasos; nomina: number; arrastre: number }) {
  return (
    <section aria-labelledby="t-traspasos">
      <div className="head"><h2 id="t-traspasos">Ya has cobrado: transfiere esto a cada cuenta</h2></div>
      <ul className="lista simple">
        <li>
          <div>
            <div className="nombre">Te llega a {plan.seQueda.cuenta.nombre}</div>
            <div className="donde">Nómina <Importe valor={nomina} />{arrastre !== 0 && <> + sobrante <Importe valor={arrastre} /></>}</div>
          </div>
          <Importe valor={plan.disponible} />
        </li>
        {plan.transferir.map((t) => (
          <li key={t.cuenta.id}>
            <div><div className="nombre">Transfiere a {t.cuenta.nombre}</div><div className="donde">{detalle(t)}</div></div>
            <Importe valor={t.total} />
          </li>
        ))}
        <li>
          <div>
            <div className="nombre">Se queda en {plan.seQueda.cuenta.nombre}</div>
            <div className="donde">{detalle(plan.seQueda)}{plan.sinAsignar !== 0 && <> · sin asignar <Importe valor={plan.sinAsignar} /></>}</div>
          </div>
          <Importe valor={plan.seQueda.total} />
        </li>
      </ul>
      {plan.sinAsignar < 0 && <p className="aviso" role="alert">Ojo: las partidas suman más que la nómina, revisa el reparto.</p>}
    </section>
  )
}
