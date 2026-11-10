import { hoy } from '../domain/formato'
import type { Repositorio } from './repositorio'
import { normalizarEstado, repositorioEnMemoria, type Estado } from './memoria'

const CLAVE = 'gestor-finanzas:demo'

/** Datos de ejemplo para que la demo no arranque vacía. */
function ejemplo(): Estado {
  const mes = hoy().slice(0, 7)
  return {
    movimientos: [
      { id: 'e1', tipo: 'ingreso', nombre: 'Nómina', importe: 1250 },
      { id: 'e2', tipo: 'fijo', nombre: 'Alquiler', importe: 450, categoria: 'alquiler' },
      { id: 'e3', tipo: 'fijo', nombre: 'Luz e internet', importe: 85, categoria: 'esencial' },
      { id: 'e4', tipo: 'fijo', nombre: 'Plataformas', importe: 18, categoria: 'ocio' },
      { id: 'e5', tipo: 'gasto', nombre: 'Supermercado', importe: 64.3, categoria: 'esencial', fecha: `${mes}-03` },
      { id: 'e6', tipo: 'gasto', nombre: 'Cena con amigas', importe: 32, categoria: 'ocio', fecha: `${mes}-05` },
      { id: 'e7', tipo: 'gasto', nombre: 'Fondo indexado', importe: 150, categoria: 'inversion', fecha: `${mes}-01` },
    ],
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
