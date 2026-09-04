/**
 * Auditoría de concurrencia: 35 celulares simultáneos contra el proyecto REAL.
 * Comprueba lo único que no se puede deducir leyendo el código:
 *   - que 35 cuentas anónimas entren a la vez (hay tope de 100/hora por IP),
 *   - que 35 clientes sostengan sus listeners a la vez,
 *   - que las transacciones concurrentes no se pisen,
 *   - cuántas lecturas cuesta todo eso de verdad.
 *
 *   npx vite build --ssr prueba-carga.mjs --outDir .medicion
 *   node .medicion/prueba-carga.js
 */
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { collection, doc, getDocs, getFirestore, onSnapshot } from 'firebase/firestore'
import { db, ensureAnonAuth } from './src/lib/firebase.js'
import {
  asegurarSesion,
  cambiarEstado,
  invertir,
  registrarParticipante,
  sincronizarActivos,
} from './src/lib/acciones.js'

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i > -1 ? Number(process.argv[i + 1]) : d
}
const GENTE = arg('gente', 35)
const INVERSIONES = arg('inversiones', 60)
const OLA = arg('ola', 10)

const config = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const NOMBRES = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fabio', 'Gina', 'Hugo', 'Iris', 'Jairo',
  'Kena', 'Luis', 'Mara', 'Nico', 'Olga', 'Pablo', 'Queta', 'Raul', 'Sara', 'Tulio',
  'Ursula', 'Vito', 'Wendy', 'Xime', 'Yago', 'Zoe', 'Alba', 'Beto', 'Cira', 'Dani',
  'Emma', 'Fito', 'Gabi', 'Hilda', 'Ivan',
]
const AREAS = ['macro', 'alternativas', 'analitica', 'capitales']

async function main() {
  console.log(`\nAUDITORÍA · ${GENTE} celulares · ${INVERSIONES} inversiones concurrentes\n`)
  const t0 = Date.now()
  await ensureAnonAuth()
  await asegurarSesion()

  console.log('1. Registrando participantes…')
  const tickers = []
  for (let i = 0; i < GENTE; i++) {
    const t = await registrarParticipante(
      {
        nombre: NOMBRES[i % NOMBRES.length],
        area: AREAS[i % 4],
        seniority: i % 3 === 0 ? 'nuevo' : 'antiguo',
        respuestas: {
          comida: `Comida${i}`,
          superpoder: `Poder${i}`,
          anecdota: `Anecdota${i}`,
          ciudad: `Ciudad${i}`,
        },
      },
      new Set(tickers),
    )
    tickers.push(t)
  }
  console.log(`   ${tickers.length} registrados · tickers únicos: ${new Set(tickers).size}`)

  console.log('\n2. Conectando los celulares A LA VEZ (auth anónima simultánea)…')
  const tAuth = Date.now()
  const resultados = await Promise.allSettled(
    tickers.map(async (miTicker, i) => {
      const app = initializeApp(config, `carga-${i}`)
      await signInAnonymously(getAuth(app))
      const fs = getFirestore(app)
      const cuenta = { inicial: 0, propio: 0, session: 0 }
      const snap = await getDocs(collection(fs, 'participants'))
      cuenta.inicial = snap.size
      const offP = onSnapshot(doc(fs, 'participants', miTicker), () => {
        cuenta.propio += 1
      })
      const offS = onSnapshot(doc(fs, 'session', 'main'), () => {
        cuenta.session += 1
      })
      return { miTicker, cuenta, cerrar: () => { offP(); offS() } }
    }),
  )
  const vivos = resultados.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  const caidos = resultados.filter((r) => r.status === 'rejected')
  console.log(`   conectados: ${vivos.length}/${GENTE} en ${((Date.now() - tAuth) / 1000).toFixed(1)}s`)
  if (caidos.length) {
    console.log(`   FALLARON ${caidos.length}:`)
    for (const c of caidos.slice(0, 3)) console.log(`      ${c.reason?.code ?? c.reason?.message}`)
  }
  await dormir(3000)
  const cargaInicial = vivos.reduce((t, c) => t + c.cuenta.inicial, 0)
  const propioBase = vivos.reduce((t, c) => t + c.cuenta.propio, 0)

  await sincronizarActivos()
  await cambiarEstado('activo')

  console.log(`\n3. ${INVERSIONES} inversiones en olas de ${OLA} simultáneas…`)
  const pares = []
  for (let k = 0; pares.length < INVERSIONES && k < INVERSIONES * 6; k++) {
    const a = tickers[k % tickers.length]
    const b = tickers[(k * 7 + 3) % tickers.length]
    if (a !== b && !pares.some(([x, y]) => x === a && y === b)) pares.push([a, b])
  }
  let ok = 0
  const errores = new Map()
  const tInv = Date.now()
  for (let i = 0; i < pares.length; i += OLA) {
    const ola = pares.slice(i, i + OLA)
    const res = await Promise.allSettled(
      ola.map(([inv, obj]) =>
        invertir({ investorTicker: inv, targetTicker: obj, questionType: 'comida' }),
      ),
    )
    for (const r of res) {
      if (r.status === 'fulfilled') ok++
      else {
        const m = r.reason?.message ?? String(r.reason)
        errores.set(m, (errores.get(m) ?? 0) + 1)
      }
    }
  }
  const segundos = (Date.now() - tInv) / 1000
  console.log(`   ${ok}/${pares.length} exitosas en ${segundos.toFixed(1)}s (${(ok / segundos).toFixed(1)}/s)`)
  if (errores.size) {
    console.log('   Rechazos:')
    for (const [m, n] of errores) console.log(`      x${n}  ${m}`)
  }

  await dormir(3000)
  const propio = vivos.reduce((t, c) => t + c.cuenta.propio, 0) - propioBase
  const sesion = vivos.reduce((t, c) => t + c.cuenta.session, 0)
  const total = cargaInicial + propio + sesion

  console.log(`\n${'='.repeat(62)}`)
  console.log(`Celulares conectados a la vez ......... ${vivos.length}/${GENTE}`)
  console.log(`Inversiones concurrentes exitosas ..... ${ok}/${pares.length}`)
  console.log(`Carga inicial (cada uno la colección) . ${cargaInicial} lecturas`)
  console.log(`Documento propio durante el juego ..... ${propio} lecturas`)
  console.log(`Sesión ................................ ${sesion} lecturas`)
  console.log(`TOTAL DE LA PRUEBA .................... ${total} lecturas`)
  console.log(`Por inversión (a todos los celulares) . ${(propio / ok).toFixed(2)}`)
  console.log(`${'='.repeat(62)}`)

  const porInv = propio / ok
  console.log('\nProyección al evento real (1 hora, 35 personas):')
  for (const I of [300, 420, 630]) {
    const est = cargaInicial + porInv * I + 4 * I + 3 * I
    console.log(
      `  ${String(I).padStart(3)} inversiones -> ${String(Math.round(est)).padStart(6)} lecturas (${((est / 50000) * 100).toFixed(0)}% del tope)`,
    )
  }

  for (const c of vivos) c.cerrar()
  await cambiarEstado('esperando')
  console.log(`\nDuración total: ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
