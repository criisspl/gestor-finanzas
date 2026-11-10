import { AJUSTES_POR_DEFECTO, DATOS_MES_VACIO, type Ajustes, type Cobro, type Deuda, type GastoVariable, type Meses, type Movimiento, type Nota, type PagoDeuda, type Partida, type Patrimonio, type Recibos } from '../domain/tipos.ts'
import { ajustarSaldo as ajustarSaldoPuro, copiarPartidas } from '../domain/cierre.ts'
import { marcarRecibo as marcarReciboPuro } from '../domain/partidas.ts'
import { PATRIMONIO_VACIO, type AjusteSaldo, type Repositorio } from './repositorio'

/** Todos los datos de una persona. Es lo que se guarda en el navegador (demo) o cifrado en Supabase. */
export interface Estado {
  movimientos: Movimiento[]
  notas: Nota[]
  patrimonio: Patrimonio
  partidas: Partida[]
  recibos: Recibos
  ajustes: Ajustes
  meses: Meses
  deudas: Deuda[]
  pagos: PagoDeuda[]
  cobros: Cobro[]
}

export const ESTADO_VACIO: Estado = {
  movimientos: [], notas: [], patrimonio: PATRIMONIO_VACIO, partidas: [], recibos: {}, ajustes: AJUSTES_POR_DEFECTO, meses: {},
  deudas: [], pagos: [], cobros: [],
}

/** Completa lo que falte en datos guardados por versiones anteriores (sin notas, partidas, recibos o ajustes, por ejemplo). */
export function normalizarEstado(e: Partial<Estado>): Estado {
  return {
    movimientos: e.movimientos ?? [],
    notas: e.notas ?? [],
    patrimonio: e.patrimonio ?? PATRIMONIO_VACIO,
    partidas: e.partidas ?? [],
    recibos: e.recibos ?? {},
    ajustes: e.ajustes ?? AJUSTES_POR_DEFECTO,
    meses: e.meses ?? {},
    deudas: e.deudas ?? [],
    pagos: e.pagos ?? [],
    cobros: e.cobros ?? [],
  }
}

/**
 * Repositorio que trabaja sobre el estado en memoria y llama a `persistir` con el estado completo
 * en cada cambio. El estado solo cambia si `persistir` termina bien, y los cambios van en cola
 * para que dos guardados seguidos no se pisen.
 */
