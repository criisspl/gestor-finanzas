import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Movimiento } from '../domain/tipos'
import type { AlmacenBoveda } from './boveda'
import type { Sobre } from './cifrado'
import { PATRIMONIO_VACIO } from './repositorio'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null cuando no hay variables de entorno: la app arranca en modo demo. */
export const supabase: SupabaseClient | null = url && clave ? createClient(url, clave) : null

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
  if (f.tipo === 'fijo') return { id: f.id, tipo: 'fijo', nombre: f.nombre ?? '', importe, categoria: f.categoria as never }
  return { id: f.id, tipo: 'gasto', nombre: f.nombre, importe, categoria: f.categoria as never, fecha: f.fecha! }
}

/**
 * La fila de `bovedas` solo contiene el sobre cifrado. Las tablas `movimientos` y `patrimonio`
 * son de la versión sin cifrar y solo se leen para migrar sus datos a la bóveda.
 */
export function almacenSupabase(db: SupabaseClient, userId: string): AlmacenBoveda {
  return {
    async leer() {
      const { data, error } = await db.from('bovedas').select('version,sal,iteraciones,iv,cifrado').maybeSingle()
      if (error) throw error
      return data as Sobre | null
    },
    async escribir(sobre) {
      const { error } = await db.from('bovedas').upsert({ user_id: userId, ...sobre, updated_at: new Date().toISOString() })
      if (error) throw error
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
