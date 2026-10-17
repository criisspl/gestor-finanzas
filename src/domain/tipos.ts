export const CATEGORIAS = ['alquiler', 'esencial', 'ocio', 'inversion', 'otros'] as const
export type Categoria = (typeof CATEGORIAS)[number]

export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  alquiler: 'Alquiler o hipoteca',
  esencial: 'Esencial (comida, recibos, transporte…)',
  ocio: 'Ocio',
  inversion: 'Inversión (aportación)',
  otros: 'Otros',
}

export const NOMBRE_CORTO: Record<Categoria, string> = {
  alquiler: 'Alquiler',
  esencial: 'Esenciales',
  ocio: 'Ocio',
  inversion: 'Inversión',
  otros: 'Otros',
}

/** Un ingreso mensual (nómina, extra…). Cuenta igual todos los meses. */
export interface Ingreso {
  id: string
  tipo: 'ingreso'
  nombre: string
  importe: number
}

/** Un gasto que se repite cada mes (alquiler, recibos, suscripciones…). */
export interface GastoFijo {
  id: string
  tipo: 'fijo'
  nombre: string
  importe: number
  categoria: Categoria
}

/** Un gasto variable o una aportación a inversión, con fecha concreta. */
export interface GastoVariable {
  id: string
  tipo: 'gasto'
  nombre: string | null
  importe: number
  categoria: Categoria
  /** Fecha en formato YYYY-MM-DD */
  fecha: string
}

export type Movimiento = Ingreso | GastoFijo | GastoVariable
export type NuevoMovimiento =
  | Omit<Ingreso, 'id'>
  | Omit<GastoFijo, 'id'>
  | Omit<GastoVariable, 'id'>

/** Lo que la persona ya tiene acumulado. Se usa en las reglas 1 y 4. */
export interface Patrimonio {
  fondoEmergencia: number
  totalInvertido: number
  actualizado: string | null
}
