import { repositorioDemo } from '../demo.ts'
import type { ProveedorSinBoveda } from './tipos.ts'

/** Datos de ejemplo en el navegador, sin cifrar: para probar la app sin crear cuenta ni contraseña. */
export const proveedorDemo: ProveedorSinBoveda = {
  id: 'demo',
  nombre: 'Datos de ejemplo (sin cifrar)',
  descripcion: 'Para probar la app. Los datos se guardan sin cifrar solo en este navegador; no lo uses con datos reales.',
  campos: [],
  crearRepositorio: () => repositorioDemo(),
}
