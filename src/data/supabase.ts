import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Categoria, Movimiento } from '../domain/tipos'
import { ConflictoBoveda, type AlmacenBoveda } from './boveda.ts'
import type { Sobre } from './cifrado'
import { AJUSTES_POR_DEFECTO } from '../domain/tipos.ts'
import { PATRIMONIO_VACIO } from './repositorio'

const url = import.meta.env.VITE_SUPABASE_URL
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY

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
