import { useEffect, useState } from 'react'

const MS_ARMADO = 4000

interface Props {
  onBorrar: () => unknown
  className?: string
}

/** Borrado en dos toques: el primero pide «¿Seguro?» y se desarma solo a los 4 s. */
export function BotonBorrar({ onBorrar, className = 'icono' }: Props) {
  const [armado, setArmado] = useState(false)

  useEffect(() => {
    if (!armado) return
    const t = setTimeout(() => setArmado(false), MS_ARMADO)
    return () => clearTimeout(t)
  }, [armado])

  return (
    <button
      type="button"
      className={`${className} ${armado ? 'seguro' : ''}`}
      onClick={() => {
        if (!armado) return setArmado(true)
        setArmado(false)
        onBorrar()
      }}
    >
      {armado ? '¿Seguro?' : 'Borrar'}
    </button>
  )
}
