import { euros } from '../domain/formato'

export function Importe({ valor, className = '' }: { valor: number; className?: string }) {
  return <span className={`num ${className}`}>{euros(valor)}</span>
}
