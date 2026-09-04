/**
 * Mide el consumo REAL de lecturas de Firestore simulando celulares conectados.
 *
 * Firestore cobra una lectura por cada documento que te entrega, así que basta
 * con contar `snap.docChanges().length` en cada listener: eso es exactamente lo
 * que aparece en la factura. Cada "celular" es una app de Firebase aparte, para
 * que el SDK no comparta un solo listener entre todos y falsee la cuenta.
 *
 * Se compila y se corre así (los módulos de src/lib usan import.meta.env):
 *   npx vite build --ssr medir-lecturas.mjs --outDir .medicion
 *   node .medicion/medir-lecturas.mjs --celulares 8 --inversiones 40
 */
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { collection, doc, getDocs, getFirestore, onSnapshot } from 'firebase/firestore'
import { db, ensureAnonAuth } from './src/lib/firebase.js'
import { cambiarEstado, invertir, sincronizarActivos } from './src/lib/acciones.js'

const arg = (nombre, pordefecto) => {
  const i = process.argv.indexOf(`--${nombre}`)
  return i > -1 ? Number(process.argv[i + 1]) : pordefecto
}
const CELULARES = arg('celulares', 8)
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

/** Un celular: app propia, usuario anónimo propio y los dos listeners de Participant.jsx. */
async function abrirCelular(i) {
  const app = initializeApp(config, `celular-${i}`)
  await signInAnonymously(getAuth(app))
  const fs = getFirestore(app)
  const cuenta = { participants: 0, session: 0, snapshots: 0, rafagas: [] }

  const offP = onSnapshot(collection(fs, 'participants'), (snap) => {
    const n = snap.docChanges().length
    cuenta.participants += n
    cuenta.snapshots += 1
    cuenta.rafagas.push(n)
  })
  const offS = onSnapshot(doc(fs, 'session', 'main'), () => {
    cuenta.session += 1
  })

  return { cuenta, cerrar: () => { offP(); offS() } }
}

async function main() {
  console.log(`Midiendo con ${CELULARES} celulares simulados y ${INVERSIONES} inversiones.\n`)
  await ensureAnonAuth()

  const snap = await getDocs(collection(db, 'participants'))
  const tickers = snap.docs.filter((d) => d.data().activo !== false).map((d) => d.id)
  console.log(`Participantes activos en la base: ${tickers.length}`)
  if (tickers.length < 8) throw new Error('Hacen falta al menos 8 participantes activos para medir.')

  // El mercado tiene que estar abierto para que invertir() no rechace.
  await sincronizarActivos()
  await cambiarEstado('activo')

  console.log('Conectando celulares…')
  const celulares = []
  for (let i = 0; i < CELULARES; i++) celulares.push(await abrirCelular(i))
  await dormir(4000)

  const inicial = celulares.map((c) => ({ ...c.cuenta }))
  const cargaInicial = inicial.reduce((t, c) => t + c.participants, 0)
  console.log(`Carga inicial: ${cargaInicial} lecturas (${(cargaInicial / CELULARES).toFixed(1)} por celular)\n`)

  // Las 6 primeras inversiones apuntan al mismo objetivo para disparar la
  // corrección por sobrecompra, que es el evento caro que el modelo ingenuo
  // no contempla: toca a todos los inversores de esa acción a la vez.
  const plan = []
  const victima = tickers[0]
  for (let i = 1; i <= 6; i++) plan.push([tickers[i], victima])
  let k = 0
  while (plan.length < INVERSIONES) {
    const inv = tickers[1 + (k % (tickers.length - 1))]
    const obj = tickers[1 + ((k + 3 + Math.floor(k / (tickers.length - 1))) % (tickers.length - 1))]
    if (inv !== obj) plan.push([inv, obj])
    k++
    if (k > INVERSIONES * 8) break
  }

  console.log('Invirtiendo…')
  let hechas = 0
  let correcciones = 0
  const marcaCorreccion = []
  for (const [inv, obj] of plan.slice(0, INVERSIONES)) {
    try {
      const antes = celulares.reduce((t, c) => t + c.cuenta.participants, 0)
      const res = await invertir({ investorTicker: inv, targetTicker: obj, questionType: 'comida' })
      await dormir(650) // que lleguen los snapshots antes de medir la siguiente
      const despues = celulares.reduce((t, c) => t + c.cuenta.participants, 0)
      hechas += 1
      if (res.correccion) {
        correcciones += 1
        marcaCorreccion.push(despues - antes)
        console.log(`  · corrección por sobrecompra en $${obj}: ${res.correccion.afectados} afectados → ${despues - antes} lecturas`)
      }
      if (res.rondaCompleta) { console.log('  · la ronda se cerró sola; paro aquí'); break }
    } catch (e) {
      // "ya invertiste en esta persona" y demás rechazos: no cuentan
    }
  }

  await dormir(2500)
  const total = celulares.reduce((t, c) => t + c.cuenta.participants, 0)
  const durante = total - cargaInicial
  const sesion = celulares.reduce((t, c) => t + c.cuenta.session, 0)

  console.log(`\n${'='.repeat(64)}`)
  console.log(`Inversiones logradas ...................... ${hechas}`)
  console.log(`Correcciones por sobrecompra .............. ${correcciones}`)
  console.log(`Lecturas de 'participants' (carga inicial)  ${cargaInicial}`)
  console.log(`Lecturas de 'participants' (durante juego)  ${durante}`)
  console.log(`Lecturas de 'session' ..................... ${sesion}`)
  console.log(`${'-'.repeat(64)}`)
  const porInvPorCel = durante / hechas / CELULARES
  console.log(`POR INVERSIÓN Y POR CELULAR ............... ${porInvPorCel.toFixed(2)} lecturas`)
  console.log(`${'='.repeat(64)}\n`)

  console.log('Extrapolación al evento (35 celulares + proyector + panel = 37 clientes):')
  console.log('  inversiones   lecturas estimadas   % del tope diario (50.000)')
  for (const I of [300, 420, 550, 630]) {
    const est = 35 * tickers.length + porInvPorCel * 37 * I
    console.log(`  ${String(I).padStart(11)}   ${String(Math.round(est)).padStart(18)}   ${((est / 50000) * 100).toFixed(0).padStart(6)}%`)
  }

  for (const c of celulares) c.cerrar()
  await cambiarEstado('esperando')
  console.log('\nSesión devuelta a "esperando".')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
