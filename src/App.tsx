import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, almacenSupabase } from './data/supabase'
import { repositorioDemo, reiniciarDemo } from './data/demo'
import type { Repositorio } from './data/repositorio'
import { Acceso } from './components/Acceso'
import { Desbloqueo } from './components/Desbloqueo'
import { Panel } from './components/Panel'

export default function App() {
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
  }, [])

  const userId = sesion?.user.id
  const demo = useMemo(() => (supabase ? null : repositorioDemo()), [])
  const almacen = useMemo(() => (supabase && userId ? almacenSupabase(supabase, userId) : null), [userId])
  // El repositorio descifrado solo vale para la persona que lo abrió: al salir o cambiar de cuenta se descarta
  const [abierto, setAbierto] = useState<{ userId: string; repo: Repositorio } | null>(null)
  const repo = demo ?? (abierto && abierto.userId === userId ? abierto.repo : null)

  let contenido
  if (comprobando) contenido = <p className="estado">Cargando…</p>
  else if (repo) contenido = <Panel key={userId ?? 'demo'} repo={repo} />
  else if (almacen && userId) contenido = <Desbloqueo key={userId} almacen={almacen} onAbierto={(r) => setAbierto({ userId, repo: r })} />
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

      {!supabase && (
        <p className="nota-demo">
          Modo demo: los datos se guardan solo en este navegador.{' '}
          <button type="button" className="enlace" onClick={() => { reiniciarDemo(); window.location.reload() }}>Restablecer ejemplo</button>
        </p>
      )}

      {contenido}

      <footer className="pie">
        Las reglas son una referencia, no una obligación. No tienes que cumplir los seis números a la vez: úsalos para ver dónde estás y elegir un paso que sí puedas dar este mes.
      </footer>
    </div>
  )
}
