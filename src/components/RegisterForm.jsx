import { useState } from 'react'
import { AREAS } from '../lib/data'
import { ErrorAmable, registrarParticipante } from '../lib/acciones'

const CAMPOS = [
  { key: 'comida', label: 'Tu comida favorita', placeholder: 'Ej. bandeja paisa' },
  { key: 'superpoder', label: 'Un superpoder que querrías tener', placeholder: 'Ej. teletransportarme' },
  { key: 'anecdota', label: 'Una anécdota curiosa tuya', placeholder: 'Ej. me perdí en un aeropuerto 6 horas' },
  { key: 'ciudad', label: 'Tu ciudad de origen', placeholder: 'Ej. Barranquilla' },
]

const VACIO = { comida: '', superpoder: '', anecdota: '', ciudad: '' }

export default function RegisterForm({ tickersExistentes, onRegistrado }) {
  const [nombre, setNombre] = useState('')
  const [area, setArea] = useState(AREAS[0].key)
  const [seniority, setSeniority] = useState('nuevo')
  const [respuestas, setRespuestas] = useState(VACIO)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const faltantes =
    nombre.trim().length < 2 || CAMPOS.some((c) => respuestas[c.key].trim().length === 0)

  async function enviar(evento) {
    evento.preventDefault()
    if (enviando || faltantes) return

    setEnviando(true)
    setError('')

    try {
      const ticker = await registrarParticipante({ nombre, area, seniority, respuestas }, tickersExistentes)
      onRegistrado(ticker)
    } catch (err) {
      console.error('registro', err)
      setError(
        err instanceof ErrorAmable
          ? err.message
          : 'No pudimos completar tu registro. Revisa tu conexión e intenta de nuevo.',
      )
      setEnviando(false)
    }
  }

  return (
    <form className="card" onSubmit={enviar}>
      <h2>Sal a bolsa</h2>
      <p className="ayuda">
        Tus respuestas quedan ocultas: son las que otros tendrán que adivinar después de hablar contigo.
      </p>

      <label className="campo">
        <span>Tu nombre</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={40}
          autoComplete="name"
          placeholder="Nombre y apellido"
        />
      </label>

      <label className="campo">
        <span>Tu área</span>
        <select value={area} onChange={(e) => setArea(e.target.value)}>
          {AREAS.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="campo">
        <legend>¿Eres nuevo o antiguo en el semillero?</legend>
        <div className="opciones-fila">
          {['nuevo', 'antiguo'].map((valor) => (
            <label key={valor} className={`pastilla ${seniority === valor ? 'activa' : ''}`}>
              <input
                type="radio"
                name="seniority"
                value={valor}
                checked={seniority === valor}
                onChange={() => setSeniority(valor)}
              />
              {valor === 'nuevo' ? 'Nuevo' : 'Antiguo'}
            </label>
          ))}
        </div>
      </fieldset>

      {CAMPOS.map((campo) => (
        <label key={campo.key} className="campo">
          <span>{campo.label}</span>
          <input
            value={respuestas[campo.key]}
            onChange={(e) => setRespuestas({ ...respuestas, [campo.key]: e.target.value })}
            maxLength={80}
            placeholder={campo.placeholder}
          />
        </label>
      ))}

      {error && <p className="error">{error}</p>}

      <button className="boton primario" type="submit" disabled={enviando || faltantes}>
        {enviando ? 'Registrando…' : 'Salir a bolsa'}
      </button>
      {faltantes && !enviando && <p className="ayuda">Completa todos los campos para continuar.</p>}
    </form>
  )
}
