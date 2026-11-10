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
  /** Partida del reparto a la que cuenta. Opcional: los gastos anteriores no la tienen. */
  partida?: string | null
  /** Cuenta de la que sale el dinero. Opcional: los gastos anteriores no la tienen. */
  cuenta?: string | null
}

export type Movimiento = Ingreso | GastoFijo | GastoVariable
export type NuevoMovimiento =
  | Omit<Ingreso, 'id'>
  | Omit<GastoFijo, 'id'>
  | Omit<GastoVariable, 'id'>

/**
 * Una parte del reparto de la nómina de un mes, con su presupuesto. Las variables cuentan solo lo
 * apuntado; las fijas cuentan el presupuesto entero (o lo apuntado, si es más).
 */
export interface Partida {
  id: string
  /** Mes en formato YYYY-MM */
  mes: string
  nombre: string
  detalle: string | null
  importe: number
  variable: boolean
  orden: number
  /** Cuenta a la que hay que transferir esta partida. Sin ella (o si ya no existe) va a la cuenta de nómina. */
  cuenta?: string | null
}
export type NuevaPartida = Omit<Partida, 'id'>

/** Recibos fijos que ya han llegado: ids de gastos fijos marcados, por mes (YYYY-MM). */
export type Recibos = Record<string, string[]>

/** Una cuenta de la persona, con el nombre que ella quiera. La primera de la lista es la de la nómina. */
export interface Cuenta {
  id: string
  nombre: string
}

/** Día del mes en que empieza cada nómina (1 = meses naturales). */
export const DIA_INICIO_POR_DEFECTO = 27

export interface Ajustes {
  /** Día en que empieza cada mes de nómina, de 1 a 28. */
  diaInicio: number
  cuentas: Cuenta[]
}
export const AJUSTES_POR_DEFECTO: Ajustes = { diaInicio: DIA_INICIO_POR_DEFECTO, cuentas: [] }

/** Lo que se apunta al cobrar la nómina de un mes: nómina real, sobrante del mes anterior y saldos por cuenta. */
export interface DatosMes {
  /** Nómina recibida. Si es null, vale la suma de los ingresos mensuales. */
  nomina: number | null
  nominaRecibida: boolean
  /** Sobrante del mes anterior apuntado a mano. Si es null, se calcula. */
  arrastreReal: number | null
  /** Saldo de cada cuenta (por id) apuntado en este mes. */
  saldos: Record<string, number>
}
export const DATOS_MES_VACIO: DatosMes = { nomina: null, nominaRecibida: false, arrastreReal: null, saldos: {} }

/** Datos de cada mes de nómina (YYYY-MM). */
export type Meses = Record<string, DatosMes>

export const TIPOS_NOTA = ['ok', 'aviso', 'mal'] as const
export type TipoNota = (typeof TIPOS_NOTA)[number]

export const NOMBRE_TIPO_NOTA: Record<TipoNota, string> = {
  ok: 'Verde',
  aviso: 'Ámbar',
  mal: 'Rojo',
}

/** Una nota libre de la persona: verde (todo bien), ámbar (ojo) o roja (problema). */
export interface Nota {
  id: string
  tipo: TipoNota
  titulo: string | null
  texto: string
}
export type NuevaNota = Omit<Nota, 'id'>

/** Lo que la persona ya tiene acumulado. Se usa en las reglas 1 y 4. */
export interface Patrimonio {
  fondoEmergencia: number
  totalInvertido: number
  actualizado: string | null
}

/** Algo que la persona debe y va devolviendo con pagos parciales. El estado (verde, ámbar, rojo) es opcional. */
export interface Deuda {
  id: string
  nombre: string
  detalle: string | null
  /** Importe total a devolver. */
  importe: number
  estado: TipoNota | null
  estadoTexto: string | null
}
export type NuevaDeuda = Omit<Deuda, 'id'>

/** Un pago parcial de una deuda. Si salió de una partida, `gasto` es el id del gasto que se creó con él. */
export interface PagoDeuda {
  id: string
  deuda: string
  importe: number
  /** Fecha en formato YYYY-MM-DD */
  fecha: string
  gasto: string | null
}
export type NuevoPagoDeuda = Omit<PagoDeuda, 'id' | 'gasto'>

/** Dinero que te deben y que llegará: se asigna a un mes de nómina y se marca al cobrarlo. */
export interface Cobro {
  id: string
  /** Mes de nómina en formato YYYY-MM */
  mes: string
  nombre: string
  detalle: string | null
  importe: number
  cobrado: boolean
  /** Fecha en la que se marcó como cobrado (YYYY-MM-DD). */
  fechaCobro: string | null
}
export type NuevoCobro = Omit<Cobro, 'id' | 'cobrado' | 'fechaCobro'>
