import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// ---------------------------------------------------------------------------
// La config sale del archivo .env (ver docs/replicar.md §1.2). No hay valores por defecto
// a propósito: si falta alguno, la app lo dice en pantalla en vez de arrancar
// apuntando a un proyecto que no existe.
// ---------------------------------------------------------------------------
const CAMPOS = [
  ['apiKey', 'VITE_FB_API_KEY', import.meta.env.VITE_FB_API_KEY],
  ['authDomain', 'VITE_FB_AUTH_DOMAIN', import.meta.env.VITE_FB_AUTH_DOMAIN],
  ['projectId', 'VITE_FB_PROJECT_ID', import.meta.env.VITE_FB_PROJECT_ID],
  ['storageBucket', 'VITE_FB_STORAGE_BUCKET', import.meta.env.VITE_FB_STORAGE_BUCKET],
  ['messagingSenderId', 'VITE_FB_SENDER_ID', import.meta.env.VITE_FB_SENDER_ID],
  ['appId', 'VITE_FB_APP_ID', import.meta.env.VITE_FB_APP_ID],
]

/** Nombres de las variables de .env que faltaron en el build. App.jsx lo muestra en pantalla. */
export const CONFIG_FALTANTE = CAMPOS.filter(([, , valor]) => !valor).map(([, env]) => env)

// El placeholder evita que initializeApp reviente al importar el módulo: cuando falta config,
// App.jsx corta antes de que se haga cualquier llamada de red.
const firebaseConfig = Object.fromEntries(
  CAMPOS.map(([clave, env, valor]) => [clave, valor || `FALTA_${env}`]),
)

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
/**
 * Caché persistente en el navegador. Al recargar la página, los listeners se
 * reanudan desde lo que ya está guardado y Firestore entrega solo lo que cambió
 * desde entonces, en vez de mandar la colección entera otra vez. Con 35
 * celulares que recargan durante la actividad, es el ahorro más grande que se
 * puede hacer SIN tocar la inmediatez: la escucha sigue siendo en vivo y los
 * datos siguen llegando al instante.
 *
 * Si el navegador no deja usar IndexedDB (modo privado en algunos casos), cae a
 * la caché en memoria y todo sigue funcionando igual, solo que sin el ahorro.
 */
function abrirFirestore() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (err) {
    console.warn('Sin caché persistente; sigo con la de memoria.', err)
    return getFirestore(app)
  }
}

export const db = abrirFirestore()

export const USING_EMULATOR = import.meta.env.VITE_USE_EMULATOR === 'true'

// Vite recarga módulos en caliente; el flag global evita reconectar dos veces.
if (USING_EMULATOR && !globalThis.__bolsaEmulatorReady) {
  globalThis.__bolsaEmulatorReady = true
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

/** Inicia sesión anónima y resuelve con el uid. Se llama una vez al abrir la app. */
export function ensureAnonAuth() {
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          stop()
          resolve(user.uid)
        } else {
          signInAnonymously(auth).catch((err) => {
            stop()
            reject(err)
          })
        }
      },
      (err) => {
        stop()
        reject(err)
      },
    )
  })
}
