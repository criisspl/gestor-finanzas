import type { AlmacenBoveda } from '../boveda.ts'
import type { Repositorio } from '../repositorio.ts'

/** Un dato que hay que pedir para configurar un proveedor (por ejemplo, la URL de Supabase). */
export interface CampoConfig {
  clave: string
  etiqueta: string
  /** Datos que no deben mostrarse ni guardarse en claro. */
  secreto?: boolean
  /** Devuelve el motivo del rechazo, o null si el valor vale. Se aplica al valor ya sin espacios. */
  validar?(valor: string): string | null
}

export type ConfigProveedor = Readonly<Record<string, string>>

/** Qué sabe la app de la persona cuando pide un almacén. */
export interface ContextoAlmacen {
  /** Id de la persona dueña de la bóveda. Los proveedores con cuentas (Supabase) lo exigen. */
  usuario?: string
}

interface ProveedorBase {
  id: string
  nombre: string
  /** Una frase para la pantalla de instalación. */
  descripcion: string
  campos: readonly CampoConfig[]
}

/**
 * Un sitio donde puede vivir el sobre cifrado de una persona (Supabase, el navegador…).
 * La app solo habla con `AlmacenBoveda`: añadir un proveedor no toca ni el cifrado ni la interfaz.
 */
export interface ProveedorAlmacen extends ProveedorBase {
  /** Lanza si falta algún campo obligatorio de `config` o el contexto que necesita. */
  crearAlmacen(config: ConfigProveedor, contexto?: ContextoAlmacen): AlmacenBoveda
}

/** Modo de prueba: datos de ejemplo en claro en el navegador, sin contraseña ni bóveda. */
export interface ProveedorSinBoveda extends ProveedorBase {
  crearRepositorio(): Repositorio
}

export type Proveedor = ProveedorAlmacen | ProveedorSinBoveda

export function usaBoveda(p: Proveedor): p is ProveedorAlmacen {
  return 'crearAlmacen' in p
}
