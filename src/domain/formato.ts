// es-ES no separa los miles en números de 4 cifras (1250,00 €); de-DE usa el mismo formato y sí lo hace (1.250,00 €)
const formatoEuros = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
export const euros = (n: number) => formatoEuros.format(n)

export const hoy = () => new Date().toLocaleDateString('sv-SE')
export const mesActual = () => hoy().slice(0, 7)

/** Suma `delta` meses a un mes en formato YYYY-MM. */
export function moverMes(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 15)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function nombreMes(mes: string): string {
  const t = new Date(`${mes}-15T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function nombreDia(fecha: string): string {
  const t = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return fecha === hoy() ? `Hoy · ${t}` : t
}

/** Acepta "1.250", "1250,50", "12.5" o "12,50 €". Devuelve null si no es un importe válido. */
export function parsearImporte(texto: string): number | null {
  const limpio = texto.replace(/€|\s/g, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$|^\d+(\.\d+)?$/.test(limpio)) return null
  // En español el punto separa miles ("1.250") y la coma decimales ("12,50")
  const n = limpio.includes(',')
    ? Number(limpio.replace(/\./g, '').replace(',', '.'))
    : /^\d{1,3}(\.\d{3})+$/.test(limpio)
      ? Number(limpio.replace(/\./g, ''))
      : Number(limpio)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}
