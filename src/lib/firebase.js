import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// La config sale del archivo .env (ver README §1.2). No hay valores por defecto
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
export const db = getFirestore(app)

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
