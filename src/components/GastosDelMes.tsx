import type { Cuenta, GastoVariable, Partida } from '../domain/tipos'
import { NOMBRE_CORTO } from '../domain/tipos'
import { nombreDia, nombreMes } from '../domain/formato'
import { BotonBorrar } from './BotonBorrar'
import { Importe } from './Importe'

interface Props {
  gastos: GastoVariable[]
  partidas: Partida[]
  cuentas: Cuenta[]
  mes: string
  onBorrar: (g: GastoVariable) => void
}

const nombrePartida = (g: GastoVariable, partidas: Partida[]) => partidas.find((p) => p.id === g.partida)?.nombre

export function GastosDelMes({ gastos, partidas, cuentas, mes, onBorrar }: Props) {
  const ordenados = [...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const porDia = new Map<string, GastoVariable[]>()
  for (const g of ordenados) porDia.set(g.fecha, [...(porDia.get(g.fecha) ?? []), g])
  const total = gastos.reduce((a, g) => a + g.importe, 0)

  return (
    <section aria-labelledby="t-gastos">
      <div className="head">
        <h2 id="t-gastos">Apuntado en {nombreMes(mes).toLowerCase()}</h2>
        <Importe valor={total} />
      </div>
      {!gastos.length && <p className="vacio con-borde">Aún no has apuntado gastos variables ni aportaciones este mes.</p>}
      {[...porDia].map(([dia, items]) => (
        <div key={dia}>
          <div className="dia">{nombreDia(dia)}</div>
          <ul className="lista sin-borde">
            {items.map((g) => (
              <li key={g.id}>
                <span className="punto" style={{ background: `var(--c-${g.categoria})` }} />
                <div>
                  <div className="nombre">{g.nombre || NOMBRE_CORTO[g.categoria]}</div>
                  <div className="donde">{NOMBRE_CORTO[g.categoria]}{nombrePartida(g, partidas) && ` · ${nombrePartida(g, partidas)}`}{cuentas.find((c) => c.id === g.cuenta) && ` · ${cuentas.find((c) => c.id === g.cuenta)?.nombre}`}</div>
                </div>
                <div className="derecha">
                  <Importe valor={g.importe} />
                  <BotonBorrar nombre={g.nombre || NOMBRE_CORTO[g.categoria]} onBorrar={() => onBorrar(g)} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
