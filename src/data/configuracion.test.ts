import { describe, expect, it } from 'vitest'
import {
  CLAVE_CONFIGURACION, cargarConfiguracion, guardarConfiguracion, leerConfiguracion, normalizarConfiguracion,
  seleccionar, sugerirDesdeEntorno, type Almacenamiento, type Configuracion,
} from './configuracion.ts'

/** localStorage falso en memoria. */
function memoria(inicial: Record<string, string> = {}): Almacenamiento & { datos: Map<string, string> } {
  const datos = new Map(Object.entries(inicial))
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
    key: (i) => [...datos.keys()][i] ?? null,
    get length() { return datos.size },
  }
}

const supabase = { proveedor: 'supabase', parametros: { url: 'https://abc.supabase.co', clave: 'sb_publishable_x' } }
const env = { VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_x' }

describe('guardar y leer la configuración', () => {
  it('lo guardado se lee igual', () => {
    const a = memoria()
    guardarConfiguracion(supabase, a)
    expect(leerConfiguracion(a)).toEqual(supabase)
  })

  it('rechaza una url que no es https, un proveedor desconocido y campos vacíos, sin escribir nada', () => {
    const a = memoria()
    const malas: Configuracion[] = [
      { proveedor: 'supabase', parametros: { url: 'http://abc.supabase.co', clave: 'k' } },
      { proveedor: 'supabase', parametros: { url: 'https://abc.supabase.co', clave: '  ' } },
      { proveedor: 'supabase', parametros: {} },
      { proveedor: 'nube-inventada', parametros: {} },
    ]
    for (const m of malas) expect(() => guardarConfiguracion(m, a)).toThrow()
    expect(a.datos.size).toBe(0)
  })

  it('una configuración guardada que ya no vale se ignora', () => {
    const a = memoria({ [CLAVE_CONFIGURACION]: JSON.stringify({ proveedor: 'supabase', parametros: { url: 'http://x.test', clave: 'k' } }) })
    expect(leerConfiguracion(a)).toBeNull()
    expect(leerConfiguracion(memoria({ [CLAVE_CONFIGURACION]: 'no es json' }))).toBeNull()
  })
})

describe('la configuración no guarda secretos', () => {
  it('solo persiste proveedor y los campos públicos declarados: lo demás se descarta', () => {
    const a = memoria()
    guardarConfiguracion({ proveedor: 'local', parametros: { contrasena: 'mi-contraseña-secreta', password: 'x', clave: 'y' } }, a)
    const texto = a.getItem(CLAVE_CONFIGURACION)!
    expect(JSON.parse(texto)).toEqual({ version: 1, proveedor: 'local', parametros: {} })
    expect(texto).not.toContain('secreta')
  })

  it('en supabase solo se guardan url y clave pública, sin espacios', () => {
    const a = memoria()
    guardarConfiguracion({ proveedor: 'supabase', parametros: { url: ' https://abc.supabase.co ', clave: ' k ', contrasena: 'zzz' } }, a)
    expect(JSON.parse(a.getItem(CLAVE_CONFIGURACION)!).parametros).toEqual({ url: 'https://abc.supabase.co', clave: 'k' })
  })

  it('normalizar también limpia lo que venga de fuera', () => {
    expect(normalizarConfiguracion({ proveedor: 'demo', parametros: { extra: 'a' } })).toEqual({ proveedor: 'demo', parametros: {} })
    expect(normalizarConfiguracion({ proveedor: 3 })).toBeNull()
  })
})

describe('selección de proveedor', () => {
  it('cada configuración da su proveedor y sus parámetros', () => {
    expect(seleccionar(supabase).proveedor.id).toBe('supabase')
    expect(seleccionar(supabase).config).toEqual(supabase.parametros)
    expect(seleccionar({ proveedor: 'local', parametros: {} }).proveedor.id).toBe('local')
    expect(seleccionar({ proveedor: 'demo', parametros: {} }).proveedor.id).toBe('demo')
  })

  it('un proveedor desconocido lanza', () => {
    expect(() => seleccionar({ proveedor: 'nube-inventada', parametros: {} })).toThrow()
  })

  it('el entorno solo sugiere: con las dos variables, supabase; sin ellas, ejemplo', () => {
    expect(sugerirDesdeEntorno(env)).toEqual(supabase)
    for (const e of [{}, { VITE_SUPABASE_URL: 'https://a.test' }, { VITE_SUPABASE_ANON_KEY: 'k' }, { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }]) {
      expect(sugerirDesdeEntorno(e).proveedor).toBe('demo')
    }
  })

  it('la configuración guardada manda sobre el entorno', () => {
    const a = memoria()
    guardarConfiguracion({ proveedor: 'local', parametros: {} }, a)
    expect(cargarConfiguracion(env, a)).toEqual({ proveedor: 'local', parametros: {} })
  })
})

describe('migración: quien ya usaba la app conserva todo sin pasos manuales', () => {
  it('con sesión de Supabase y variables del despliegue: pasa a supabase y lo deja guardado', () => {
    const a = memoria({ 'sb-abc-auth-token': '{}' })
    expect(cargarConfiguracion(env, a)).toEqual(supabase)
    expect(leerConfiguracion(a)).toEqual(supabase)
  })

  it('con datos de ejemplo guardados: sigue en demo y no se tocan los datos', () => {
    const a = memoria({ 'gestor-finanzas:demo': '{"movimientos":[]}' })
    expect(cargarConfiguracion({}, a)).toEqual({ proveedor: 'demo', parametros: {} })
    expect(a.getItem('gestor-finanzas:demo')).toBe('{"movimientos":[]}')
  })

  it('con datos de ejemplo y variables pero sin sesión de Supabase: sigue en demo', () => {
    expect(cargarConfiguracion(env, memoria({ 'gestor-finanzas:demo': '{}' }))?.proveedor).toBe('demo')
  })

  it('persona nueva: sin configuración (verá la instalación) y no se escribe nada', () => {
    const a = memoria()
    expect(cargarConfiguracion(env, a)).toBeNull()
    expect(cargarConfiguracion({}, a)).toBeNull()
    expect(a.datos.size).toBe(0)
  })

  it('sesión de Supabase pero sin variables válidas: instalación, sin romper', () => {
    expect(cargarConfiguracion({ VITE_SUPABASE_URL: 'http://x.test', VITE_SUPABASE_ANON_KEY: 'k' }, memoria({ 'sb-abc-auth-token': '{}' }))).toBeNull()
  })
})
