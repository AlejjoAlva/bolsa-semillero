/**
 * El escenario que la prueba de carga NO cubrió: todo el mundo escaneando el
 * QR a la vez. Cada registro escribe un `increment` sobre el MISMO documento
 * de sesión, y Firestore sostiene del orden de una escritura por segundo por
 * documento. Aquí se mide qué pasa cuando llegan 35 de golpe.
 *
 *   npx vite build --ssr prueba-registro-simultaneo.mjs --outDir .medicion
 *   node .medicion/prueba-registro-simultaneo.js
 */
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { doc, getDoc, getDocs, collection, getFirestore, increment, setDoc } from 'firebase/firestore'
import { db, ensureAnonAuth } from './src/lib/firebase.js'
import { asegurarSesion, sincronizarActivos } from './src/lib/acciones.js'

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i > -1 ? Number(process.argv[i + 1]) : d
}
const GENTE = arg('gente', 35)

const config = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
}

async function main() {
  console.log(`\nPRUEBA: ${GENTE} escrituras SIMULTÁNEAS sobre el documento de sesión\n`)
  await ensureAnonAuth()
  await asegurarSesion()

  // Punto de partida conocido.
  await setDoc(doc(db, 'session', 'main'), { activos_count: 0 }, { merge: true })
  const antes = (await getDoc(doc(db, 'session', 'main'))).data().activos_count
  console.log(`activos_count antes: ${antes}`)

  console.log(`Abriendo ${GENTE} clientes independientes…`)
  const clientes = await Promise.all(
    Array.from({ length: GENTE }, async (_, i) => {
      const app = initializeApp(config, `reg-${i}`)
      await signInAnonymously(getAuth(app))
      return getFirestore(app)
    }),
  )

  console.log('Disparando los incrementos todos a la vez…')
  const t0 = Date.now()
  const res = await Promise.allSettled(
    clientes.map((fs) =>
      setDoc(doc(fs, 'session', 'main'), { activos_count: increment(1) }, { merge: true }),
    ),
  )
  const ms = Date.now() - t0

  const ok = res.filter((r) => r.status === 'fulfilled').length
  const fallos = res.filter((r) => r.status === 'rejected')
  const despues = (await getDoc(doc(db, 'session', 'main'))).data().activos_count

  console.log(`\n${'='.repeat(58)}`)
  console.log(`Escrituras aceptadas .......... ${ok}/${GENTE}`)
  console.log(`Escrituras rechazadas ......... ${fallos.length}`)
  console.log(`Tiempo total .................. ${(ms / 1000).toFixed(1)}s`)
  console.log(`activos_count después ......... ${despues} (esperado ${GENTE})`)
  console.log(`¿Se perdió algún incremento? .. ${despues === GENTE ? 'NO' : 'SÍ, ' + (GENTE - despues)}`)
  console.log(`${'='.repeat(58)}`)
  if (fallos.length) {
    const motivos = new Map()
    for (const f of fallos) {
      const m = f.reason?.code ?? f.reason?.message ?? String(f.reason)
      motivos.set(m, (motivos.get(m) ?? 0) + 1)
    }
    console.log('Motivos de rechazo:')
    for (const [m, n] of motivos) console.log(`   x${n}  ${m}`)
  }

  // Y lo que de verdad importa: el contador se puede recalcular siempre.
  const reales = (await getDocs(collection(db, 'participants'))).docs.filter(
    (d) => d.data().activo !== false,
  ).length
  const recalculado = await sincronizarActivos()
  console.log(`\nRed de seguridad: sincronizarActivos() devolvió ${recalculado}, participantes activos reales: ${reales}`)
  console.log(recalculado === reales ? '✅ el contador siempre se puede curar' : '❌ el recálculo no coincide')

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
