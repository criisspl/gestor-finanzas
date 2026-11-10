import { useState, type FormEvent } from 'react'
import { mesDeFecha } from '../domain/ciclo.ts'
import { estaSaldada, pagadoDe, pagosDe, restanteDe, totalesDeudas } from '../domain/deudas.ts'
import { euros, hoy, parsearImporte } from '../domain/formato.ts'
import { ordenarPartidas } from '../domain/partidas.ts'
import {
  NOMBRE_TIPO_NOTA, TIPOS_NOTA,
  type Deuda, type GastoVariable, type NuevaDeuda, type NuevoPagoDeuda, type PagoDeuda, type Partida, type TipoNota,
} from '../domain/tipos.ts'
import { BotonBorrar } from './BotonBorrar'
import { Importe } from './Importe'

const fechaCorta = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

interface Props {
  deudas: Deuda[]
  pagos: PagoDeuda[]
  /** Todas las partidas: al pagar se ofrecen las del mes de la fecha elegida. */
  partidas: Partida[]
  diaInicio: number
  onCrear: (d: NuevaDeuda) => Promise<unknown>
  onActualizar: (d: Deuda) => Promise<unknown>
  onBorrar: (id: string) => Promise<unknown>
  onPagar: (pago: NuevoPagoDeuda, gasto: Omit<GastoVariable, 'id'> | null) => Promise<unknown>
  onBorrarPago: (p: PagoDeuda) => Promise<unknown>
}

/** Lo que debes, con pagos parciales. Si un pago se resta de una partida, también cuenta como gasto de ella. */
export function Deudas(p: Props) {
  // 'nueva' = alta; `d:<id>` = editar; `p:<id>` = pagar
  const [editando, setEditando] = useState<string | null>(null)
  const totales = totalesDeudas(p.deudas, p.pagos)

  return (
    <section aria-labelledby="t-deudas">
      <div className="head"><h2 id="t-deudas">Deudas</h2></div>
      <p className="sub ajustado">Apunta lo que debes y ve restando con cada pago.</p>
      <ul className="lista simple">
        {p.deudas.map((d) => {
          if (editando === `d:${d.id}`) {
            return (
              <li key={d.id}>
                <FormularioDeuda inicial={d} onCancelar={() => setEditando(null)}
                  onGuardar={async (x) => { if (await p.onActualizar({ ...d, ...x })) setEditando(null) }}
                  onBorrar={async () => { if (await p.onBorrar(d.id)) setEditando(null) }} />
              </li>
            )
          }
          const pagado = pagadoDe(d, p.pagos)
          const quedan = restanteDe(d, p.pagos)
          const saldada = estaSaldada(d, p.pagos)
          const historial = pagosDe(d, p.pagos)
          return (
            <li key={d.id}>
              <div>
                <div className="nombre">
                  {d.nombre}{' '}
                  {saldada ? <span className="pill ok">Pagada</span> : d.estado && d.estadoTexto && <span className={`pill ${d.estado}`}>{d.estadoTexto}</span>}
                </div>
                {d.detalle && <div className="donde">{d.detalle}</div>}
                {pagado > 0 && (
                  <div className="donde">
                    Pagado <Importe valor={pagado} /> · {saldada ? 'sin deuda pendiente' : <>quedan <Importe valor={quedan} /></>}
                  </div>
                )}
                {historial.map((x) => (
                  <div key={x.id} className="donde">
                    {fechaCorta(x.fecha)} · {euros(x.importe)} <BotonBorrar onBorrar={() => p.onBorrarPago(x)} />
                  </div>
                ))}
              </div>
              <div className="derecha">
                <Importe valor={d.importe} />
                {!saldada && <button type="button" className="icono" onClick={() => setEditando(`p:${d.id}`)}>Pagar</button>}
                <button type="button" className="icono" onClick={() => setEditando(`d:${d.id}`)}>Editar</button>
              </div>
              {pagado > 0 && (
                <div className="medidor" role="img" aria-label={`${d.nombre}: pagado ${Math.round(Math.min(100, (pagado / d.importe) * 100))} %`}>
                  <span style={{ width: `${Math.min(100, (pagado / d.importe) * 100)}%` }} />
                </div>
              )}
              {editando === `p:${d.id}` && (
                <FormularioPago deuda={d} quedan={quedan} partidas={p.partidas} diaInicio={p.diaInicio} onCancelar={() => setEditando(null)}
                  onGuardar={async (pago, gasto) => { if (await p.onPagar(pago, gasto)) setEditando(null) }} />
              )}
            </li>
          )
        })}
        {editando === 'nueva' && (
          <li>
            <FormularioDeuda onCancelar={() => setEditando(null)}
              onGuardar={async (x) => { if (await p.onCrear(x)) setEditando(null) }} />
          </li>
        )}
        {!p.deudas.length && editando !== 'nueva' && <li><div className="vacio">Sin deudas apuntadas.</div></li>}
      </ul>

      {!!p.deudas.length && (
        <dl className="stats">
          <div><dt>Vencido</dt><dd><Importe valor={totales.vencido} className={totales.vencido > 0 ? 'mal' : ''} /></dd></div>
          <div><dt>Pendiente en total</dt><dd><Importe valor={totales.pendiente} /></dd></div>
        </dl>
      )}
      {editando !== 'nueva' && <button type="button" className="anadir" onClick={() => setEditando('nueva')}>+ Añadir deuda</button>}
    </section>
  )
}

