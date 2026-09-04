import { useConexion } from '../lib/data'

/**
 * Barra fija que aparece cuando la app pierde el hilo con Firestore. Sin esto,
 * una caída de red deja las pantallas con datos viejos y aspecto de estar bien:
 * el ranking simplemente deja de moverse y nadie sabe por qué.
 *
 * No hay botón de reintentar a propósito: Firestore reconecta solo y el aviso
 * desaparece cuando vuelve a llegar un snapshot.
 */
export default function AvisoConexion() {
  const caido = useConexion()
  if (!caido) return null

  return (
    <div className="aviso-conexion" role="status">
      Sin conexión con el mercado. Lo que ves puede estar desactualizado — se
      reconecta solo en cuanto vuelva la red.
    </div>
  )
}
