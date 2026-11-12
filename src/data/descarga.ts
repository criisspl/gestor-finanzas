/** Descarga `texto` como fichero desde el navegador. Nada sale a ningún servidor. */
export function descargarFichero(nombre: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function nombreCopia(prefijo: string): string {
  return `gestor-finanzas-${prefijo}-${new Date().toISOString().slice(0, 10)}.json`
}

/** Contenido de un fichero elegido por la persona, como texto. */
export function leerTexto(fichero: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result))
    lector.onerror = () => reject(lector.error)
    lector.readAsText(fichero)
  })
}
