import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// PEGA AQUÍ TU CONFIG DE FIREBASE (o mejor: llena el archivo .env, ver README)
// Consola de Firebase > Configuración del proyecto > Tus apps > Config
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY ?? 'demo-api-key',
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN ?? 'demo-bolsa.firebaseapp.com',
  projectId: import.meta.env.VITE_FB_PROJECT_ID ?? 'demo-bolsa',
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET ?? 'demo-bolsa.appspot.com',
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID ?? '000000000000',
  appId: import.meta.env.VITE_FB_APP_ID ?? '1:000000000000:web:0000000000000000',
}

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
