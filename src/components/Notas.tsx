import { useState, type FormEvent } from 'react'
import { BotonBorrar } from './BotonBorrar'
import { NOMBRE_TIPO_NOTA, TIPOS_NOTA, type Nota, type NuevaNota, type TipoNota } from '../domain/tipos'

interface Props {
  notas: Nota[]
  onCrear: (n: NuevaNota) => Promise<unknown>
  onActualizar: (n: Nota) => Promise<unknown>
  onBorrar: (id: string) => Promise<unknown>
}

/** Notas libres con color: recordatorios y avisos para uno mismo. Van dentro de la bóveda cifrada. */
export function Notas(p: Props) {
  const [editando, setEditando] = useState<string | 'nueva' | null>(null)

  return (
    <section aria-labelledby="t-notas">
      <div className="head"><h2 id="t-notas">Notas</h2></div>
      <div className="notas">
        {p.notas.map((n) =>
          editando === n.id ? (
            <FormularioNota key={n.id} inicial={n} onCancelar={() => setEditando(null)}
              onGuardar={async (d) => { if (await p.onActualizar({ ...n, ...d })) setEditando(null) }}
              onBorrar={async () => { if (await p.onBorrar(n.id)) setEditando(null) }} />
          ) : (
            <div key={n.id} className={`note ${n.tipo}`}>
              <div>{n.titulo && <b>{n.titulo} </b>}{n.texto}</div>
              <button type="button" className="icono" onClick={() => setEditando(n.id)}>Editar</button>
            </div>
          ),
        )}
        {editando === 'nueva' && (
          <FormularioNota onCancelar={() => setEditando(null)}
            onGuardar={async (d) => { if (await p.onCrear(d)) setEditando(null) }} />
        )}
        {!p.notas.length && editando !== 'nueva' && <p className="vacio con-borde">Sin notas todavía.</p>}
      </div>
      {editando !== 'nueva' && <button type="button" className="anadir" onClick={() => setEditando('nueva')}>+ Añadir nota</button>}
    </section>
  )
}

function FormularioNota({ inicial, onGuardar, onCancelar, onBorrar }: {
  inicial?: Nota
  onGuardar: (d: NuevaNota) => void
  onCancelar: () => void
  onBorrar?: () => void
}) {
  const [tipo, setTipo] = useState<TipoNota>(inicial?.tipo ?? 'ok')
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [texto, setTexto] = useState(inicial?.texto ?? '')
  const [aviso, setAviso] = useState<string | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return setAviso('Escribe el texto de la nota.')
    onGuardar({ tipo, titulo: titulo.trim() || null, texto: texto.trim() })
  }

  return (
    <form className="form" onSubmit={enviar}>
      <div className="fila2">
        <label>Tipo
          <select id="n-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoNota)}>
            {TIPOS_NOTA.map((t) => <option key={t} value={t}>{NOMBRE_TIPO_NOTA[t]}</option>)}
          </select>
        </label>
        <label>Título (opcional)
          <input id="n-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </label>
      </div>
      <label>Texto
        <textarea id="n-texto" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
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
