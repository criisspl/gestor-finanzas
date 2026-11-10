import { mesDeFecha } from '../domain/ciclo.ts'
import { hoy } from '../domain/formato'
import { DIA_INICIO_POR_DEFECTO } from '../domain/tipos.ts'
import type { Repositorio } from './repositorio'
import { normalizarEstado, repositorioEnMemoria, type Estado } from './memoria'

const CLAVE = 'gestor-finanzas:demo'

/** Datos de ejemplo para que la demo no arranque vacía. */
function ejemplo(): Estado {
  const mes = mesDeFecha(hoy(), DIA_INICIO_POR_DEFECTO)
  return {
    movimientos: [
      { id: 'e1', tipo: 'ingreso', nombre: 'Nómina', importe: 1250 },
      { id: 'e2', tipo: 'fijo', nombre: 'Alquiler', importe: 450, categoria: 'alquiler' },
      { id: 'e3', tipo: 'fijo', nombre: 'Luz e internet', importe: 85, categoria: 'esencial' },
      { id: 'e4', tipo: 'fijo', nombre: 'Plataformas', importe: 18, categoria: 'ocio' },
      { id: 'e5', tipo: 'gasto', nombre: 'Supermercado', importe: 64.3, categoria: 'esencial', fecha: `${mes}-03`, partida: 'p2', cuenta: 'c2' },
      { id: 'e6', tipo: 'gasto', nombre: 'Cena con amigas', importe: 32, categoria: 'ocio', fecha: `${mes}-05`, partida: 'p3', cuenta: 'c2' },
      { id: 'e7', tipo: 'gasto', nombre: 'Fondo indexado', importe: 150, categoria: 'inversion', fecha: `${mes}-01` },
    ],
    partidas: [
      { id: 'p1', mes, nombre: 'Alquiler', detalle: null, importe: 450, variable: false, orden: 1, cuenta: 'c1' },
      { id: 'p2', mes, nombre: 'Comida', detalle: 'Supermercado y compras de la semana', importe: 250, variable: true, orden: 2, cuenta: 'c2' },
      { id: 'p3', mes, nombre: 'Ocio', detalle: null, importe: 60, variable: true, orden: 3, cuenta: 'c2' },
      { id: 'p4', mes, nombre: 'Luz e internet', detalle: null, importe: 85, variable: false, orden: 4, cuenta: 'c1' },
      { id: 'p5', mes, nombre: 'Ahorro', detalle: null, importe: 100, variable: false, orden: 5, cuenta: 'c3' },
    ],
    recibos: { [mes]: ['e2'] },
    ajustes: {
      diaInicio: DIA_INICIO_POR_DEFECTO,
      cuentas: [{ id: 'c1', nombre: 'Cuenta nómina' }, { id: 'c2', nombre: 'Cuenta gastos' }, { id: 'c3', nombre: 'Ahorro' }],
    },
    meses: { [mes]: { nomina: 1250, nominaRecibida: true, arrastreReal: null, saldos: { c1: 700, c2: 300 } } },
    notas: [{ id: 'n1', tipo: 'ok', titulo: 'Bien encaminada', texto: 'Este mes el fondo de emergencia sigue creciendo.' }],
    patrimonio: { fondoEmergencia: 1200, totalInvertido: 3400, actualizado: hoy() },
  }
}

function leer(): Estado {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado) return normalizarEstado(JSON.parse(guardado) as Partial<Estado>)
  } catch {
    // localStorage no disponible o corrupto: empezamos con el ejemplo
  }
  return ejemplo()
}

function escribir(e: Estado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(e))
  } catch {
    // Sin almacenamiento la demo sigue funcionando en memoria
  }
}

/** Guarda los datos en el navegador. Se usa cuando no hay Supabase configurado. */
export function repositorioDemo(): Repositorio {
  return repositorioEnMemoria(leer(), async (e) => escribir(e))
}

export function reiniciarDemo() {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // nada que borrar
  }
}
