import { describe, expect, it } from 'vitest'
import { abrirLlave, cifrar, ContrasenaIncorrecta, crearLlave, descifrar, type Sobre } from './cifrado'
import { cifrarAntiguo } from './sobreAntiguo'

// Pocas iteraciones para que los tests vayan rápido; la app usa ITERACIONES
const IT = 1000

describe('cifrado', () => {
  it('descifra con la misma contraseña lo que se cifró', async () => {
    const llave = await crearLlave('una contraseña larga', IT)
    const sobre = await cifrar(llave, { hola: 'mundo', n: 12.5 })
    const otra = await abrirLlave('una contraseña larga', sobre)
    expect(await descifrar(otra, sobre)).toEqual({ hola: 'mundo', n: 12.5 })
  })

  it('el sobre no deja ver los datos en claro', async () => {
    const sobre = await cifrar(await crearLlave('secreta123', IT), { nombre: 'Nómina' })
    expect(JSON.stringify(sobre)).not.toContain('Nómina')
    expect(sobre).toMatchObject({ version: 6, iteraciones: IT })
  })

  it('sigue abriendo sobres de la versión 1', async () => {
    const llave = await crearLlave('buena-contraseña', IT)
    const v1 = await cifrarAntiguo(llave, { movimientos: [] }, 1)
    expect(await descifrar(llave, v1)).toEqual({ movimientos: [] })
  })

  it('sigue abriendo sobres de la versión 2', async () => {
    const llave = await crearLlave('buena-contraseña', IT)
    const v2 = await cifrarAntiguo(llave, { notas: [] }, 2)
    expect(await descifrar(llave, v2)).toEqual({ notas: [] })
  })

  it('sigue abriendo sobres de la versión 3', async () => {
    const llave = await crearLlave('buena-contraseña', IT)
    const v3 = await cifrarAntiguo(llave, { partidas: [] }, 3)
    expect(await descifrar(llave, v3)).toEqual({ partidas: [] })
  })

  it('sigue abriendo sobres de la versión 4', async () => {
    const llave = await crearLlave('buena-contraseña', IT)
    const v4 = await cifrarAntiguo(llave, { meses: {} }, 4)
    expect(await descifrar(llave, v4)).toEqual({ meses: {} })
  })

  it('rechaza una versión de sobre desconocida', async () => {
    const llave = await crearLlave('buena-contraseña', IT)
    const futuro = { ...(await cifrar(llave, 1)), version: 7 } as unknown as Sobre
    await expect(descifrar(llave, futuro)).rejects.toThrow('no soportada')
  })

  it('rechaza una contraseña incorrecta', async () => {
    const sobre = await cifrar(await crearLlave('buena-contraseña', IT), [1, 2, 3])
    const mala = await abrirLlave('mala-contraseña', sobre)
    await expect(descifrar(mala, sobre)).rejects.toBeInstanceOf(ContrasenaIncorrecta)
  })

  it('detecta si alguien ha manipulado el sobre', async () => {
    const llave = await crearLlave('buena-contraseña', IT)
    const sobre = await cifrar(llave, 'dato')
    const bytes = atob(sobre.cifrado)
    const tocado = btoa(String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1))
    await expect(descifrar(llave, { ...sobre, cifrado: tocado })).rejects.toBeInstanceOf(ContrasenaIncorrecta)
  })

  it('usa un IV nuevo en cada guardado y una sal distinta por llave', async () => {
    const llave = await crearLlave('x'.repeat(10), IT)
    const [a, b] = await Promise.all([cifrar(llave, 1), cifrar(llave, 1)])
    expect(a.iv).not.toBe(b.iv)
    expect(a.cifrado).not.toBe(b.cifrado)
    expect((await crearLlave('x'.repeat(10), IT)).sal).not.toBe(llave.sal)
  })

  describe('datos adicionales autenticados (AAD)', () => {
    it('los sobres nuevos son de la versión 6 y se abren', async () => {
      const llave = await crearLlave('buena-contraseña', IT)
      const sobre = await cifrar(llave, { a: 1 }, 'usuario-1')
      expect(sobre.version).toBe(6)
      expect(await descifrar(llave, sobre, 'usuario-1')).toEqual({ a: 1 })
    })

    it('un sobre de la versión 5 (sin AAD) se abre aunque se pase usuario', async () => {
      const llave = await crearLlave('buena-contraseña', IT)
      const v5 = await cifrarAntiguo(llave, { a: 1 }, 5)
      expect(await descifrar(llave, v5, 'usuario-1')).toEqual({ a: 1 })
    })

    it('si cambian la versión del sobre, falla', async () => {
      const llave = await crearLlave('buena-contraseña', IT)
      const sobre = await cifrar(llave, 'dato')
      // el atacante lo etiqueta como una versión anterior para saltarse la autenticación de la versión
      await expect(descifrar(llave, { ...sobre, version: 5 })).rejects.toBeInstanceOf(ContrasenaIncorrecta)
    })

    it('si el sobre es de otro usuario, falla', async () => {
      const llave = await crearLlave('buena-contraseña', IT)
      const sobre = await cifrar(llave, 'dato', 'usuario-1')
      await expect(descifrar(llave, sobre, 'usuario-2')).rejects.toBeInstanceOf(ContrasenaIncorrecta)
      await expect(descifrar(llave, sobre)).rejects.toBeInstanceOf(ContrasenaIncorrecta)
    })

    it('un sobre de la versión 6 manipulado falla', async () => {
      const llave = await crearLlave('buena-contraseña', IT)
      const sobre = await cifrar(llave, 'dato', 'usuario-1')
      const bytes = atob(sobre.cifrado)
      const tocado = btoa(String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1))
      await expect(descifrar(llave, { ...sobre, cifrado: tocado }, 'usuario-1')).rejects.toBeInstanceOf(ContrasenaIncorrecta)
    })
  })
})
