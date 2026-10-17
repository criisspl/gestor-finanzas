import { useRef, useState, type FormEvent } from 'react'
import { CATEGORIAS, NOMBRE_CATEGORIA, type Categoria, type NuevoMovimiento } from '../domain/tipos'
import { hoy, parsearImporte } from '../domain/formato'

// El alquiler es un gasto fijo: no se ofrece como gasto variable
const OPCIONES = CATEGORIAS.filter((c) => c !== 'alquiler')

interface Props {
  onApuntar: (m: NuevoMovimiento) => Promise<unknown>
}

export function ApuntarGasto({ onApuntar }: Props) {
  const [importe, setImporte] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [categoria, setCategoria] = useState<Categoria>('esencial')
  const [concepto, setConcepto] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const refImporte = useRef<HTMLInputElement>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const n = parsearImporte(importe)
    if (n == null || n <= 0) {
      setAviso('El importe tiene que ser un número mayor que 0, por ejemplo 12,50.')
      return
    }
    setAviso(null)
    const ok = await onApuntar({ tipo: 'gasto', categoria, importe: n, nombre: concepto.trim() || null, fecha })
    if (ok) {
      setImporte('')
      setConcepto('')
      refImporte.current?.focus()
    }
  }

  return (
    <section aria-labelledby="t-apuntar">
      <div className="head"><h2 id="t-apuntar">Apuntar gasto o aportación</h2></div>
      <form className="form" onSubmit={enviar}>
        <div className="fila2">
          <label>Importe (€)
            <input id="g-importe" ref={refImporte} inputMode="decimal" placeholder="12,50" value={importe} onChange={(e) => setImporte(e.target.value)} required />
          </label>
          <label>Fecha
            <input id="g-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
        </div>
        <div className="fila2">
          <label>Tipo
            <select id="g-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>
              {OPCIONES.map((c) => <option key={c} value={c}>{NOMBRE_CATEGORIA[c]}</option>)}
            </select>
          </label>
          <label>Concepto (opcional)
            <input id="g-concepto" placeholder="Mercadona, cena, fondo indexado…" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
          </label>
        </div>
        {aviso && <p className="aviso" role="alert">{aviso}</p>}
        <div className="acciones"><button className="btn primario" type="submit">Apuntar</button></div>
      </form>
    </section>
  )
}
