import { useEffect, useState } from 'react'

const MS_ARMADO = 4000

interface Props {
  onBorrar: () => unknown
  /** Qué se borra, para que quien usa lector de pantalla sepa a qué botón «Borrar» se refiere. */
  nombre?: string
  className?: string
}

/** Borrado en dos toques: el primero pide «¿Seguro?» y se desarma solo a los 4 s. */
export function BotonBorrar({ onBorrar, nombre, className = 'icono' }: Props) {
  const [armado, setArmado] = useState(false)

  useEffect(() => {
    if (!armado) return
    const t = setTimeout(() => setArmado(false), MS_ARMADO)
    return () => clearTimeout(t)
  }, [armado])

  const objeto = nombre ? ` ${nombre}` : ''
  return (
    <>
      <button
        type="button"
        className={`${className} ${armado ? 'seguro' : ''}`}
        aria-label={armado ? `¿Seguro? Pulsa de nuevo para borrar${objeto}` : `Borrar${objeto}`}
        onClick={() => {
          if (!armado) return setArmado(true)
          setArmado(false)
          onBorrar()
        }}
      >
        {armado ? '¿Seguro?' : 'Borrar'}
      </button>
      {/* Anuncia la confirmación: un cambio de etiqueta en un botón enfocado no siempre se lee */}
      <span className="solo-lector" role="status">{armado ? `¿Seguro que quieres borrar${objeto}? Pulsa de nuevo para confirmar.` : ''}</span>
    </>
  )
}
