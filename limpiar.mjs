/** Deja la app en blanco: retira a todos y sube la generación. */
import { empezarDeCero } from './src/lib/acciones.js'
import { ensureAnonAuth } from './src/lib/firebase.js'
async function main() {
  await ensureAnonAuth()
  const r = await empezarDeCero()
  console.log(`Retirados ${r.retirados} · ronda ${r.ronda} · generación ${r.generacion}`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
