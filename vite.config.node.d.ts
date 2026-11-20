// Solo lo que usa vite.config.ts de Node: el repo no depende de @types/node.
declare module 'node:crypto' {
  export function createHash(alg: string): { update(d: string): { digest(enc: 'hex'): string } }
}
declare module 'node:fs' {
  export function readFileSync(ruta: string, enc: 'utf8'): string
  export function writeFileSync(ruta: string, datos: string): void
}
declare module 'node:path' {
  export function join(...partes: string[]): string
}
