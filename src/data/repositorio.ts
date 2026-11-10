import type {
  Ajustes, Cobro, DatosMes, Deuda, GastoVariable, Meses, Movimiento, NuevaDeuda, NuevaNota, NuevaPartida, NuevoCobro, NuevoMovimiento, NuevoPagoDeuda, Nota,
  PagoDeuda, Partida, Patrimonio, Recibos,
} from '../domain/tipos'

/** Cambio de saldo de una cuenta en un mes. Se aplica en el mismo guardado que la operación que lo causa. */
export interface AjusteSaldo {
  mes: string
  cuenta: string
  delta: number
}

/**
 * Dónde se guardan los datos de la persona que ha iniciado sesión.
 * Hay dos implementaciones: Supabase (real) y localStorage (modo demo).
 */
export interface Repositorio {
  listarMovimientos(): Promise<Movimiento[]>
  /** Con `ajuste`, el saldo de la cuenta se actualiza en el mismo guardado (todo o nada). */
  crearMovimiento(m: NuevoMovimiento, ajuste?: AjusteSaldo | null): Promise<Movimiento>
  actualizarMovimiento(m: Movimiento): Promise<void>
  borrarMovimiento(id: string, ajuste?: AjusteSaldo | null): Promise<void>
  listarNotas(): Promise<Nota[]>
  crearNota(n: NuevaNota): Promise<Nota>
  actualizarNota(n: Nota): Promise<void>
  borrarNota(id: string): Promise<void>
  listarPartidas(): Promise<Partida[]>
  crearPartida(p: NuevaPartida): Promise<Partida>
  actualizarPartida(p: Partida): Promise<void>
  /** Los gastos apuntados en esa partida se conservan, sin partida. */
  borrarPartida(id: string): Promise<void>
  listarRecibos(): Promise<Recibos>
  marcarRecibo(mes: string, id: string, llegado: boolean, ajuste?: AjusteSaldo | null): Promise<void>
  leerAjustes(): Promise<Ajustes>
  guardarAjustes(a: Ajustes): Promise<void>
  listarMeses(): Promise<Meses>
  guardarMes(mes: string, datos: DatosMes): Promise<void>
  /** Suma `delta` al saldo de la cuenta en ese mes, solo si ya se había apuntado un saldo. */
  ajustarSaldo(mes: string, cuenta: string, delta: number): Promise<void>
  /** Crea el mes copiando las partidas de `copiarDe` (si el mes aún no tiene partidas). */
  crearMes(mes: string, copiarDe: string | null): Promise<void>
  listarDeudas(): Promise<Deuda[]>
  crearDeuda(d: NuevaDeuda): Promise<Deuda>
  actualizarDeuda(d: Deuda): Promise<void>
  /** Se borran también sus pagos y los gastos que esos pagos crearon. */
  borrarDeuda(id: string): Promise<void>
  listarPagos(): Promise<PagoDeuda[]>
  /** Guarda el pago y, si se pasa `gasto` (pago restado de una partida), también ese gasto enlazado. */
  registrarPago(pago: NuevoPagoDeuda, gasto: Omit<GastoVariable, 'id'> | null): Promise<{ pago: PagoDeuda; gasto: GastoVariable | null }>
  /** Borra el pago y el gasto que creó, si lo hubo. */
  borrarPago(id: string): Promise<void>
  listarCobros(): Promise<Cobro[]>
  crearCobro(c: NuevoCobro): Promise<Cobro>
  actualizarCobro(c: Cobro, ajuste?: AjusteSaldo | null): Promise<void>
  borrarCobro(id: string): Promise<void>
  leerPatrimonio(): Promise<Patrimonio>
  guardarPatrimonio(p: Omit<Patrimonio, 'actualizado'>): Promise<Patrimonio>
  /**
   * Solo existe si los datos van cifrados con contraseña (no en modo demo).
   * Lanza ContrasenaIncorrecta si `actual` no abre la bóveda; si no se puede guardar, la contraseña anterior sigue valiendo.
   */
  cambiarContrasena?(actual: string, nueva: string): Promise<void>
}

export const PATRIMONIO_VACIO: Patrimonio = { fondoEmergencia: 0, totalInvertido: 0, actualizado: null }
