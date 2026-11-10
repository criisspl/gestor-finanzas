import { useState, type FormEvent } from 'react'
import { gastadoEn, nivelPartida, ordenarPartidas, repartoMes } from '../domain/partidas.ts'
import { parsearImporte } from '../domain/formato.ts'
import type { Cuenta, GastoVariable, NuevaPartida, Partida } from '../domain/tipos.ts'
import { BotonBorrar } from './BotonBorrar'
import { Importe } from './Importe'

// Las partidas no tienen categoría: se reparten los colores de la paleta en orden
const COLORES = ['alquiler', 'esencial', 'ocio', 'inversion', 'otros'] as const
const color = (i: number) => `var(--c-${COLORES[i % COLORES.length]})`

interface Props {
  mes: string
  /** Solo las partidas de este mes. */
  partidas: Partida[]
  gastos: GastoVariable[]
  ingreso: number
  diaInicio: number
  cuentas: Cuenta[]
  onCrear: (p: NuevaPartida) => Promise<unknown>
  onActualizar: (p: Partida) => Promise<unknown>
  onBorrar: (id: string) => Promise<unknown>
}

/** Cómo se reparte la nómina del mes en partidas y cuánto llevas gastado en cada una. */
export function Reparto({ mes, partidas, gastos, ingreso, diaInicio, cuentas, onCrear, onActualizar, onBorrar }: Props) {
  const [editando, setEditando] = useState<string | 'nueva' | null>(null)
  const ordenadas = ordenarPartidas(partidas)
  const r = repartoMes(ordenadas, gastos, ingreso, diaInicio)
  const base = Math.max(ingreso, r.asignado) || 1

  return (
    <section aria-labelledby="t-reparto">
      <div className="head"><h2 id="t-reparto">Reparto de la nómina</h2></div>
      <p className="sub ajustado">Divide lo que cobras en partidas con su presupuesto. Las variables cuentan solo lo que apuntas; las fijas cuentan el presupuesto entero.</p>

      {!!ordenadas.length && (
        <>
          <div className="barra" role="img" aria-label="Reparto de la nómina en partidas">
            {ordenadas.map((p, i) => (
              <span key={p.id} title={p.nombre} style={{ width: `${(p.importe / base) * 100}%`, background: color(i) }} />
            ))}
            {r.sinAsignar > 0 && <span title="Sin asignar" style={{ width: `${(r.sinAsignar / base) * 100}%`, background: 'var(--c-libre)' }} />}
          </div>
          <ul className="leyenda">
            {ordenadas.map((p, i) => (
              <li key={p.id}><i style={{ background: color(i) }} />{p.nombre} <Importe valor={p.importe} /></li>
            ))}
          </ul>
        </>
      )}

      <ul className="lista">
        {ordenadas.map((p, i) => {
          if (editando === p.id) {
            return (
              <li key={p.id}>
                <FormularioPartida inicial={p} cuentas={cuentas} onCancelar={() => setEditando(null)}
                  onGuardar={async (d) => { if (await onActualizar({ ...p, ...d })) setEditando(null) }}
                  onBorrar={async () => { if (await onBorrar(p.id)) setEditando(null) }} />
              </li>
            )
          }
          const gastado = gastadoEn(p, gastos, diaInicio)
          const nivel = nivelPartida(p.importe, gastado)
          const dif = Math.abs(p.importe - gastado)
          return (
            <li key={p.id}>
              <span className="punto" style={{ background: color(i) }} />
              <div>
                <div className="nombre">{p.nombre}</div>
                {p.detalle && <div className="donde">{p.detalle}</div>}
                <div className="donde">
                  Gastado <Importe valor={gastado} /> · {gastado > p.importe ? <>te pasas <Importe valor={dif} className="mal" /></> : <>quedan <Importe valor={dif} /></>}
                  {!p.variable && ' · fija'}
                  {cuentas.find((c) => c.id === p.cuenta) && ` · ${cuentas.find((c) => c.id === p.cuenta)?.nombre}`}
                </div>
              </div>
              <div className="derecha">
                <Importe valor={p.importe} />
                <button type="button" className="icono" onClick={() => setEditando(p.id)}>Editar</button>
              </div>
              <div className="medidor" role="img" aria-label={`${p.nombre}: gastado ${Math.round(p.importe > 0 ? (gastado / p.importe) * 100 : 0)} % del presupuesto`}>
                <span className={nivel === 'ok' ? '' : nivel} style={{ width: `${Math.min(100, p.importe > 0 ? (gastado / p.importe) * 100 : gastado > 0 ? 100 : 0)}%` }} />
              </div>
            </li>
          )
        })}
        {editando === 'nueva' && (
          <li>
            <FormularioPartida cuentas={cuentas} onCancelar={() => setEditando(null)}
              onGuardar={async (d) => {
                const orden = Math.max(0, ...partidas.map((x) => x.orden)) + 1
                if (await onCrear({ ...d, mes, orden })) setEditando(null)
              }} />
          </li>
        )}
        {!ordenadas.length && editando !== 'nueva' && <li><div className="vacio">Aún no has repartido la nómina de este mes.</div></li>}
      </ul>

      {!!ordenadas.length && (
        <dl className="stats">
          <div>
            <dt>{r.sinAsignar < 0 ? 'Asignas de más' : 'Queda sin asignar'}</dt>
            <dd><Importe valor={Math.abs(r.sinAsignar)} className={r.sinAsignar < 0 ? 'mal' : ''} /></dd>
          </div>
          <div>
            <dt>{r.previsto < 0 ? 'Previsto: te faltará' : 'Previsto: te sobrará'}</dt>
            <dd><Importe valor={Math.abs(r.previsto)} className={r.previsto < 0 ? 'mal' : 'bien'} /></dd>
          </div>
        </dl>
      )}
      {editando !== 'nueva' && <button type="button" className="anadir" onClick={() => setEditando('nueva')}>+ Añadir partida</button>}
    </section>
  )
}

