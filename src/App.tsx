import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, repositorioSupabase } from './data/supabase'
import { repositorioDemo, reiniciarDemo } from './data/demo'
import { Acceso } from './components/Acceso'
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
  const repo = useMemo(() => {
    if (!supabase) return repositorioDemo()
    return userId ? repositorioSupabase(supabase, userId) : null
  }, [userId])

  return (
    <div className="wrap">
      <header className="cabecera">
        <div>
          <h1>Mis finanzas</h1>
          <p className="sub">Apunta tus ingresos y gastos y mira cómo vas frente a las 6 reglas de dinero.</p>
        </div>
        {supabase && sesion && (
          <button type="button" className="btn suave" onClick={() => supabase!.auth.signOut()}>Salir</button>
        )}
      </header>

      {!supabase && (
        <p className="nota-demo">
          Modo demo: los datos se guardan solo en este navegador.{' '}
          <button type="button" className="enlace" onClick={() => { reiniciarDemo(); window.location.reload() }}>Restablecer ejemplo</button>
        </p>
      )}

      {comprobando ? <p className="estado">Cargando…</p> : repo ? <Panel key={userId ?? 'demo'} repo={repo} /> : <Acceso db={supabase!} />}

      <footer className="pie">
        Las reglas son una referencia, no una obligación. No tienes que cumplir los seis números a la vez: úsalos para ver dónde estás y elegir un paso que sí puedas dar este mes.
      </footer>
    </div>
  )
}
