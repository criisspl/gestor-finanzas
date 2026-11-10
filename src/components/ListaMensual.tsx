import { useState, type FormEvent } from 'react'
import { CATEGORIAS, NOMBRE_CATEGORIA, NOMBRE_CORTO, type Categoria, type GastoFijo, type Ingreso, type Movimiento, type NuevoMovimiento } from '../domain/tipos'
import { parsearImporte } from '../domain/formato'
import { BotonBorrar } from './BotonBorrar'
import { Importe } from './Importe'

type Item = Ingreso | GastoFijo

interface Props {
  tipo: Item['tipo']
  titulo: string
  subtitulo?: string
  items: Item[]
  textoVacio: string
  textoAnadir: string
  onCrear: (m: NuevoMovimiento) => Promise<unknown>
  onActualizar: (m: Movimiento) => Promise<unknown>
  onBorrar: (id: string) => Promise<unknown>
}

/** Lista editable de importes que se repiten cada mes: ingresos o gastos fijos. */
export function ListaMensual(p: Props) {
  const [editando, setEditando] = useState<string | 'nuevo' | null>(null)
  const total = p.items.reduce((a, i) => a + i.importe, 0)

  return (
    <section aria-labelledby={`t-${p.tipo}`}>
      <div className="head"><h2 id={`t-${p.tipo}`}>{p.titulo}</h2></div>
      {p.subtitulo && <p className="sub ajustado">{p.subtitulo}</p>}
      <ul className={`lista ${p.tipo === 'ingreso' ? 'simple' : ''}`}>
        {p.items.map((i) =>
          editando === i.id ? (
            <li key={i.id}>
              <Formulario tipo={p.tipo} inicial={i} onCancelar={() => setEditando(null)}
                onGuardar={async (d) => { if (await p.onActualizar({ ...i, ...d } as Movimiento)) setEditando(null) }}
                onBorrar={async () => { if (await p.onBorrar(i.id)) setEditando(null) }} />
            </li>
          ) : (
            <li key={i.id}>
              {i.tipo === 'fijo' && <span className="punto" style={{ background: `var(--c-${i.categoria})` }} />}
              <div>
                <div className="nombre">{i.nombre}</div>
                {i.tipo === 'fijo' && <div className="donde">{NOMBRE_CORTO[i.categoria]}</div>}
              </div>
              <div className="derecha">
                <Importe valor={i.importe} />
                <button type="button" className="icono" onClick={() => setEditando(i.id)}>Editar</button>
              </div>
            </li>
          ),
        )}
        {editando === 'nuevo' && (
          <li>
            <Formulario tipo={p.tipo} onCancelar={() => setEditando(null)}
              onGuardar={async (d) => { if (await p.onCrear({ tipo: p.tipo, ...d } as NuevoMovimiento)) setEditando(null) }} />
          </li>
        )}
        {!p.items.length && editando !== 'nuevo' && <li><div className="vacio">{p.textoVacio}</div></li>}
      </ul>
      <div className="total"><span>Total al mes</span><Importe valor={total} /></div>
      {editando !== 'nuevo' && <button type="button" className="anadir" onClick={() => setEditando('nuevo')}>{p.textoAnadir}</button>}
    </section>
  )
}

interface Datos {
  nombre: string
  importe: number
  categoria?: Categoria
}

export function Formulario({ tipo, inicial, onGuardar, onCancelar, onBorrar }: {
  tipo: Item['tipo']
  inicial?: Item
  onGuardar: (d: Datos) => void
  onCancelar?: () => void
  onBorrar?: () => void
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [importe, setImporte] = useState(inicial ? String(inicial.importe).replace('.', ',') : '')
  const [categoria, setCategoria] = useState<Categoria>(inicial?.tipo === 'fijo' ? inicial.categoria : 'esencial')
  const [aviso, setAviso] = useState<string | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    const n = parsearImporte(importe)
    if (n == null || n <= 0) return setAviso('El importe tiene que ser un número mayor que 0, por ejemplo 1.250 o 12,50.')
    if (!nombre.trim()) return setAviso('Ponle un nombre.')
    onGuardar(tipo === 'fijo' ? { nombre: nombre.trim(), importe: n, categoria } : { nombre: nombre.trim(), importe: n })
  }

  return (
    <form className="form" onSubmit={enviar}>
      <div className="fila2">
        <label>Nombre
          <input id={`f-${tipo}-nombre`} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={tipo === 'ingreso' ? 'Nómina, extra…' : 'Alquiler, luz, gimnasio…'} autoFocus />
        </label>
        <label>Importe al mes (€)
          <input id={`f-${tipo}-importe`} inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="1.250" />
        </label>
      </div>
      {tipo === 'fijo' && (
        <label>Tipo
          <select id="f-fijo-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{NOMBRE_CATEGORIA[c]}</option>)}
          </select>
        </label>
      )}
      {aviso && <p className="aviso" role="alert">{aviso}</p>}
      <div className="acciones">
        <div className="grupo">
          <button className="btn primario" type="submit">Guardar</button>
          {onCancelar && <button className="btn suave" type="button" onClick={onCancelar}>Cancelar</button>}
        </div>
        {onBorrar && <BotonBorrar className="btn peligro" nombre={inicial?.nombre} onBorrar={onBorrar} />}
      </div>
    </form>
  )
}
