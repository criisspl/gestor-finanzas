// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { abrirBoveda, crearBoveda, type AlmacenBoveda } from './boveda.ts'
import { ContrasenaIncorrecta, type Sobre } from './cifrado.ts'
import {
  copiaDeSobre, DestinoNoVacio, exportarFichero, fuenteDeAlmacen, fuenteDeFichero, fuenteEnClaro, leerFichero, FicheroNoValido, migrar, MigracionFallida,
  SinDatos, TAMANO_MAXIMO_FICHERO,
} from './migracion.ts'
import { ESTADO_VACIO, type Estado } from './memoria.ts'

const IT = 1000
const PW = 'correcta-123'

function almacenFalso(usuario?: string, sobre: Sobre | null = null) {
  const a = {
    usuario,
    sobre,
    escrituras: 0,
    fallarEn: 0, // número de escritura que falla (1 = la primera)
    leer: async () => a.sobre,
    escribir: async (s: Sobre) => {
      a.escrituras++
      if (a.escrituras === a.fallarEn) throw new Error('red caída')
      a.sobre = s
    },
    leerSinCifrar: async (): Promise<Estado | null> => null,
    borrarSinCifrar: async () => {},
  }
  return a satisfies AlmacenBoveda & Record<string, unknown>
}

const DATOS: Estado = {
  ...ESTADO_VACIO,
  movimientos: [{ id: 'm1', tipo: 'ingreso', nombre: 'Nómina', importe: 1250 }],
  notas: [{ id: 'n1', tipo: 'ok', titulo: 'Hola', texto: 'Texto' }],
}

async function almacenConDatos(usuario: string | undefined, estado: Estado) {
  const a = almacenFalso(usuario)
  a.leerSinCifrar = async () => estado
  await crearBoveda(a, PW, IT)
  a.leerSinCifrar = async () => null
  a.escrituras = 0
  return a
}

async function leerTodo(a: AlmacenBoveda, pw = PW) {
  return fuenteDeAlmacen(a).leerEstado(pw)
}

