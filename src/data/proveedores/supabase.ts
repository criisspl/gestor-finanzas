import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Categoria, Movimiento } from '../../domain/tipos.ts'
import { ConflictoBoveda, type AlmacenBoveda } from '../boveda.ts'
import type { Sobre } from '../cifrado.ts'
import { AJUSTES_POR_DEFECTO } from '../../domain/tipos.ts'
import { PATRIMONIO_VACIO } from '../repositorio.ts'
import type { ConfigProveedor, ProveedorAlmacen } from './tipos.ts'

/** Solo https y sin usuario ni contraseña en la dirección: la clave y los datos viajan por ahí. */
export function validarUrlHttps(valor: string): string | null {
  let url: URL
  try {
    url = new URL(valor)
  } catch {
    return 'No es una dirección válida. Ejemplo: https://tu-proyecto.supabase.co'
  }
  if (url.protocol !== 'https:') return 'La dirección tiene que empezar por https://'
  if (url.username || url.password) return 'La dirección no puede llevar usuario ni contraseña.'
  return null
}

/** Rechaza la clave secreta (`sb_secret_…` o JWT con rol service_role): se salta la seguridad y no puede ir en el navegador. */
export function validarClavePublica(valor: string): string | null {
  if (valor.startsWith('sb_secret_')) return 'Esa es la clave secreta. Usa la clave pública (anon/publishable).'
  try {
    const carga = JSON.parse(atob(valor.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: unknown }
    if (carga.role === 'service_role') return 'Esa es la clave service_role. Usa la clave pública (anon).'
  } catch {
    // no es un JWT: nada más que comprobar
  }
  return null
}

const clientes = new Map<string, SupabaseClient>()

/** Un único cliente por proyecto (url + clave): la sesión y sus avisos viven en él. Se crea al pedirlo, no al cargar el módulo. */
export function clienteSupabase(config: ConfigProveedor, crear: typeof createClient = createClient): SupabaseClient {
  const { url, clave } = config
  if (!url || !clave) throw new Error('Supabase necesita url y clave')
  const id = `${url}\n${clave}`
  let cliente = clientes.get(id)
  if (!cliente) {
    cliente = crear(url, clave)
    clientes.set(id, cliente)
  }
  return cliente
}

interface FilaMovimiento {
  id: string
  tipo: Movimiento['tipo']
  nombre: string | null
  importe: number | string
  categoria: string | null
  fecha: string | null
}

// Postgres devuelve numeric como texto: lo convertimos a número al leer
function aMovimiento(f: FilaMovimiento): Movimiento {
  const importe = Number(f.importe)
  if (f.tipo === 'ingreso') return { id: f.id, tipo: 'ingreso', nombre: f.nombre ?? '', importe }
  if (f.tipo === 'fijo') return { id: f.id, tipo: 'fijo', nombre: f.nombre ?? '', importe, categoria: f.categoria as Categoria }
  return { id: f.id, tipo: 'gasto', nombre: f.nombre, importe, categoria: f.categoria as Categoria, fecha: f.fecha! }
}

/**
 * La fila de `bovedas` solo contiene el sobre cifrado. Las tablas `movimientos` y `patrimonio`
 * son de la versión sin cifrar y solo se leen para migrar sus datos a la bóveda.
 */
export function almacenSupabase(db: SupabaseClient, userId: string): AlmacenBoveda {
  // Marca de la última versión que esta pestaña leyó o escribió; null = aún no hay fila; undefined = sin leer
  let ultima: string | null | undefined

  return {
    usuario: userId,
    async leer() {
      const { data, error } = await db.from('bovedas').select('version,sal,iteraciones,iv,cifrado,updated_at').maybeSingle()
      if (error) throw error
      ultima = data ? (data.updated_at as string) : null
      if (!data) return null
      const { version, sal, iteraciones, iv, cifrado } = data
      return { version, sal, iteraciones, iv, cifrado } as Sobre
    },
    /**
     * Control optimista: solo se escribe si la fila sigue en la versión que esta pestaña leyó.
     * Si otra pestaña o dispositivo guardó antes, lanza ConflictoBoveda y no pisa sus datos.
     */
    async escribir(sobre) {
      if (ultima === undefined) await this.leer()
      const fila = { ...sobre, updated_at: new Date().toISOString() }
      if (ultima === null) {
        const { data, error } = await db.from('bovedas').insert({ user_id: userId, ...fila }).select('updated_at').single()
        // 23505: la fila ya existe, la creó otro dispositivo mientras tanto
        if (error) throw error.code === '23505' ? new ConflictoBoveda() : error
        ultima = data.updated_at as string
        return
      }
      const { data, error } = await db.from('bovedas').update(fila).eq('user_id', userId).eq('updated_at', ultima).select('updated_at')
      if (error) throw error
      if (!data || data.length === 0) throw new ConflictoBoveda()
      ultima = data[0].updated_at as string
    },
    async leerSinCifrar() {
      const [movs, pat] = await Promise.all([
        db.from('movimientos').select('id,tipo,nombre,importe,categoria,fecha').order('created_at'),
        db.from('patrimonio').select('fondo_emergencia,total_invertido,updated_at').maybeSingle(),
      ])
      if (movs.error) throw movs.error
      if (pat.error) throw pat.error
      if (!movs.data.length && !pat.data) return null
      return {
        movimientos: (movs.data as FilaMovimiento[]).map(aMovimiento),
        notas: [],
        partidas: [],
        recibos: {},
        ajustes: AJUSTES_POR_DEFECTO,
        meses: {},
        deudas: [],
        pagos: [],
        cobros: [],
        patrimonio: pat.data
          ? {
              fondoEmergencia: Number(pat.data.fondo_emergencia),
              totalInvertido: Number(pat.data.total_invertido),
              actualizado: pat.data.updated_at,
            }
          : PATRIMONIO_VACIO,
      }
    },
    async borrarSinCifrar() {
      const [movs, pat] = await Promise.all([
        db.from('movimientos').delete().eq('user_id', userId),
        db.from('patrimonio').delete().eq('user_id', userId),
      ])
      if (movs.error) throw movs.error
      if (pat.error) throw pat.error
    },
  }
}

export const proveedorSupabase: ProveedorAlmacen = {
  id: 'supabase',
  nombre: 'Supabase',
  descripcion: 'Tus datos cifrados se guardan en tu propio proyecto de Supabase y los recuperas desde cualquier dispositivo con tu correo y tu contraseña.',
  campos: [
    { clave: 'url', etiqueta: 'URL del proyecto (https)', validar: validarUrlHttps },
    // Es la clave pública (publishable/anon); la secret nunca va al cliente
    { clave: 'clave', etiqueta: 'Clave pública (anon)', validar: validarClavePublica },
  ],
  crearAlmacen(config, contexto) {
    if (!contexto?.usuario) throw new Error('Supabase necesita la persona que ha iniciado sesión')
    return almacenSupabase(clienteSupabase(config), contexto.usuario)
  },
}
