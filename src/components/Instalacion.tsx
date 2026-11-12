import { useState, type FormEvent } from 'react'
import { guardarConfiguracion, validarParametros, type Configuracion } from '../data/configuracion.ts'
import { buscarProveedor, PROVEEDORES } from '../data/proveedores/index.ts'

/**
 * Dónde guarda cada persona sus datos. Primer arranque y acceso desde Ajustes.
 * `sugerida` viene preseleccionada (el instalador solo sugiere); `onCancelar` solo existe si ya hay una configuración.
 */
export function Instalacion({ sugerida, onGuardar, onCancelar }: {
  sugerida: Configuracion
  onGuardar: (c: Configuracion) => void
  onCancelar?: () => void
}) {
  const [id, setId] = useState(sugerida.proveedor)
  const [parametros, setParametros] = useState<Record<string, string>>({ ...sugerida.parametros })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [fallo, setFallo] = useState<string | null>(null)
  const proveedor = buscarProveedor(id) ?? PROVEEDORES[0]

  function enviar(e: FormEvent) {
    e.preventDefault()
    const encontrados = validarParametros(proveedor, parametros)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return
    try {
      onGuardar(guardarConfiguracion({ proveedor: proveedor.id, parametros }))
    } catch {
      setFallo('No se pudo guardar la configuración en este navegador.')
    }
  }

  return (
    <form className="bienvenida" onSubmit={enviar} noValidate>
      <h2>¿Dónde quieres guardar tus datos?</h2>
      <p className="sub">Tú decides. Puedes cambiarlo más tarde desde Ajustes; los datos ya guardados no se mueven solos de un sitio a otro.</p>
      <fieldset className="opciones">
        <legend className="sr">Dónde guardar los datos</legend>
        {PROVEEDORES.map((p) => (
          <label key={p.id} className="opcion">
            <input type="radio" name="proveedor" value={p.id} checked={p.id === proveedor.id} onChange={() => { setId(p.id); setErrores({}) }} />
            <span>
              <b>{p.nombre}</b>{p.id === sugerida.proveedor && ' · sugerido'}
              <span className="sub"> {p.descripcion}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {proveedor.campos.map((c) => (
        <label key={`${proveedor.id}-${c.clave}`} className="campo">{c.etiqueta}
          <input
            id={`inst-${c.clave}`}
            type={c.secreto ? 'password' : 'text'}
            autoComplete="off"
            spellCheck={false}
            value={parametros[c.clave] ?? ''}
            onChange={(e) => setParametros({ ...parametros, [c.clave]: e.target.value })}
            aria-invalid={!!errores[c.clave]}
          />
          {errores[c.clave] && <span className="aviso" role="alert">{errores[c.clave]}</span>}
        </label>
      ))}
      <p className="nota-demo">
        Tus datos se cifran con una contraseña que eliges tú y que <b>no se guarda en ningún sitio</b>. Si la pierdes, pierdes los datos: nadie puede recuperarlos.
      </p>
      {fallo && <p className="aviso" role="alert">{fallo}</p>}
      <div className="acciones">
        <button className="btn primario" type="submit">Guardar y continuar</button>
        {onCancelar && <button className="btn suave" type="button" onClick={onCancelar}>Cancelar</button>}
      </div>
    </form>
  )
}
