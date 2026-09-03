import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Participant from './routes/Participant'
import Display from './routes/Display'
import Host from './routes/Host'
import { ensureAnonAuth } from './lib/firebase'

export default function App() {
  const [estado, setEstado] = useState('cargando') // cargando | listo | error

  useEffect(() => {
    ensureAnonAuth().then(
      () => setEstado('listo'),
      (err) => {
        console.error('auth anónima', err)
        setEstado('error')
      },
    )
  }, [])

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
      <Routes>
        <Route path="/" element={<Participant />} />
        <Route path="/display" element={<Display />} />
        <Route path="/host" element={<Host />} />
        <Route path="*" element={<Participant />} />
      </Routes>
    </BrowserRouter>
  )
}
