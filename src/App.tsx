import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { cargarConfiguracion, seleccionar, sugerirDesdeEntorno, type Configuracion } from './data/configuracion.ts'
import { clienteSupabase, usaBoveda, type Seleccion } from './data/proveedores/index.ts'
import { reiniciarDemo } from './data/demo'
import type { Repositorio } from './data/repositorio'
import { Acceso } from './components/Acceso'
import { Desbloqueo } from './components/Desbloqueo'
import { Instalacion } from './components/Instalacion.tsx'
import { Panel } from './components/Panel'
import { useBloqueoInactividad } from './hooks/useBloqueoInactividad.ts'

/** Elige dónde se guardan los datos (la configuración de la persona; el entorno solo sugiere) y monta la app con ese proveedor. */
export default function App() {
  const [config, setConfig] = useState<Configuracion | null>(() => cargarConfiguracion(import.meta.env))
  const [cambiando, setCambiando] = useState(false)

  const instalacion = (!config || cambiando) && (
    <div className="wrap">
      <Instalacion
        sugerida={config ?? sugerirDesdeEntorno(import.meta.env)}
        onGuardar={(c) => { setConfig(c); setCambiando(false) }}
        onCancelar={config ? () => setCambiando(false) : undefined}
      />
    </div>
  )
  if (!config) return instalacion
  // `key`: al cambiar de proveedor se descarta todo el estado (sesión, repositorio y clave en memoria).
  // Mientras se elige solo se oculta: si se cancela, la bóveda abierta sigue abierta
  return (
    <>
      {instalacion}
      <div hidden={cambiando}>
        <Finanzas key={JSON.stringify(config)} seleccion={seleccionar(config)} onCambiarAlmacenamiento={() => setCambiando(true)} />
      </div>
    </>
  )
}

function Finanzas({ seleccion, onCambiarAlmacenamiento }: { seleccion: Seleccion; onCambiarAlmacenamiento: () => void }) {
  const { proveedor, config } = seleccion
  const supabase = proveedor.id === 'supabase' ? clienteSupabase(config) : null
  const [sesion, setSesion] = useState<Session | null>(null)
  const [comprobando, setComprobando] = useState(!!supabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setComprobando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [supabase])

  const userId = sesion?.user.id
  // Sin bóveda (datos de ejemplo) el repositorio se crea una vez; con bóveda hay que desbloquearla
  const sinBoveda = useMemo(() => (usaBoveda(proveedor) ? null : proveedor.crearRepositorio()), [proveedor])
  const almacen = useMemo(
    () => (usaBoveda(proveedor) && (userId || !supabase) ? proveedor.crearAlmacen(config, { usuario: userId }) : null),
    [proveedor, config, supabase, userId],
  )
  // El repositorio descifrado solo vale para la persona que lo abrió: al salir o cambiar de cuenta se descarta
  const [abierto, setAbierto] = useState<{ userId: string | undefined; repo: Repositorio } | null>(null)
  const repo = sinBoveda ?? (abierto && abierto.userId === userId ? abierto.repo : null)

  // Al bloquear se descarta el repositorio (y con él la clave en memoria): vuelve el Desbloqueo. Sin bóveda no hay clave
  const bloquear = () => setAbierto(null)
  useBloqueoInactividad(!sinBoveda && !!repo, bloquear)

  let contenido
  if (comprobando) contenido = <p className="estado">Cargando…</p>
  else if (repo) contenido = <Panel key={userId ?? proveedor.id} repo={repo} onCambiarAlmacenamiento={onCambiarAlmacenamiento} />
  else if (almacen) contenido = <Desbloqueo key={userId ?? proveedor.id} almacen={almacen} onAbierto={(r) => setAbierto({ userId, repo: r })} />
  else contenido = <Acceso db={supabase!} />

  return (
    <div className="wrap">
      <header className="cabecera">
        <div>
          <h1>Mis finanzas</h1>
          <p className="sub">Apunta tus ingresos y gastos y mira cómo vas frente a las 6 reglas de dinero.</p>
        </div>
        {supabase && sesion && (
          <button type="button" className="btn suave" onClick={() => { setAbierto(null); supabase!.auth.signOut() }}>Salir</button>
        )}
      </header>

      {sinBoveda && (
        <p className="nota-demo">
          Modo demo: los datos se guardan solo en este navegador.{' '}
          <button type="button" className="enlace" onClick={() => { reiniciarDemo(); window.location.reload() }}>Restablecer ejemplo</button>
        </p>
      )}

      {contenido}

      {!repo && (
        <p className="sub">
          <button type="button" className="enlace" onClick={onCambiarAlmacenamiento}>Cambiar dónde se guardan mis datos</button>
        </p>
      )}

      <footer className="pie">
        Las reglas son una referencia, no una obligación. No tienes que cumplir los seis números a la vez: úsalos para ver dónde estás y elegir un paso que sí puedas dar este mes.
      </footer>
    </div>
  )
}
