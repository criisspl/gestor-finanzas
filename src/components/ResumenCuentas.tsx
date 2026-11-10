import { euros } from '../domain/formato.ts'
import { redondear } from '../domain/reglas.ts'
import { Importe } from './Importe'

interface Props {
  cuentaNomina: string
  /** Saldo apuntado de la cuenta de nómina, o null si aún no se ha apuntado. */
  saldo: number | null
  /** Suma de los fijos sin marcar como llegados. */
  falta: number
}

/** Lo que hay en la cuenta de nómina frente a lo que falta por pagar. */
export function ResumenCuentas({ cuentaNomina, saldo, falta }: Props) {
  const queda = saldo === null ? null : redondear(saldo - falta)
  const mensaje = queda === null
    ? 'Apunta tu saldo en «Ha llegado la nómina» para ver si llegas.'
    : queda < 0 ? `Te faltan ${euros(Math.abs(queda))} para pagar todo lo que queda.`
      : `Llegas: te sobran ${euros(queda)} después de pagar todo.`
  return (
    <section aria-labelledby="t-cuentas">
      <div className="head"><h2 id="t-cuentas">Tus cuentas</h2></div>
      <dl className="stats">
        <div><dt>Tienes en {cuentaNomina}</dt><dd>{saldo === null ? '—' : <Importe valor={saldo} />}</dd></div>
        <div><dt>Te falta por pagar</dt><dd><Importe valor={falta} /></dd></div>
      </dl>
      <p className={`note ${queda === null ? 'aviso' : queda < 0 ? 'mal' : 'ok'} resumen-nota`}><b>{mensaje}</b></p>
    </section>
  )
}
