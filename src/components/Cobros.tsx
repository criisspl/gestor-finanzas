import { useState, type FormEvent } from 'react'
import { cobrosPendientes, totalCobros } from '../domain/deudas.ts'
import { nombreMes, parsearImporte } from '../domain/formato.ts'
import type { Cobro, NuevoCobro } from '../domain/tipos.ts'
import { BotonBorrar } from './BotonBorrar'
import { Importe } from './Importe'

interface Props {
  mes: string
  cobros: Cobro[]
  onCrear: (c: NuevoCobro) => Promise<unknown>
  onActualizar: (c: Cobro) => Promise<unknown>
  onBorrar: (id: string) => Promise<unknown>
  /** Marca el cobro como llegado y lo suma al saldo de la cuenta de nómina. */
  onCobrar: (c: Cobro) => Promise<unknown>
}

/** Dinero que te deben y llegará este mes. «Ya ha llegado» lo marca cobrado y lo suma a la cuenta de nómina. */
export function Cobros({ mes, cobros, onCrear, onActualizar, onBorrar, onCobrar }: Props) {
  const [editando, setEditando] = useState<string | 'nuevo' | null>(null)
  const delMes = cobros.filter((c) => c.mes === mes)
  const pendientes = totalCobros(cobrosPendientes(cobros, mes))

  return (
    <section aria-labelledby="t-cobros">
      <div className="head"><h2 id="t-cobros">Pendiente de cobrar</h2></div>
      <p className="sub ajustado">Dinero que te deben y llegará en {nombreMes(mes).toLowerCase()}.</p>
      <ul className="lista simple">
        {delMes.map((c) =>
          editando === c.id ? (
            <li key={c.id}>
              <FormularioCobro inicial={c} onCancelar={() => setEditando(null)}
                onGuardar={async (d) => { if (await onActualizar({ ...c, ...d })) setEditando(null) }}
                onBorrar={async () => { if (await onBorrar(c.id)) setEditando(null) }} />
            </li>
          ) : (
            <li key={c.id} className={c.cobrado ? 'hecho' : ''}>
              <div>
                <div className="nombre">{c.nombre}</div>
                {c.detalle && <div className="donde">{c.detalle}</div>}
                {c.cobrado && <div className="donde">Cobrado</div>}
              </div>
              <div className="derecha">
                <Importe valor={c.importe} />
                {!c.cobrado && <button type="button" className="icono" onClick={() => onCobrar(c)}>Ya ha llegado</button>}
                <button type="button" className="icono" onClick={() => setEditando(c.id)}>Editar</button>
              </div>
            </li>
          ),
        )}
        {editando === 'nuevo' && (
          <li>
            <FormularioCobro onCancelar={() => setEditando(null)}
              onGuardar={async (d) => { if (await onCrear({ ...d, mes })) setEditando(null) }} />
          </li>
        )}
        {!delMes.length && editando !== 'nuevo' && <li><div className="vacio">Nada pendiente de cobrar este mes.</div></li>}
      </ul>
      {!!delMes.length && (
        <div className="total"><span>Pendiente de cobrar</span><Importe valor={pendientes} /></div>
      )}
      {editando !== 'nuevo' && <button type="button" className="anadir" onClick={() => setEditando('nuevo')}>+ Añadir cobro</button>}
    </section>
  )
}

function FormularioCobro({ inicial, onGuardar, onCancelar, onBorrar }: {
  inicial?: Cobro
  onGuardar: (d: Pick<NuevoCobro, 'nombre' | 'detalle' | 'importe'>) => void
  onCancelar: () => void
  onBorrar?: () => void
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [detalle, setDetalle] = useState(inicial?.detalle ?? '')
  const [importe, setImporte] = useState(inicial ? String(inicial.importe).replace('.', ',') : '')
  const [aviso, setAviso] = useState<string | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    const n = parsearImporte(importe)
    if (n == null || n <= 0) return setAviso('El importe tiene que ser un número mayor que 0, por ejemplo 80 o 12,50.')
    if (!nombre.trim()) return setAviso('Ponle un nombre.')
    onGuardar({ nombre: nombre.trim(), detalle: detalle.trim() || null, importe: n })
  }

  return (
    <form className="form" onSubmit={enviar}>
      <div className="fila2">
        <label>Nombre
          <input id="c-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </label>
        <label>Importe (€)
          <input id="c-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="80" />
        </label>
      </div>
      <label>Detalle (opcional)
        <input id="c-detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
      </label>
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
