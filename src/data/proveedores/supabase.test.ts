import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { ConflictoBoveda } from '../boveda.ts'
import type { Sobre } from '../cifrado.ts'
import { almacenSupabase } from './supabase.ts'

const sobre: Sobre = { version: 5, sal: 's', iteraciones: 1000, iv: 'i', cifrado: 'c' }

/** Cliente falso con una sola tabla `bovedas`: solo implementa lo que usa almacenSupabase. */
function clienteFalso(inicial: (Sobre & { updated_at: string }) | null) {
  const t = { fila: inicial, contador: 0 }
  const marca = () => `2026-11-10T10:00:0${++t.contador}.000Z`
  const db = {
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: t.fila, error: null }) }),
      insert: (v: Sobre & { updated_at: string }) => ({
        select: () => ({
          single: async () => {
            if (t.fila) return { data: null, error: { code: '23505' } }
            t.fila = v
            return { data: { updated_at: v.updated_at }, error: null }
          },
        }),
      }),
      update: (v: Sobre & { updated_at: string }) => ({
        eq: () => ({
          eq: (_col: string, valor: string) => ({
            select: async () => {
              if (!t.fila || t.fila.updated_at !== valor) return { data: [], error: null }
              t.fila = { ...v, updated_at: marca() }
              return { data: [{ updated_at: t.fila.updated_at }], error: null }
            },
          }),
        }),
      }),
    }),
  }
  return { t, db: db as unknown as SupabaseClient }
}

describe('almacenSupabase: concurrencia', () => {
  it('guarda cuando nadie más ha escrito desde la lectura', async () => {
    const { t, db } = clienteFalso({ ...sobre, updated_at: 'v0' })
    const almacen = almacenSupabase(db, 'u1')
    expect(await almacen.leer()).toEqual(sobre)
    await almacen.escribir({ ...sobre, cifrado: 'nuevo' })
    await almacen.escribir({ ...sobre, cifrado: 'otro' })
    expect(t.fila?.cifrado).toBe('otro')
  })

  it('no pisa los cambios de otro dispositivo y avisa con ConflictoBoveda', async () => {
    const { t, db } = clienteFalso({ ...sobre, updated_at: 'v0' })
    const almacen = almacenSupabase(db, 'u1')
    await almacen.leer()
    t.fila = { ...sobre, cifrado: 'del-otro', updated_at: 'v1' }
    await expect(almacen.escribir({ ...sobre, cifrado: 'mio' })).rejects.toBeInstanceOf(ConflictoBoveda)
    expect(t.fila?.cifrado).toBe('del-otro')
  })

  it('primera escritura: si otro dispositivo creó la fila antes, hay conflicto', async () => {
    const { t, db } = clienteFalso(null)
    const almacen = almacenSupabase(db, 'u1')
    expect(await almacen.leer()).toBeNull()
    t.fila = { ...sobre, cifrado: 'del-otro', updated_at: 'v1' }
    await expect(almacen.escribir(sobre)).rejects.toBeInstanceOf(ConflictoBoveda)
  })

  it('crea la fila la primera vez', async () => {
    const { t, db } = clienteFalso(null)
    const almacen = almacenSupabase(db, 'u1')
    await almacen.leer()
    await almacen.escribir(sobre)
    expect(t.fila?.cifrado).toBe('c')
  })
})
