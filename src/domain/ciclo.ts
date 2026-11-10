import { moverMes } from './formato.ts'

/** Los días de inicio posibles. Se limita a 28 para que exista en todos los meses. */
export const diaInicioValido = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 28

/**
 * Cada mes de nómina se llama como el mes en que termina. Con inicio el día 27, el mes `2026-11`
 * va del 2026-10-27 al 2026-11-26. Con inicio el día 1 son los meses naturales.
 */
export function inicioDe(mes: string, diaInicio: number): string {
  const base = diaInicio > 1 ? moverMes(mes, -1) : mes
  return `${base}-${String(diaInicio).padStart(2, '0')}`
}

/** Mes de nómina (YYYY-MM) al que pertenece una fecha (YYYY-MM-DD). */
export function mesDeFecha(fecha: string, diaInicio: number): string {
  const mes = fecha.slice(0, 7)
  return diaInicio > 1 && Number(fecha.slice(8, 10)) >= diaInicio ? moverMes(mes, 1) : mes
}

export const fechaEnMes = (fecha: string, mes: string, diaInicio: number): boolean => mesDeFecha(fecha, diaInicio) === mes

/** Días desde el inicio del mes de nómina hasta `hoy` (negativo si aún no ha empezado). */
export function diasDesdeInicio(mes: string, diaInicio: number, hoy: string): number {
  const dia = (f: string) => new Date(`${f}T12:00:00`).getTime()
  return Math.round((dia(hoy) - dia(inicioDe(mes, diaInicio))) / 864e5)
}
