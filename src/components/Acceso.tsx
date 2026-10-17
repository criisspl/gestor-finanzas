import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Inicio de sesión sin contraseña: Supabase envía un enlace mágico al correo. */
export function Acceso({ db }: { db: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'inicio' | 'enviando' | 'enviado' | 'error'>('inicio')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEstado('enviando')
    const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    setEstado(error ? 'error' : 'enviado')
  }

  if (estado === 'enviado') {
    return (
      <div className="bienvenida">
        <h2>Revisa tu correo</h2>
        <p className="sub">Te hemos enviado un enlace a <b>{email}</b>. Ábrelo en este dispositivo para entrar.</p>
      </div>
    )
  }

  return (
    <form className="bienvenida" onSubmit={enviar}>
      <h2>Entra con tu correo</h2>
      <p className="sub">Sin contraseñas: te mandamos un enlace para entrar. Tus datos solo los ves tú.</p>
      <label className="campo">Correo electrónico
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      {estado === 'error' && <p className="aviso" role="alert">No se pudo enviar el enlace. Comprueba el correo e inténtalo de nuevo.</p>}
      <div><button className="btn primario" type="submit" disabled={estado === 'enviando'}>{estado === 'enviando' ? 'Enviando…' : 'Enviarme el enlace'}</button></div>
    </form>
  )
}