function FormularioDeuda({ inicial, onGuardar, onCancelar, onBorrar }: {
  inicial?: Deuda
  onGuardar: (d: NuevaDeuda) => void
  onCancelar: () => void
  onBorrar?: () => void
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [detalle, setDetalle] = useState(inicial?.detalle ?? '')
  const [importe, setImporte] = useState(inicial ? String(inicial.importe).replace('.', ',') : '')
  const [estado, setEstado] = useState<TipoNota | ''>(inicial?.estado ?? '')
  const [estadoTexto, setEstadoTexto] = useState(inicial?.estadoTexto ?? '')
  const [aviso, setAviso] = useState<string | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    const n = parsearImporte(importe)
    if (n == null || n <= 0) return setAviso('El importe tiene que ser un número mayor que 0, por ejemplo 250 o 12,50.')
    if (!nombre.trim()) return setAviso('Ponle un nombre.')
    onGuardar({
      nombre: nombre.trim(), detalle: detalle.trim() || null, importe: n,
      estado: estado || null, estadoTexto: estado ? estadoTexto.trim() || null : null,
    })
  }

  return (
    <form className="form" onSubmit={enviar}>
      <div className="fila2">
        <label>Nombre
          <input id="d-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </label>
        <label>Importe a devolver (€)
          <input id="d-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="250" />
        </label>
      </div>
      <label>Detalle (opcional)
        <input id="d-detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
      </label>
      <div className="fila2">
        <label>Estado (opcional)
          <select id="d-estado" value={estado} onChange={(e) => setEstado(e.target.value as TipoNota | '')}>
            <option value="">Sin estado</option>
            {TIPOS_NOTA.map((t) => <option key={t} value={t}>{NOMBRE_TIPO_NOTA[t]}</option>)}
          </select>
        </label>
        {estado && (
          <label>Texto del estado
            <input id="d-estado-texto" value={estadoTexto} onChange={(e) => setEstadoTexto(e.target.value)} placeholder="Vence el día 5" />
          </label>
        )}
      </div>
      {aviso && <p className="aviso" role="alert">{aviso}</p>}
      <div className="acciones">
        <div className="grupo">
          <button className="btn primario" type="submit">Guardar</button>
          <button className="btn suave" type="button" onClick={onCancelar}>Cancelar</button>
        </div>
        {onBorrar && <BotonBorrar className="btn peligro" onBorrar={onBorrar} />}
      </div>
    </form>
  )
}

function FormularioPago({ deuda, quedan, partidas, diaInicio, onGuardar, onCancelar }: {
  deuda: Deuda
  quedan: number
  partidas: Partida[]
  diaInicio: number
  onGuardar: (pago: NuevoPagoDeuda, gasto: Omit<GastoVariable, 'id'> | null) => void
  onCancelar: () => void
}) {
  const [importe, setImporte] = useState(String(quedan).replace('.', ','))
  const [fecha, setFecha] = useState(hoy())
  const [partida, setPartida] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const delMes = ordenarPartidas(partidas.filter((x) => x.mes === mesDeFecha(fecha, diaInicio)))
  // Si al cambiar la fecha la partida elegida es de otro mes, se queda sin partida
  const partidaValida = delMes.some((x) => x.id === partida) ? partida : ''

  function enviar(e: FormEvent) {
    e.preventDefault()
    const n = parsearImporte(importe)
    if (n == null || n <= 0) return setAviso('El importe tiene que ser un número mayor que 0, por ejemplo 50 o 12,50.')
    onGuardar(
      { deuda: deuda.id, importe: n, fecha },
      partidaValida ? { tipo: 'gasto', nombre: `Pago: ${deuda.nombre}`, importe: n, categoria: 'otros', fecha, partida: partidaValida } : null,
    )
  }

  return (
    <form className="form" onSubmit={enviar}>
      <div className="fila2">
        <label>Importe pagado (€)
          <input id="pd-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} autoFocus />
        </label>
        <label>Fecha
          <input id="pd-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </label>
      </div>
      <label>Restar de la partida
        <select id="pd-partida" value={partidaValida} onChange={(e) => setPartida(e.target.value)}>
          <option value="">Ninguna (no restar de ninguna partida)</option>
          {delMes.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
      </label>
      {aviso && <p className="aviso" role="alert">{aviso}</p>}
      <div className="acciones">
        <div className="grupo">
          <button className="btn primario" type="submit">Guardar pago</button>
          <button className="btn suave" type="button" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </form>
  )
}