interface Datos {
  nombre: string
  detalle: string | null
  importe: number
  variable: boolean
  cuenta: string | null
}

function FormularioPartida({ inicial, cuentas, onGuardar, onCancelar, onBorrar }: {
  inicial?: Partida
  cuentas: Cuenta[]
  onGuardar: (d: Datos) => void
  onCancelar: () => void
  onBorrar?: () => void
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [detalle, setDetalle] = useState(inicial?.detalle ?? '')
  const [importe, setImporte] = useState(inicial ? String(inicial.importe).replace('.', ',') : '')
  const [variable, setVariable] = useState(inicial?.variable ?? true)
  const [cuenta, setCuenta] = useState(inicial?.cuenta ?? '')
  const [aviso, setAviso] = useState<string | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    const n = parsearImporte(importe)
    if (n == null || n <= 0) return setAviso('El presupuesto tiene que ser un número mayor que 0, por ejemplo 250 o 12,50.')
    if (!nombre.trim()) return setAviso('Ponle un nombre.')
    onGuardar({ nombre: nombre.trim(), detalle: detalle.trim() || null, importe: n, variable, cuenta: cuenta || null })
  }

  return (
    <form className="form" onSubmit={enviar}>
      <div className="fila2">
        <label>Nombre
          <input id="pt-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Comida, ocio, ahorro…" autoFocus />
        </label>
        <label>Presupuesto del mes (€)
          <input id="pt-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="250" />
        </label>
      </div>
      <label>Detalle (opcional)
        <input id="pt-detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Qué entra en esta partida" />
      </label>
      {!!cuentas.length && (
        <label>Cuenta a la que se transfiere
          <select id="pt-cuenta" value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
            <option value="">{cuentas[0].nombre} (nómina)</option>
            {cuentas.slice(1).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      )}
      <label className="casilla">
        <input id="pt-variable" type="checkbox" checked={variable} onChange={(e) => setVariable(e.target.checked)} />
        Variable: cuenta solo lo que apuntes (si no, cuenta el presupuesto entero)
      </label>
      {aviso && <p className="aviso" role="alert">{aviso}</p>}
      <div className="acciones">
        <div className="grupo">
          <button className="btn primario" type="submit">Guardar</button>
          <button className="btn suave" type="button" onClick={onCancelar}>Cancelar</button>
        </div>
        {onBorrar && <BotonBorrar className="btn peligro" nombre={inicial?.nombre} onBorrar={onBorrar} />}
      </div>
    </form>
  )
}