export function repositorioEnMemoria(
  inicial: Estado,
  persistir: (e: Estado) => Promise<void>,
  /** Cambio de contraseña, si el almacenamiento está cifrado. Recibe el estado actual y va en la misma cola que los guardados. */
  cambiarContrasena?: (e: Estado, actual: string, nueva: string) => Promise<void>,
): Repositorio {
  let estado = normalizarEstado(inicial)
  let cola: Promise<unknown> = Promise.resolve()

  function cambiar<T>(paso: (e: Estado) => [Estado, T]): Promise<T> {
    const hecho = cola.then(async () => {
      const [nuevo, resultado] = paso(estado)
      await persistir(nuevo)
      estado = nuevo
      return resultado
    })
    cola = hecho.catch(() => undefined)
    return hecho
  }

  /** Aplica el ajuste de saldo (si lo hay) sobre los meses; sin saldo apuntado no inventa nada. */
  function conAjuste(meses: Meses, ajuste: AjusteSaldo | null | undefined): Meses {
    return ajuste ? ajustarSaldoPuro(meses, ajuste.mes, ajuste.cuenta, ajuste.delta) : meses
  }

  return {
    ...(cambiarContrasena && {
      cambiarContrasena(actual: string, nueva: string) {
        const hecho = cola.then(() => cambiarContrasena(estado, actual, nueva))
        cola = hecho.catch(() => undefined)
        return hecho
      },
    }),
    async listarMovimientos() {
      return estado.movimientos
    },
    crearMovimiento(m, ajuste) {
      const nuevo = { ...m, id: crypto.randomUUID() } as Movimiento
      return cambiar((e) => [{ ...e, movimientos: [...e.movimientos, nuevo], meses: conAjuste(e.meses, ajuste) }, nuevo])
    },
    actualizarMovimiento(m) {
      return cambiar((e) => [{ ...e, movimientos: e.movimientos.map((x) => (x.id === m.id ? m : x)) }, undefined])
    },
    borrarMovimiento(id, ajuste) {
      return cambiar((e) => [{ ...e, movimientos: e.movimientos.filter((x) => x.id !== id), meses: conAjuste(e.meses, ajuste) }, undefined])
    },
    async listarNotas() {
      return estado.notas
    },
    crearNota(n) {
      const nueva: Nota = { ...n, id: crypto.randomUUID() }
      return cambiar((e) => [{ ...e, notas: [...e.notas, nueva] }, nueva])
    },
    actualizarNota(n) {
      return cambiar((e) => [{ ...e, notas: e.notas.map((x) => (x.id === n.id ? n : x)) }, undefined])
    },
    borrarNota(id) {
      return cambiar((e) => [{ ...e, notas: e.notas.filter((x) => x.id !== id) }, undefined])
    },
    async listarPartidas() {
      return estado.partidas
    },
    crearPartida(p) {
      const nueva: Partida = { ...p, id: crypto.randomUUID() }
      return cambiar((e) => [{ ...e, partidas: [...e.partidas, nueva] }, nueva])
    },
    actualizarPartida(p) {
      return cambiar((e) => [{ ...e, partidas: e.partidas.map((x) => (x.id === p.id ? p : x)) }, undefined])
    },
    borrarPartida(id) {
      // Los gastos que la usaban se quedan sin partida, no desaparecen
      return cambiar((e) => [
        {
          ...e,
          partidas: e.partidas.filter((x) => x.id !== id),
          movimientos: e.movimientos.map((m) => (m.tipo === 'gasto' && m.partida === id ? { ...m, partida: null } : m)),
        },
        undefined,
      ])
    },
    async listarRecibos() {
      return estado.recibos
    },
    marcarRecibo(mes, id, llegado, ajuste) {
      return cambiar((e) => [{ ...e, recibos: marcarReciboPuro(e.recibos, mes, id, llegado), meses: conAjuste(e.meses, ajuste) }, undefined])
    },
    async leerAjustes() {
      return estado.ajustes
    },
    guardarAjustes(a) {
      return cambiar((e) => [{ ...e, ajustes: a }, undefined])
    },
    async listarMeses() {
      return estado.meses
    },
    guardarMes(mes, datos) {
      return cambiar((e) => [{ ...e, meses: { ...e.meses, [mes]: datos } }, undefined])
    },
    ajustarSaldo(mes, cuenta, delta) {
      return cambiar((e) => [{ ...e, meses: ajustarSaldoPuro(e.meses, mes, cuenta, delta) }, undefined])
    },
    crearMes(mes, copiarDe) {
      return cambiar((e) => {
        const copiadas = copiarDe ? copiarPartidas(e.partidas, copiarDe, mes, () => crypto.randomUUID()) : []
        return [{ ...e, partidas: [...e.partidas, ...copiadas], meses: { ...e.meses, [mes]: e.meses[mes] ?? DATOS_MES_VACIO } }, undefined]
      })
    },
    async listarDeudas() {
      return estado.deudas
    },
    crearDeuda(d) {
      const nueva: Deuda = { ...d, id: crypto.randomUUID() }
      return cambiar((e) => [{ ...e, deudas: [...e.deudas, nueva] }, nueva])
    },
    actualizarDeuda(d) {
      return cambiar((e) => [{ ...e, deudas: e.deudas.map((x) => (x.id === d.id ? d : x)) }, undefined])
    },
    borrarDeuda(id) {
      // Sus pagos desaparecen con ella, igual que los gastos que crearon
      return cambiar((e) => {
        const gastos = new Set(e.pagos.filter((p) => p.deuda === id).map((p) => p.gasto))
        return [
          {
            ...e,
            deudas: e.deudas.filter((x) => x.id !== id),
            pagos: e.pagos.filter((p) => p.deuda !== id),
            movimientos: e.movimientos.filter((m) => !gastos.has(m.id)),
          },
          undefined,
        ]
      })
    },
    async listarPagos() {
      return estado.pagos
    },
    registrarPago(pago, gasto) {
      return cambiar((e) => {
        const nuevoGasto = gasto ? ({ ...gasto, id: crypto.randomUUID() } as GastoVariable) : null
        const nuevo: PagoDeuda = { ...pago, id: crypto.randomUUID(), gasto: nuevoGasto?.id ?? null }
        return [
          { ...e, pagos: [...e.pagos, nuevo], movimientos: nuevoGasto ? [...e.movimientos, nuevoGasto] : e.movimientos },
          { pago: nuevo, gasto: nuevoGasto },
        ]
      })
    },
    borrarPago(id) {
      // Si el pago creó un gasto en una partida, se borra con él
      return cambiar((e) => {
        const gasto = e.pagos.find((p) => p.id === id)?.gasto
        return [{ ...e, pagos: e.pagos.filter((p) => p.id !== id), movimientos: e.movimientos.filter((m) => m.id !== gasto) }, undefined]
      })
    },
    async listarCobros() {
      return estado.cobros
    },
    crearCobro(c) {
      const nuevo: Cobro = { ...c, id: crypto.randomUUID(), cobrado: false, fechaCobro: null }
      return cambiar((e) => [{ ...e, cobros: [...e.cobros, nuevo] }, nuevo])
    },
    actualizarCobro(c, ajuste) {
      return cambiar((e) => [{ ...e, cobros: e.cobros.map((x) => (x.id === c.id ? c : x)), meses: conAjuste(e.meses, ajuste) }, undefined])
    },
    borrarCobro(id) {
      return cambiar((e) => [{ ...e, cobros: e.cobros.filter((x) => x.id !== id) }, undefined])
    },
    async leerPatrimonio() {
      return estado.patrimonio ?? PATRIMONIO_VACIO
    },
    guardarPatrimonio(p) {
      const patrimonio = { ...p, actualizado: new Date().toISOString() }
      return cambiar((e) => [{ ...e, patrimonio }, patrimonio])
    },
  }
}
