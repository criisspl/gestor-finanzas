import type { AlmacenBoveda } from '../boveda.ts'

/** Un dato que hay que pedir para configurar un proveedor (por ejemplo, la URL de Supabase). */
export interface CampoConfig {
  clave: string
  etiqueta: string
  /** Datos que no deben mostrarse ni guardarse en claro. */
  secreto?: boolean
}

export type ConfigProveedor = Readonly<Record<string, string>>

/** Qué sabe la app de la persona cuando pide un almacén. */
export interface ContextoAlmacen {
  /** Id de la persona dueña de la bóveda. Los proveedores con cuentas (Supabase) lo exigen. */
  usuario?: string
}

/**
 * Un sitio donde puede vivir el sobre cifrado de una persona (Supabase, el navegador…).
 * La app solo habla con `AlmacenBoveda`: añadir un proveedor no toca ni el cifrado ni la interfaz.
 */
export interface ProveedorAlmacen {
  id: string
  nombre: string
  campos: readonly CampoConfig[]
  /** Lanza si falta algún campo obligatorio de `config` o el contexto que necesita. */
  crearAlmacen(config: ConfigProveedor, contexto?: ContextoAlmacen): AlmacenBoveda
}
