// @vitest-environment jsdom
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBoveda, crearBoveda, type AlmacenBoveda } from '../boveda.ts'
import { ContrasenaIncorrecta, type Sobre } from '../cifrado.ts'
import { ESTADO_VACIO } from '../memoria.ts'
import { PROVEEDORES, clienteSupabase, seleccionDesdeEntorno } from './index.ts'
import { almacenSupabase } from './supabase.ts'
import { proveedorSupabase } from './supabase.ts'
import { proveedorLocal } from './local.ts'

const sobre: Sobre = { version: 6, sal: 's', iteraciones: 1000, iv: 'i', cifrado: 'c' }

/** Cliente falso con la tabla `bovedas` y las tablas en claro vacías: solo lo que usa almacenSupabase. */
function clienteFalso() {
  let fila: (Sobre & { updated_at: string }) | null = null
  let n = 0
  const vacia = { data: [], error: null }
  const db = {
    from: (tabla: string) => {
      if (tabla !== 'bovedas') {
        return {
          select: () => Object.assign(Promise.resolve(vacia), { order: async () => vacia, maybeSingle: async () => ({ data: null, error: null }) }),
          delete: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      return {
        select: () => ({ maybeSingle: async () => ({ data: fila, error: null }) }),
        insert: (v: Sobre & { updated_at: string }) => ({
          select: () => ({ single: async () => { fila = v; return { data: { updated_at: v.updated_at }, error: null } } }),
        }),
        update: (v: Sobre) => ({
          eq: () => ({
            eq: () => ({
              select: async () => {
                fila = { ...v, updated_at: `v${++n}` }
                return { data: [{ updated_at: fila.updated_at }], error: null }
              },
            }),
          }),
        }),
      }
    },
  }
  return db as unknown as SupabaseClient
}

const casos: { nombre: string; crear: () => AlmacenBoveda }[] = [
  { nombre: 'supabase (adaptador actual)', crear: () => almacenSupabase(clienteFalso(), 'u1') },
  {
    nombre: 'supabase (vía proveedor)',
    crear: () => {
      const cliente = clienteFalso()
      // Un cliente por proyecto: el proveedor reutiliza el que ya hay para esa url y clave
      clienteSupabase({ url: 'https://contrato.test', clave: 'k' }, (() => cliente) as never)
      return proveedorSupabase.crearAlmacen({ url: 'https://contrato.test', clave: 'k' }, { usuario: 'u1' })
    },
  },
  { nombre: 'local', crear: () => proveedorLocal.crearAlmacen({}) },
]

describe.each(casos)('contrato de AlmacenBoveda: $nombre', ({ crear }) => {
  beforeEach(() => localStorage.clear())

  it('sin nada guardado, leer devuelve null', async () => {
    expect(await crear().leer()).toBeNull()
  })

  it('lo escrito se lee igual', async () => {
    const almacen = crear()
    await almacen.leer()
    await almacen.escribir(sobre)
    expect(await almacen.leer()).toEqual(sobre)
    await almacen.escribir({ ...sobre, cifrado: 'otro' })
    expect((await almacen.leer())?.cifrado).toBe('otro')
  })

  it('no hay datos sin cifrar y borrarlos no falla', async () => {
    const almacen = crear()
    expect(await almacen.leerSinCifrar()).toBeNull()
    await expect(almacen.borrarSinCifrar()).resolves.toBeUndefined()
  })

  it('crear y abrir la bóveda funciona, y una contraseña mala no abre', async () => {
    const almacen = crear()
    const repo = await crearBoveda(almacen, 'contraseña-larga', 1000)
    expect(await repo.listarMovimientos()).toEqual(ESTADO_VACIO.movimientos)
    await repo.crearNota({ tipo: 'ok', titulo: 't', texto: 'x' })
    const guardado = await almacen.leer()
    expect(guardado).not.toBeNull()
    expect(JSON.stringify(guardado)).not.toContain('"titulo"')
    const abierto = await abrirBoveda(almacen, guardado!, 'contraseña-larga')
    expect(await abierto.listarNotas()).toHaveLength(1)
    await expect(abrirBoveda(almacen, guardado!, 'otra-contraseña')).rejects.toBeInstanceOf(ContrasenaIncorrecta)
  })
})

describe('proveedores', () => {
  it('supabase exige la persona; local no', () => {
    expect(() => proveedorSupabase.crearAlmacen({ url: 'https://a.test', clave: 'k' })).toThrow()
    expect(() => proveedorLocal.crearAlmacen({})).not.toThrow()
  })

  it('supabase exige url y clave', () => {
    expect(() => proveedorSupabase.crearAlmacen({}, { usuario: 'u1' })).toThrow()
  })

  it('los ids son únicos y los campos están descritos', () => {
    expect(new Set(PROVEEDORES.map((p) => p.id)).size).toBe(PROVEEDORES.length)
    expect(proveedorSupabase.campos.map((c) => c.clave)).toEqual(['url', 'clave'])
    expect(proveedorLocal.campos).toEqual([])
  })

  it('el cliente se crea al pedirlo y se reutiliza', () => {
    const crear = vi.fn(() => ({}))
    clienteSupabase({ url: 'https://perezoso.test', clave: 'k' }, crear as never)
    expect(crear).toHaveBeenCalledTimes(1)
    clienteSupabase({ url: 'https://perezoso.test', clave: 'k' }, crear as never)
    expect(crear).toHaveBeenCalledTimes(1)
  })
})

describe('seleccionDesdeEntorno (igual que la elección de antes)', () => {
  it('con url y clave elige supabase', () => {
    const s = seleccionDesdeEntorno({ VITE_SUPABASE_URL: 'https://a.test', VITE_SUPABASE_ANON_KEY: 'k' })
    expect(s.proveedor.id).toBe('supabase')
    expect(s.config).toEqual({ url: 'https://a.test', clave: 'k' })
  })

  it.each([
    {},
    { VITE_SUPABASE_URL: 'https://a.test' },
    { VITE_SUPABASE_ANON_KEY: 'k' },
    { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  ])('sin las dos variables (%j) cae a modo demo', (env) => {
    expect(seleccionDesdeEntorno(env).proveedor.id).toBe('local')
  })
})
