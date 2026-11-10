import type { Movimiento, NuevaNota, NuevoMovimiento, Nota, Patrimonio } from '../domain/tipos'

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
  leerPatrimonio(): Promise<Patrimonio>
  guardarPatrimonio(p: Omit<Patrimonio, 'actualizado'>): Promise<Patrimonio>
}

export const PATRIMONIO_VACIO: Patrimonio = { fondoEmergencia: 0, totalInvertido: 0, actualizado: null }