describe('migrar', () => {
  it('ida y vuelta origen → destino → origen conserva los datos y recifra para cada usuario', async () => {
    const origen = await almacenConDatos('u-origen', DATOS)
    const destino = almacenFalso('u-destino')
    await migrar({ fuente: fuenteDeAlmacen(origen), destino, contrasena: PW, iteraciones: IT })

    expect(await leerTodo(destino)).toEqual(DATOS)
    // El sobre del destino está ligado a su usuario (AAD): no se abre con otro
    const sobre = destino.sobre!
    await expect(abrirBoveda({ ...destino, usuario: 'otro' }, sobre, PW)).rejects.toBeInstanceOf(ContrasenaIncorrecta)
    // El origen no se ha tocado
    expect(origen.escrituras).toBe(0)

    const vuelta = almacenFalso('u-origen')
    await migrar({ fuente: fuenteDeAlmacen(destino), destino: vuelta, contrasena: PW, iteraciones: IT })
    expect(await leerTodo(vuelta)).toEqual(DATOS)
  })

  it('demo (en claro) → real', async () => {
    const destino = almacenFalso('u1')
    await migrar({ fuente: fuenteEnClaro(() => DATOS), destino, contrasena: PW, iteraciones: IT })
    expect(await leerTodo(destino)).toEqual(DATOS)
  })

  it('con contraseña incorrecta no escribe nada', async () => {
    const origen = await almacenConDatos('u1', DATOS)
    const destino = almacenFalso('u2')
    await expect(migrar({ fuente: fuenteDeAlmacen(origen), destino, contrasena: 'mala-contra-1', iteraciones: IT })).rejects.toBeInstanceOf(ContrasenaIncorrecta)
    expect(destino.escrituras).toBe(0)
  })

  it('origen vacío: SinDatos', async () => {
    await expect(migrar({ fuente: fuenteDeAlmacen(almacenFalso('u1')), destino: almacenFalso('u2'), contrasena: PW, iteraciones: IT })).rejects.toBeInstanceOf(SinDatos)
  })

  it('destino con datos: no sobrescribe sin confirmación', async () => {
    const origen = await almacenConDatos('u1', DATOS)
    const destino = await almacenConDatos('u2', { ...ESTADO_VACIO, notas: [{ id: 'x', tipo: 'ok', titulo: 'Mío', texto: 't' }] })
    const antes = destino.sobre
    await expect(migrar({ fuente: fuenteDeAlmacen(origen), destino, contrasena: PW, iteraciones: IT })).rejects.toBeInstanceOf(DestinoNoVacio)
    expect(destino.sobre).toBe(antes)
    expect(destino.escrituras).toBe(0)
  })

  it('sobrescribir exige copia previa y la hace antes de escribir', async () => {
    const origen = await almacenConDatos('u1', DATOS)
    const destino = await almacenConDatos('u2', ESTADO_VACIO)
    const antes = destino.sobre
    await expect(migrar({ fuente: fuenteDeAlmacen(origen), destino, contrasena: PW, sobrescribir: true, iteraciones: IT })).rejects.toThrow('copia previa')
    expect(destino.sobre).toBe(antes)

    let copia: Sobre | null = null
    await migrar({
      fuente: fuenteDeAlmacen(origen), destino, contrasena: PW, sobrescribir: true, iteraciones: IT,
      copiaPrevia: (s) => { copia = s; expect(destino.escrituras).toBe(0) },
    })
    expect(copia).toBe(antes)
    expect(await leerTodo(destino)).toEqual(DATOS)
  })

  it('si la copia previa falla, no se toca el destino', async () => {
    const origen = await almacenConDatos('u1', DATOS)
    const destino = await almacenConDatos('u2', ESTADO_VACIO)
    const antes = destino.sobre
    await expect(migrar({
      fuente: fuenteDeAlmacen(origen), destino, contrasena: PW, sobrescribir: true, iteraciones: IT,
      copiaPrevia: () => { throw new Error('descarga bloqueada') },
    })).rejects.toThrow('descarga bloqueada')
    expect(destino.sobre).toBe(antes)
    expect(destino.escrituras).toBe(0)
  })

  it('fallo a mitad (destino vacío): origen intacto, destino sin datos y se avisa', async () => {
    const origen = await almacenConDatos('u1', DATOS)
    const sobreOrigen = origen.sobre
    const destino = almacenFalso('u2')
    destino.fallarEn = 1
    const error = await migrar({ fuente: fuenteDeAlmacen(origen), destino, contrasena: PW, iteraciones: IT }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(MigracionFallida)
    expect((error as MigracionFallida).destinoRestaurado).toBe(true)
    expect(destino.sobre).toBeNull()
    expect(origen.sobre).toBe(sobreOrigen)
  })

  it('fallo a mitad (sobrescribiendo): el destino vuelve a su sobre anterior', async () => {
    const origen = await almacenConDatos('u1', DATOS)
    const destino = await almacenConDatos('u2', ESTADO_VACIO)
    const antes = destino.sobre
    // La escritura 1 "tiene éxito" pero el destino guarda algo corrupto; la comprobación lo detecta
    const escribir = destino.escribir
    destino.escribir = async (s) => {
      if (destino.escrituras === 0) await escribir({ ...s, cifrado: 'AAAA' })
      else await escribir(s)
    }
    const error = await migrar({
      fuente: fuenteDeAlmacen(origen), destino, contrasena: PW, sobrescribir: true, copiaPrevia: () => {}, iteraciones: IT,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(MigracionFallida)
    expect((error as MigracionFallida).destinoRestaurado).toBe(true)
    expect(destino.sobre).toEqual(antes)
  })

  it('el mensaje de error no incluye la contraseña', async () => {
    const destino = almacenFalso('u2')
    destino.fallarEn = 1
    const error = (await migrar({ fuente: fuenteEnClaro(() => DATOS), destino, contrasena: PW, iteraciones: IT }).catch((e: unknown) => e)) as Error
    expect(error.message).not.toContain(PW)
  })
})

describe('fichero', () => {
  it('exportar → importar en otro destino conserva los datos', async () => {
    const texto = await exportarFichero(DATOS, PW, IT)
    const destino = almacenFalso('u9')
    await migrar({ fuente: fuenteDeFichero(texto), destino, contrasena: PW, iteraciones: IT })
    expect(await leerTodo(destino)).toEqual(DATOS)
  })

  it('el fichero solo lleva el sobre cifrado: ni contraseña ni datos en claro', async () => {
    const texto = await exportarFichero(DATOS, PW, IT)
    expect(texto).not.toContain(PW)
    expect(texto).not.toContain('Nómina')
    expect(Object.keys(JSON.parse(texto) as object).sort()).toEqual(['formato', 'sobre', 'version'])
  })

  it('exportar desde una bóveda y volver: round-trip por fichero', async () => {
    const origen = await almacenConDatos('u1', DATOS)
    const texto = await exportarFichero(await leerTodo(origen), PW, IT)
    const vuelta = almacenFalso('u1')
    await migrar({ fuente: fuenteDeFichero(texto), destino: vuelta, contrasena: PW, iteraciones: IT })
    expect(await leerTodo(vuelta)).toEqual(DATOS)
  })

  it('contraseña mala al importar', async () => {
    const texto = await exportarFichero(DATOS, PW, IT)
    await expect(fuenteDeFichero(texto).leerEstado('mala-contra-1')).rejects.toBeInstanceOf(ContrasenaIncorrecta)
  })

  it('cifrado manipulado: se rechaza como contraseña incorrecta', async () => {
    const f = JSON.parse(await exportarFichero(DATOS, PW, IT)) as { sobre: Sobre }
    f.sobre.cifrado = f.sobre.cifrado.slice(0, -8) + 'AAAAAAAA'
    await expect(fuenteDeFichero(JSON.stringify(f)).leerEstado(PW)).rejects.toBeInstanceOf(ContrasenaIncorrecta)
  })

  it.each([
    ['no es JSON', 'esto no es json'],
    ['otro formato', JSON.stringify({ formato: 'otra-cosa', version: 1, sobre: {} })],
    ['versión de fichero desconocida', JSON.stringify({ formato: 'gestor-finanzas-sobre', version: 99, sobre: {} })],
    ['sin sobre', JSON.stringify({ formato: 'gestor-finanzas-sobre', version: 1 })],
    ['array', '[]'],
    ['versión de sobre desconocida', JSON.stringify({ formato: 'gestor-finanzas-sobre', version: 1, sobre: { version: 7, sal: 'AAAA', iteraciones: 1, iv: 'AAAA', cifrado: 'AAAA' } })],
    ['iteraciones absurdas', JSON.stringify({ formato: 'gestor-finanzas-sobre', version: 1, sobre: { version: 6, sal: 'AAAA', iteraciones: 1e12, iv: 'AAAA', cifrado: 'AAAA' } })],
    ['base64 inválido', JSON.stringify({ formato: 'gestor-finanzas-sobre', version: 1, sobre: { version: 6, sal: '<script>', iteraciones: 1, iv: 'AAAA', cifrado: 'AAAA' } })],
  ])('rechaza fichero corrupto: %s', (_n, texto) => {
    expect(() => leerFichero(texto)).toThrow(FicheroNoValido)
  })

  it('rechaza un fichero demasiado grande sin analizarlo', () => {
    expect(() => leerFichero(' '.repeat(TAMANO_MAXIMO_FICHERO + 1))).toThrow('demasiado grande')
  })

  it('datos descifrados con forma rara se rechazan; campos desconocidos se descartan', async () => {
    const malo = await exportarFichero({ ...DATOS, movimientos: 'no-lista' } as unknown as Estado, PW, IT)
    await expect(fuenteDeFichero(malo).leerEstado(PW)).rejects.toBeInstanceOf(FicheroNoValido)
    const conExtra = await exportarFichero({ ...DATOS, claveIA: 'sk-secreto' } as unknown as Estado, PW, IT)
    const estado = await fuenteDeFichero(conExtra).leerEstado(PW)
    expect(estado).toEqual(DATOS)
    expect(JSON.stringify(estado)).not.toContain('sk-secreto')
  })

  it('copiaDeSobre es un fichero que se puede volver a leer', async () => {
    const a = await almacenConDatos('u1', DATOS)
    expect(leerFichero(copiaDeSobre(a.sobre!))).toEqual(a.sobre)
    // Restaurar la copia previa de esa misma cuenta
    expect(await fuenteDeFichero(copiaDeSobre(a.sobre!), 'u1').leerEstado(PW)).toEqual(DATOS)
    await expect(fuenteDeFichero(copiaDeSobre(a.sobre!), 'otro').leerEstado(PW)).rejects.toBeInstanceOf(ContrasenaIncorrecta)
  })
})
