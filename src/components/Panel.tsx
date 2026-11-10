import { useMemo, useState } from 'react'
import type { Repositorio } from '../data/repositorio'
import { useFinanzas } from '../hooks/useFinanzas'
import { calcularReglas, resumirMes } from '../domain/reglas'
import { mesActual } from '../domain/formato'
import type { GastoFijo, GastoVariable, Ingreso } from '../domain/tipos'
import { Resumen } from './Resumen'
import { Reglas } from './Reglas'
import { ApuntarGasto } from './ApuntarGasto'
import { Notas } from './Notas'
import { GastosDelMes } from './GastosDelMes'
import { ListaMensual, Formulario } from './ListaMensual'
import { PatrimonioAcumulado } from './PatrimonioAcumulado'
import { Reparto } from './Reparto'
import { RecibosDelMes } from './RecibosDelMes'

/** Pantalla principal con los datos de la persona que ha entrado. */
export function Panel({ repo }: { repo: Repositorio }) {
  const f = useFinanzas(repo)
  const [mes, setMes] = useState(mesActual())

  const resumen = useMemo(() => resumirMes(f.movimientos, mes), [f.movimientos, mes])
  const reglas = useMemo(() => calcularReglas(resumen, f.patrimonio), [resumen, f.patrimonio])
  const ingresos = f.movimientos.filter((m): m is Ingreso => m.tipo === 'ingreso')
  const fijos = f.movimientos.filter((m): m is GastoFijo => m.tipo === 'fijo')
  const todosGastos = f.movimientos.filter((m): m is GastoVariable => m.tipo === 'gasto')
  const variables = todosGastos.filter((m) => m.fecha.startsWith(mes))

  const partidasMes = f.partidas.filter((p) => p.mes === mes)

  if (f.cargando) return <p className="estado">Cargando tus datos…</p>

  const error = f.error && <p className="estado error" role="alert">{f.error}</p>

  if (!ingresos.length) {
    return (
      <>
        {error}
        <div className="bienvenida">
          <h2>Empieza por tu ingreso mensual</h2>
          <ol>
            <li>Apunta lo que cobras al mes (nómina, extras…).</li>
            <li>Añade tus gastos fijos: alquiler, recibos, suscripciones.</li>
            <li>Durante el mes, apunta los gastos variables y lo que inviertes.</li>
          </ol>
          <Formulario tipo="ingreso" onGuardar={(d) => f.crear({ tipo: 'ingreso', ...d })} />
        </div>
      </>
    )
  }

  return (
    <>
      {error}
      <Resumen resumen={resumen} mes={mes} onCambiarMes={setMes} />
      <Reglas reglas={reglas} />
      <Reparto mes={mes} partidas={partidasMes} gastos={todosGastos} ingreso={resumen.ingreso}
        onCrear={f.crearPartida} onActualizar={f.actualizarPartida} onBorrar={f.borrarPartida} />
      <RecibosDelMes fijos={fijos} recibos={f.recibos} mes={mes} onMarcar={f.marcarRecibo} />
      <Notas notas={f.notas} onCrear={f.crearNota} onActualizar={f.actualizarNota} onBorrar={f.borrarNota} />
      <ApuntarGasto partidas={f.partidas} onApuntar={async (m) => {
        const nuevo = await f.crear(m)
        if (nuevo?.tipo === 'gasto') setMes(nuevo.fecha.slice(0, 7))
        return nuevo
      }} />
      <GastosDelMes gastos={variables} partidas={f.partidas} mes={mes} onBorrar={f.borrar} />
      <ListaMensual tipo="ingreso" titulo="Ingresos mensuales" items={ingresos} textoVacio="Sin ingresos todavía." textoAnadir="+ Añadir ingreso"
        onCrear={f.crear} onActualizar={f.actualizar} onBorrar={f.borrar} />
      <ListaMensual tipo="fijo" titulo="Gastos fijos" subtitulo="Lo que pagas todos los meses. Cuentan en cada mes automáticamente."
        items={fijos} textoVacio="Sin gastos fijos todavía." textoAnadir="+ Añadir gasto fijo"
        onCrear={f.crear} onActualizar={f.actualizar} onBorrar={f.borrar} />
      <PatrimonioAcumulado patrimonio={f.patrimonio} onGuardar={f.guardarPatrimonio} />
    </>
  )
}
