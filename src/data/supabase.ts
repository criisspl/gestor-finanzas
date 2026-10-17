import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Movimiento, NuevoMovimiento, Patrimonio } from '../domain/tipos'
import { PATRIMONIO_VACIO, type Repositorio } from './repositorio'

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

function aFila(m: NuevoMovimiento) {
  return {
    tipo: m.tipo,
    nombre: m.nombre,
    importe: m.importe,
    categoria: m.tipo === 'ingreso' ? null : m.categoria,
    fecha: m.tipo === 'gasto' ? m.fecha : null,
  }
}

export function repositorioSupabase(db: SupabaseClient, userId: string): Repositorio {
  return {
    async listarMovimientos() {
      const { data, error } = await db.from('movimientos').select('id,tipo,nombre,importe,categoria,fecha').order('created_at')
      if (error) throw error
      return (data as FilaMovimiento[]).map(aMovimiento)
    },
    async crearMovimiento(m) {
      const { data, error } = await db.from('movimientos').insert(aFila(m)).select().single()
      if (error) throw error
      return aMovimiento(data as FilaMovimiento)
    },
    async actualizarMovimiento(m) {
      const { error } = await db.from('movimientos').update(aFila(m)).eq('id', m.id)
      if (error) throw error
    },
    async borrarMovimiento(id) {
      const { error } = await db.from('movimientos').delete().eq('id', id)
      if (error) throw error
    },
    async leerPatrimonio() {
      const { data, error } = await db
        .from('patrimonio')
        .select('fondo_emergencia,total_invertido,updated_at')
        .maybeSingle()
      if (error) throw error
      if (!data) return PATRIMONIO_VACIO
      return {
        fondoEmergencia: Number(data.fondo_emergencia),
        totalInvertido: Number(data.total_invertido),
        actualizado: data.updated_at,
      }
    },
    async guardarPatrimonio(p): Promise<Patrimonio> {
      const actualizado = new Date().toISOString()
      const { error } = await db.from('patrimonio').upsert({
        user_id: userId,
        fondo_emergencia: p.fondoEmergencia,
        total_invertido: p.totalInvertido,
        updated_at: actualizado,
      })
      if (error) throw error
      return { ...p, actualizado }
    },
  }
}
