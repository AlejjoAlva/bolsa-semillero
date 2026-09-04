/**
 * Mide el consumo del esquema NUEVO del celular (useRoster): carga única del
 * listado + listener del documento propio. Cada celular simulado se ata a un
 * ticker real, y todas las inversiones ocurren ENTRE esos tickers, para que la
 * medición refleje el evento real, donde todo el mundo tiene celular y cada
 * inversión toca a dos personas que sí están escuchando.
 *
 *   npx vite build --ssr medir-nuevo.mjs --outDir .medicion
 *   node .medicion/medir-nuevo.js --celulares 12 --inversiones 40
 */
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { collection, doc, getDocs, getFirestore, onSnapshot } from 'firebase/firestore'
import { db, ensureAnonAuth } from './src/lib/firebase.js'
import { cambiarEstado, invertir, sincronizarActivos } from './src/lib/acciones.js'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? Number(process.argv[i + 1]) : d }
const CELULARES = arg('celulares', 12)
const INVERSIONES = arg('inversiones', 40)

const config = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

/** Un celular con el esquema nuevo: una carga y luego solo su propio documento. */
async function abrirCelular(i, miTicker) {
  const app = initializeApp(config, `nuevo-${i}`)
  await signInAnonymously(getAuth(app))
  const fs = getFirestore(app)
  const cuenta = { inicial: 0, propio: 0, session: 0 }

  const snap = await getDocs(collection(fs, 'participants'))
  cuenta.inicial = snap.size

  const offP = onSnapshot(doc(fs, 'participants', miTicker), () => { cuenta.propio += 1 })
  const offS = onSnapshot(doc(fs, 'session', 'main'), () => { cuenta.session += 1 })
  return { miTicker, cuenta, cerrar: () => { offP(); offS() } }
}

async function main() {
  console.log(`Esquema NUEVO: ${CELULARES} celulares, ${INVERSIONES} inversiones entre ellos.\n`)
  await ensureAnonAuth()
  const snap = await getDocs(collection(db, 'participants'))
  const tickers = snap.docs.filter((d) => d.data().activo !== false).map((d) => d.id)
  const mios = tickers.slice(0, CELULARES)
  await sincronizarActivos()
  await cambiarEstado('activo')

  const celulares = []
  for (let i = 0; i < mios.length; i++) celulares.push(await abrirCelular(i, mios[i]))
  await dormir(3000)

  const inicial = celulares.reduce((t, c) => t + c.cuenta.inicial, 0)
  const propioBase = celulares.reduce((t, c) => t + c.cuenta.propio, 0)
  console.log(`Carga inicial: ${inicial} lecturas (${inicial / CELULARES} por celular)`)

  // Igual que antes: las 6 primeras al mismo objetivo, para provocar la corrección.
  const plan = []
  const victima = mios[0]
  for (let i = 1; i <= 6; i++) plan.push([mios[i], victima])
  let k = 0
  while (plan.length < INVERSIONES) {
    const a = mios[1 + (k % (mios.length - 1))]
    const b = mios[1 + ((k + 4 + Math.floor(k / (mios.length - 1))) % (mios.length - 1))]
    if (a !== b) plan.push([a, b])
    k++
    if (k > INVERSIONES * 10) break
  }

  console.log('Invirtiendo…')
  let hechas = 0
  let correcciones = 0
  for (const [inv, obj] of plan.slice(0, INVERSIONES)) {
    try {
      const antes = celulares.reduce((t, c) => t + c.cuenta.propio, 0)
      const res = await invertir({ investorTicker: inv, targetTicker: obj, questionType: 'comida' })
      await dormir(650)
      const despues = celulares.reduce((t, c) => t + c.cuenta.propio, 0)
      hechas += 1
      if (res.correccion) {
        correcciones += 1
        console.log(`  · corrección en $${obj}: ${res.correccion.afectados} afectados → ${despues - antes} lecturas`)
      }
      if (res.rondaCompleta) { console.log('  · ronda cerrada sola; paro'); break }
    } catch { /* rechazos esperados */ }
  }

  await dormir(2500)
  const propio = celulares.reduce((t, c) => t + c.cuenta.propio, 0) - propioBase
  const sesion = celulares.reduce((t, c) => t + c.cuenta.session, 0)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Inversiones ......................... ${hechas}`)
  console.log(`Correcciones ........................ ${correcciones}`)
  console.log(`Carga inicial (total) ............... ${inicial}`)
  console.log(`Documento propio (durante el juego) . ${propio}`)
  console.log(`Sesión .............................. ${sesion}`)
  console.log(`POR INVERSIÓN (a todos los celulares) ${(propio / hechas).toFixed(2)}`)
  console.log(`${'='.repeat(60)}\n`)

  const porInv = propio / hechas
  console.log('Extrapolación al evento (35 celulares + proyector + panel):')
  console.log('  inversiones   lecturas   % del tope')
  for (const I of [300, 420, 550, 630]) {
    // celulares: carga inicial + documento propio. proyector y panel: todo en vivo.
    const est = 35 * 35 + porInv * I + 2 * 2 * I + 7 * 2 * 35 + 3 * I
    console.log(`  ${String(I).padStart(11)}   ${String(Math.round(est)).padStart(8)}   ${((est / 50000) * 100).toFixed(0).padStart(5)}%`)
  }

  for (const c of celulares) c.cerrar()
  await cambiarEstado('esperando')
  console.log('\nSesión devuelta a "esperando".')
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
