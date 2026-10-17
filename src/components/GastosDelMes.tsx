import { useState } from 'react'
import type { GastoVariable } from '../domain/tipos'
import { NOMBRE_CORTO } from '../domain/tipos'
import { nombreDia, nombreMes } from '../domain/formato'
import { Importe } from './Importe'

interface Props {
  gastos: GastoVariable[]
  mes: string
  onBorrar: (id: string) => void
}

export function GastosDelMes({ gastos, mes, onBorrar }: Props) {
  const [confirmando, setConfirmando] = useState<string | null>(null)
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
                  <div className="donde">{NOMBRE_CORTO[g.categoria]}</div>
                </div>
                <div className="derecha">
                  <Importe valor={g.importe} />
                  <button
                    type="button"
                    className={`icono ${confirmando === g.id ? 'seguro' : ''}`}
                    onClick={() => (confirmando === g.id ? onBorrar(g.id) : setConfirmando(g.id))}
                    onBlur={() => setConfirmando(null)}
                  >
                    {confirmando === g.id ? '¿Borrar?' : 'Borrar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
