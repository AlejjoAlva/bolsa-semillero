import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Participant from './routes/Participant'
import Display from './routes/Display'
import Host from './routes/Host'
import { CONFIG_FALTANTE, ensureAnonAuth } from './lib/firebase'
import AvisoConexion from './components/AvisoConexion'

export default function App() {
  const [estado, setEstado] = useState('cargando') // cargando | listo | error

  useEffect(() => {
    if (CONFIG_FALTANTE.length > 0) return
    ensureAnonAuth().then(
      () => setEstado('listo'),
      (err) => {
        console.error('auth anónima', err)
        setEstado('error')
      },
    )
  }, [])

  // Build hecho sin .env: no tiene sentido intentar conectarse a ningún lado.
  if (CONFIG_FALTANTE.length > 0) {
    return (
      <main className="pantalla">
        <div className="card">
          <p className="error">
            Falta config de Firebase en el build: {CONFIG_FALTANTE.join(', ')}. Llena el archivo{' '}
            <code>.env</code> (ver README §1.2) y vuelve a correr <code>npm run build</code>.
          </p>
        </div>
      </main>
    )
  }

  if (estado === 'cargando') {
    return (
      <main className="pantalla">
        <p className="ayuda">Abriendo la bolsa…</p>
      </main>
    )
  }

  if (estado === 'error') {
    return (
      <main className="pantalla">
        <div className="card">
          <p className="error">
            No pudimos conectarte. Revisa tu conexión a internet y recarga la página.
          </p>
        </div>
      </main>
    )
  }

  return (
    <BrowserRouter>
      <AvisoConexion />
      <Routes>
        <Route path="/" element={<Participant />} />
        <Route path="/display" element={<Display />} />
        <Route path="/host" element={<Host />} />
        <Route path="*" element={<Participant />} />
      </Routes>
    </BrowserRouter>
  )
}
