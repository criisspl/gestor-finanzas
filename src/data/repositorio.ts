import type { Ajustes, DatosMes, Meses, Movimiento, NuevaNota, NuevaPartida, NuevoMovimiento, Nota, Partida, Patrimonio, Recibos } from '../domain/tipos'

/**
 * Dónde se guardan los datos de la persona que ha iniciado sesión.
 * Hay dos implementaciones: Supabase (real) y localStorage (modo demo).
 */
export interface Repositorio {
  listarMovimientos(): Promise<Movimiento[]>
  crearMovimiento(m: NuevoMovimiento): Promise<Movimiento>
  actualizarMovimiento(m: Movimiento): Promise<void>
  borrarMovimiento(id: string): Promise<void>
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
  marcarRecibo(mes: string, id: string, llegado: boolean): Promise<void>
  leerAjustes(): Promise<Ajustes>
  guardarAjustes(a: Ajustes): Promise<void>
  listarMeses(): Promise<Meses>
  guardarMes(mes: string, datos: DatosMes): Promise<void>
  /** Suma `delta` al saldo de la cuenta en ese mes, solo si ya se había apuntado un saldo. */
  ajustarSaldo(mes: string, cuenta: string, delta: number): Promise<void>
  /** Crea el mes copiando las partidas de `copiarDe` (si el mes aún no tiene partidas). */
  crearMes(mes: string, copiarDe: string | null): Promise<void>
  leerPatrimonio(): Promise<Patrimonio>
  guardarPatrimonio(p: Omit<Patrimonio, 'actualizado'>): Promise<Patrimonio>
}

export const PATRIMONIO_VACIO: Patrimonio = { fondoEmergencia: 0, totalInvertido: 0, actualizado: null }
