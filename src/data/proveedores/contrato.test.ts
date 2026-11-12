// @vitest-environment jsdom
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBoveda, crearBoveda, type AlmacenBoveda } from '../boveda.ts'
import { ContrasenaIncorrecta, type Sobre } from '../cifrado.ts'
import { ESTADO_VACIO } from '../memoria.ts'
import { PROVEEDORES, buscarProveedor, clienteSupabase, usaBoveda } from './index.ts'
import { almacenSupabase } from './supabase.ts'
import { proveedorSupabase } from './supabase.ts'
import { proveedorLocal } from './local.ts'
import { proveedorDemo } from './demo.ts'

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
    expect(PROVEEDORES.map((p) => p.id)).toEqual(['supabase', 'local', 'demo'])
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

describe('proveedor demo', () => {
  it('no usa bóveda: da un repositorio con datos de ejemplo', async () => {
    localStorage.clear()
    expect(usaBoveda(proveedorDemo)).toBe(false)
    expect((await proveedorDemo.crearRepositorio().listarMovimientos()).length).toBeGreaterThan(0)
  })
  it('buscarProveedor encuentra por id y devuelve undefined si no existe', () => {
    expect(buscarProveedor('demo')).toBe(proveedorDemo)
    expect(buscarProveedor('nube-inventada')).toBeUndefined()
  })
})

describe('validación de los campos de Supabase', () => {
  const [url, clave] = proveedorSupabase.campos
  it.each(['http://a.supabase.co', 'ftp://a.test', 'a.supabase.co', 'https://user:pass@a.supabase.co', 'javascript:alert(1)'])('rechaza la url %s', (v) => {
    expect(url.validar?.(v)).toEqual(expect.any(String))
  })
  it('acepta una url https', () => {
    expect(url.validar?.('https://abc.supabase.co')).toBeNull()
  })
  it('rechaza la clave secreta, también como JWT service_role, y acepta la pública', () => {
    const jwt = (rol: string) => `h.${btoa(JSON.stringify({ role: rol })).replace(/=/g, '')}.f`
    expect(clave.validar?.('sb_secret_abc')).toEqual(expect.any(String))
    expect(clave.validar?.(jwt('service_role'))).toEqual(expect.any(String))
    expect(clave.validar?.(jwt('anon'))).toBeNull()
    expect(clave.validar?.('sb_publishable_abc')).toBeNull()
  })
})
