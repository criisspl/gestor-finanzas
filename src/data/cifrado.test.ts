import { describe, expect, it } from 'vitest'
import { abrirLlave, cifrar, ContrasenaIncorrecta, crearLlave, descifrar, type Sobre } from './cifrado'

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
    expect(sobre).toMatchObject({ version: 2, iteraciones: IT })
  })

  it('sigue abriendo sobres de la versión 1', async () => {
    const llave = await crearLlave('buena-contraseña', IT)
    const v1 = { ...(await cifrar(llave, { movimientos: [] })), version: 1 as const }
    expect(await descifrar(llave, v1)).toEqual({ movimientos: [] })
  })

  it('rechaza una versión de sobre desconocida', async () => {
    const llave = await crearLlave('buena-contraseña', IT)
    const futuro = { ...(await cifrar(llave, 1)), version: 3 } as unknown as Sobre
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
})
