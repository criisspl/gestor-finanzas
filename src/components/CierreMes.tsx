import { useState, type FormEvent } from 'react'
import { aplicarCierre, type Cierre } from '../domain/cierre.ts'
import { parsearImporte } from '../domain/formato.ts'
import type { Cuenta, DatosMes } from '../domain/tipos.ts'

interface Props {
  nombreMes: string
  datos: DatosMes
  cuentas: Cuenta[]
  /** Nómina que se espera si no se apunta otra. */
  nominaPrevista: number
  onGuardar: (d: DatosMes) => Promise<unknown>
  onCerrar: () => void
}

const texto = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

/** «Ha llegado la nómina»: nómina real, sobrante del mes anterior y saldos. Lo que se deja vacío no se toca. */
export function CierreMes({ nombreMes, datos, cuentas, nominaPrevista, onGuardar, onCerrar }: Props) {
  const [nomina, setNomina] = useState('')
  const [sobrante, setSobrante] = useState(texto(datos.arrastreReal))
  const [saldos, setSaldos] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const leer = (t: string) => (t.trim() ? parsearImporte(t) : undefined)
    const n = leer(nomina)
    const s = leer(sobrante)
    const porCuenta = cuentas.map((c) => [c.id, leer(saldos[c.id] ?? '')] as const)
    if (n === null || s === null || porCuenta.some(([, v]) => v === null)) return setAviso('Revisa los importes: tienen que ser números, por ejemplo 1250 o 12,50.')
    if (n !== undefined && n <= 0) return setAviso('La nómina tiene que ser mayor que 0.')
    const cierre: Cierre = {
      nomina: n,
      sobrante: s,
      saldos: Object.fromEntries(porCuenta.filter((p): p is readonly [string, number] => typeof p[1] === 'number')),
    }
    if (n === undefined && s === undefined && !Object.keys(cierre.saldos).length) return setAviso('Rellena al menos un campo.')
    setAviso(null)
    if (await onGuardar(aplicarCierre(datos, cierre))) {
      setNomina('')
      setSaldos({})
      onCerrar()
    }
  }

  return (
    <section aria-labelledby="t-cierre">
      <div className="head"><h2 id="t-cierre">Ha llegado la nómina de {nombreMes}</h2></div>
      <form className="form" onSubmit={enviar}>
        <div className="fila2">
          <label>Nómina recibida (€)
            <input id="c-nomina" inputMode="decimal" value={nomina} onChange={(e) => setNomina(e.target.value)} placeholder={texto(datos.nomina ?? nominaPrevista)} />
          </label>
          <label>Sobrante del mes anterior (€)
            <input id="c-sobrante" inputMode="decimal" value={sobrante} onChange={(e) => setSobrante(e.target.value)} placeholder="Se calcula solo" />
          </label>
        </div>
        {cuentas.map((c) => (
          <label key={c.id}>Saldo de {c.nombre} (€)
            <input id={`c-saldo-${c.id}`} inputMode="decimal" value={saldos[c.id] ?? ''} placeholder={texto(datos.saldos[c.id])}
              onChange={(e) => setSaldos((prev) => ({ ...prev, [c.id]: e.target.value }))} />
          </label>
        ))}
        {!cuentas.length && <p className="donde">Añade tus cuentas en «Ajustes» para apuntar sus saldos.</p>}
        {aviso && <p className="aviso" role="alert">{aviso}</p>}
        <div className="acciones">
          <div className="grupo">
            <button className="btn primario" type="submit">Guardar</button>
            <button className="btn suave" type="button" onClick={onCerrar}>Cancelar</button>
          </div>
        </div>
      </form>
    </section>
  )
}
