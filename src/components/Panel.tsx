import { useEffect, useMemo, useRef, useState } from 'react'
import type { Repositorio } from '../data/repositorio'
import { useFinanzas } from '../hooks/useFinanzas'
import { calcularReglas, resumirMes } from '../domain/reglas'
import { arrastre, datosMes, ingresoDe, listaMeses, planTraspasos, type DatosCiclo } from '../domain/cierre.ts'
import { diasDesdeInicio, fechaEnMes, mesDeFecha } from '../domain/ciclo.ts'
import { hoy, moverMes, nombreMes } from '../domain/formato.ts'
import { pendientesPago } from '../domain/partidas.ts'
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
import { Pestanas } from './Pestanas'
import { CierreMes } from './CierreMes'
import { Traspasos } from './Traspasos'
import { ResumenCuentas } from './ResumenCuentas'
import { Ajustes } from './Ajustes'

/** Días desde el inicio del mes en los que se ofrece «Ha llegado la nómina» sin tener que pedirlo. */
const DIAS_CIERRE = 5

/** Pantalla principal con los datos de la persona que ha entrado. */
export function Panel({ repo }: { repo: Repositorio }) {
  const f = useFinanzas(repo)
  const dia = f.ajustes.diaInicio
  const actual = mesDeFecha(hoy(), dia)
  const [elegido, setElegido] = useState<string | null>(null)
  const [cierreAbierto, setCierreAbierto] = useState(false)
  const mes = elegido ?? actual

  const ingresos = f.movimientos.filter((m): m is Ingreso => m.tipo === 'ingreso')
  const fijos = f.movimientos.filter((m): m is GastoFijo => m.tipo === 'fijo')
  const todosGastos = f.movimientos.filter((m): m is GastoVariable => m.tipo === 'gasto')
  const variables = todosGastos.filter((m) => fechaEnMes(m.fecha, mes, dia))
  const ingresoBase = ingresos.reduce((a, i) => a + i.importe, 0)
  const ciclo: DatosCiclo = { diaInicio: dia, partidas: f.partidas, gastos: todosGastos, meses: f.meses, ingresoBase, hoy: hoy() }
  const datos = datosMes(f.meses, mes)
  const ingresoMes = ingresoDe(mes, ciclo)

  const resumen = useMemo(
    () => resumirMes(f.movimientos, mes, { diaInicio: dia, ingreso: ingresoMes }),
    [f.movimientos, mes, dia, ingresoMes],
  )
  const reglas = useMemo(() => calcularReglas(resumen, f.patrimonio), [resumen, f.patrimonio])
  const partidasMes = f.partidas.filter((p) => p.mes === mes)

  const existentes = listaMeses(f.partidas, f.meses)
  const ultimo = existentes[existentes.length - 1]
  const pestanas = existentes.includes(actual) ? existentes : [...existentes, actual].sort()
  const siguiente = moverMes(pestanas[pestanas.length - 1] ?? actual, 1)
  const copiarDe = existentes.filter((m) => m < siguiente).pop() ?? null

  // Al llegar el inicio de un mes de nómina que aún no existe, se crea copiando las partidas del último
  const creando = useRef(false)
  const crearMes = f.crearMes
  const cargando = f.cargando
  useEffect(() => {
    if (cargando || creando.current || !ultimo || ultimo >= actual) return
    creando.current = true
    crearMes(actual, ultimo).finally(() => { creando.current = false })
  }, [cargando, ultimo, actual, crearMes])

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

  const cuentas = f.ajustes.cuentas
  const automatico = mes === actual && !datos.nominaRecibida && diasDesdeInicio(mes, dia, hoy()) <= DIAS_CIERRE
  const cierre = (automatico || cierreAbierto) ? (
    <CierreMes key={mes} nombreMes={nombreMes(mes).toLowerCase()} datos={datos} cuentas={cuentas} nominaPrevista={ingresoMes}
      onGuardar={f.guardarMes.bind(null, mes)} onCerrar={() => setCierreAbierto(false)} />
  ) : (
    <button type="button" className="anadir" onClick={() => setCierreAbierto(true)}>¿Ha llegado la nómina de {nombreMes(mes).toLowerCase()}? Apuntarla aquí</button>
  )
  const arrastreMes = arrastre(mes, ciclo)
  const plan = datos.nominaRecibida ? planTraspasos(cuentas, partidasMes, ingresoMes, arrastreMes) : null
  const traspasos = plan && <Traspasos plan={plan} nomina={ingresoMes} arrastre={arrastreMes} />
  const cuentasResumen = cuentas[0] && (
    <ResumenCuentas cuentaNomina={cuentas[0].nombre} saldo={datos.saldos[cuentas[0].id] ?? null} falta={pendientesPago(fijos, f.recibos, mes).total} />
  )

  return (
    <>
      {error}
      <Pestanas meses={pestanas} activo={mes} siguiente={siguiente} onElegir={setElegido}
        onAdelantar={async () => { if (await f.crearMes(siguiente, copiarDe)) setElegido(siguiente) }} />
      {cierre}
      {traspasos}
      {cuentasResumen}
      <Resumen resumen={resumen} mes={mes} />
      <Reglas reglas={reglas} />
      <Reparto mes={mes} partidas={partidasMes} gastos={todosGastos} ingreso={resumen.ingreso} diaInicio={dia} cuentas={f.ajustes.cuentas}
        onCrear={f.crearPartida} onActualizar={f.actualizarPartida} onBorrar={f.borrarPartida} />
      <RecibosDelMes fijos={fijos} recibos={f.recibos} mes={mes} onMarcar={f.marcarRecibo} />
      <Notas notas={f.notas} onCrear={f.crearNota} onActualizar={f.actualizarNota} onBorrar={f.borrarNota} />
      <ApuntarGasto partidas={f.partidas} diaInicio={dia} cuentas={f.ajustes.cuentas} onApuntar={async (m) => {
        const nuevo = await f.apuntarGasto(m)
        if (nuevo?.tipo === 'gasto') setElegido(mesDeFecha(nuevo.fecha, dia))
        return nuevo
      }} />
      <GastosDelMes gastos={variables} partidas={f.partidas} cuentas={f.ajustes.cuentas} mes={mes} onBorrar={f.borrarGasto} />
      <ListaMensual tipo="ingreso" titulo="Ingresos mensuales" items={ingresos} textoVacio="Sin ingresos todavía." textoAnadir="+ Añadir ingreso"
        onCrear={f.crear} onActualizar={f.actualizar} onBorrar={f.borrar} />
      <ListaMensual tipo="fijo" titulo="Gastos fijos" subtitulo="Lo que pagas todos los meses. Cuentan en cada mes automáticamente."
        items={fijos} textoVacio="Sin gastos fijos todavía." textoAnadir="+ Añadir gasto fijo"
        onCrear={f.crear} onActualizar={f.actualizar} onBorrar={f.borrar} />
      <PatrimonioAcumulado patrimonio={f.patrimonio} onGuardar={f.guardarPatrimonio} />
      <Ajustes ajustes={f.ajustes} onGuardar={f.guardarAjustes} />
    </>
  )
}
