import type { AlmacenBoveda } from '../boveda.ts'
import type { Sobre } from '../cifrado.ts'
import type { ProveedorAlmacen } from './tipos.ts'

const CLAVE = 'gestor-finanzas:boveda-local'

/**
 * Guarda el sobre cifrado en el `localStorage` del navegador.
 * El modo demo de hoy (`demo.ts`) sigue guardando sus datos de ejemplo en claro y no pasa por aquí.
 */
function almacenLocal(): AlmacenBoveda {
  return {
    async leer() {
      const guardado = localStorage.getItem(CLAVE)
      return guardado ? (JSON.parse(guardado) as Sobre) : null
    },
    async escribir(sobre) {
      localStorage.setItem(CLAVE, JSON.stringify(sobre))
    },
    // Nunca hubo datos en claro en este almacén
    async leerSinCifrar() {
      return null
    },
    async borrarSinCifrar() {},
  }
}

export const proveedorLocal: ProveedorAlmacen = {
  id: 'local',
  nombre: 'Este navegador (demo)',
  campos: [],
  crearAlmacen: () => almacenLocal(),
}
