import type { Categoria, Movimiento, Patrimonio } from './tipos'
import { CATEGORIAS } from './tipos'
import { euros as fmt } from './formato'

/** Porcentajes de las 6 reglas de dinero, sobre el ingreso mensual. */
export const PORCENTAJES = {
  esenciales: 0.5,
  ocio: 0.05,
  alquiler: 0.35,
  inversion: 0.2,
} as const
/** Ingreso × 300 equivale a poder retirar un 4 % anual de la cartera. */
export const MULTIPLICADOR_LIBERTAD = 300
export const MESES_FONDO_EMERGENCIA = 3
/** Margen a partir del cual un límite pasa de "al límite" a "te pasas". */
export const TOLERANCIA = 0.1

export type Nivel = 'ok' | 'aviso' | 'mal' | 'info'

export interface ResumenMes {
  ingreso: number
  porCategoria: Record<Categoria, number>
  /** Alquiler + esenciales: lo imprescindible para vivir. */
  esenciales: number
  /** Todo lo gastado salvo la inversión. */
  gastado: number
  invertido: number
  /** Lo que queda para ahorrar (negativo si faltan). */
  queda: number
}

export interface Regla {
  id: 'libertad' | 'esenciales' | 'ocio' | 'fondo' | 'alquiler' | 'inversion'
  titulo: string
  explicacion: string
  objetivo: number
  actual: number
  etiquetaActual: string
  /** Progreso de 0 a 1 (puede pasar de 1 si te pasas). */
  progreso: number
  nivel: Nivel
  estado: string
  detalle: string
}

export const redondear = (n: number) => Math.round(n * 100) / 100
const suma = (importes: number[]) => redondear(importes.reduce((a, b) => a + b, 0))
const ratio = (actual: number, objetivo: number) => (objetivo > 0 ? actual / objetivo : 0)

/** `mes` en formato YYYY-MM. Los fijos cuentan todos los meses; los variables solo el suyo. */
export function resumirMes(movimientos: Movimiento[], mes: string): ResumenMes {
  const ingreso = suma(movimientos.filter((m) => m.tipo === 'ingreso').map((m) => m.importe))
  const porCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c, 0])) as Record<Categoria, number>
  for (const m of movimientos) {
    if (m.tipo === 'fijo' || (m.tipo === 'gasto' && m.fecha.startsWith(mes))) {
      porCategoria[m.categoria] = redondear(porCategoria[m.categoria] + m.importe)
    }
  }
  const esenciales = redondear(porCategoria.alquiler + porCategoria.esencial)
  const gastado = redondear(esenciales + porCategoria.ocio + porCategoria.otros)
  const invertido = porCategoria.inversion
  return { ingreso, porCategoria, esenciales, gastado, invertido, queda: redondear(ingreso - gastado - invertido) }
}


/** Regla de tope: lo ideal es no pasar del objetivo. */
function tope(base: Omit<Regla, 'progreso' | 'nivel' | 'estado' | 'detalle'>): Regla {
  const { actual, objetivo } = base
  const nivel: Nivel = actual <= objetivo ? 'ok' : actual <= objetivo * (1 + TOLERANCIA) ? 'aviso' : 'mal'
  return {
    ...base,
    progreso: ratio(actual, objetivo),
    nivel,
    estado: { ok: 'Bien', aviso: 'Al límite', mal: 'Te pasas', info: '' }[nivel],
    detalle: actual <= objetivo ? `Te quedan ${fmt(redondear(objetivo - actual))}` : `Te pasas ${fmt(redondear(actual - objetivo))}`,
  }
}

/** Calcula las 6 reglas del mes a partir del resumen y del patrimonio acumulado. */
export function calcularReglas(r: ResumenMes, p: Patrimonio): Regla[] {
  const I = r.ingreso
  const libertad = redondear(I * MULTIPLICADOR_LIBERTAD)
  const fondo = redondear(r.esenciales * MESES_FONDO_EMERGENCIA)
  const inversion = redondear(I * PORCENTAJES.inversion)
  const fondoCompleto = fondo > 0 && p.fondoEmergencia >= fondo
  const inversionCumplida = inversion > 0 && r.invertido >= inversion

  return [
    {
      id: 'libertad',
      titulo: 'Objetivo de independencia financiera',
      explicacion:
        'Ingreso × 300: lo que necesitarías invertido para retirar un 4 % al año. Es una estimación; impuestos, inflación y mercado cuentan.',
      objetivo: libertad,
      actual: p.totalInvertido,
      etiquetaActual: 'Invertido',
      progreso: ratio(p.totalInvertido, libertad),
      nivel: 'info',
      estado: `${Math.floor(ratio(p.totalInvertido, libertad) * 100)} %`,
      detalle: `Te faltan ${fmt(Math.max(0, redondear(libertad - p.totalInvertido)))}`,
    },
    tope({
      id: 'esenciales',
      titulo: 'Gastos esenciales',
      explicacion: '50 % del ingreso para vivienda, comida y gastos necesarios. Puede costar según dónde vivas.',
      objetivo: redondear(I * PORCENTAJES.esenciales),
      actual: r.esenciales,
      etiquetaActual: 'Llevas',
    }),
    tope({
      id: 'ocio',
      titulo: 'Ocio',
      explicacion: '5 % para gastar en lo que te apetezca, sin culpa.',
      objetivo: redondear(I * PORCENTAJES.ocio),
      actual: r.porCategoria.ocio,
      etiquetaActual: 'Llevas',
    }),
    {
      id: 'fondo',
      titulo: 'Fondo de emergencia',
      explicacion: '3 meses de tus gastos imprescindibles (alquiler + esenciales de este mes).',
      objetivo: fondo,
      actual: p.fondoEmergencia,
      etiquetaActual: 'Tienes',
      progreso: ratio(p.fondoEmergencia, fondo),
      nivel: fondoCompleto ? 'ok' : 'aviso',
      estado: fondoCompleto ? 'Completo' : 'En marcha',
      detalle: fondoCompleto ? 'Cubierto' : `Te faltan ${fmt(redondear(fondo - p.fondoEmergencia))}`,
    },
    tope({
      id: 'alquiler',
      titulo: 'Alquiler',
      explicacion: '35 % del ingreso como referencia. Si pagas más no lo estás haciendo mal: mira el conjunto de tus gastos.',
      objetivo: redondear(I * PORCENTAJES.alquiler),
      actual: r.porCategoria.alquiler,
      etiquetaActual: 'Pagas',
    }),
    {
      id: 'inversion',
      titulo: 'Inversión mensual',
      explicacion: '20 % del ingreso. Si no llegas, empieza por una cantidad que puedas mantener.',
      objetivo: inversion,
      actual: r.invertido,
      etiquetaActual: 'Este mes',
      progreso: ratio(r.invertido, inversion),
      nivel: inversionCumplida ? 'ok' : 'aviso',
      estado: inversionCumplida ? 'Cumplido' : r.invertido > 0 ? 'Empezando' : 'Pendiente',
      detalle: inversionCumplida ? 'Objetivo cumplido' : `Te faltan ${fmt(redondear(inversion - r.invertido))}`,
    },
  ]
}
