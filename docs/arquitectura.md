# Arquitectura

Una sola SPA con tres rutas, sin servidor propio.

| Ruta | Para quién |
|---|---|
| `/` | Celular de cada participante |
| `/display` | Proyector |
| `/host` | Panel del anfitrión (pide contraseña) |

**Stack:** Vite + React + react-router · Firestore (listeners en vivo) · Firebase Auth anónima ·
Firebase Hosting · plan Spark. **Sin Cloud Functions:** toda la lógica corre en el cliente y escribe
directo a Firestore, protegida por `firestore.rules`.

## Código

```
src/
  routes/       Participant.jsx · Display.jsx · Host.jsx
  components/   RegisterForm · InvestModal · Leaderboard · LogFeed · Cinta · RumorCard
                RumorBanner · ResumenMercado · Instrucciones · AvisoConexion
                FraseMercado · Podio · Firma
  lib/
    firebase.js        init de la app, auth anónima, caché persistente, emulador
    data.js            useRoster (celular) y useParticipants (proyector y panel), conexión
    acciones.js        todas las escrituras: registrar, invertir, rumor, host
    puntaje.js         reglas puras: puntos, rumor, hitos, cierre (lo que prueban los tests)
    participantes.js   activos · fusionarRoster · marcaMasReciente · debeOlvidarRegistro · deLaGeneracion
    ticker.js          generación de tickers e ID de inversión
    quiz.js            armado de la pregunta con distractores
    areas.js           las cuatro áreas con nombre oficial, corto y sigla
tests/logica.test.mjs  71 pruebas de la lógica pura (node --test)
scripts/seed.mjs       siembra participantes falsos
firestore.rules        el único filtro real de seguridad
```

## Modelo de datos (Firestore)

| Colección | Contenido |
|---|---|
| `participants/{ticker}` | Perfil, puntos, racha, inversiones recibidas, `activo`, `generacion`, respuestas privadas |
| `investments/{inversor_objetivo_rN}` | Una inversión; el id compuesto impide repetirla dentro de una ronda |
| `logs/{id}` | Registro de actividad que ve el proyector |
| `session/main` | Estado del mercado, rumor, `ronda`, `generacion`, `activos_count` |

## Decisiones que no conviene deshacer

- **Sin Cloud Functions.** Es un compromiso consciente: grupo cerrado y sala supervisada. Ver los
  límites en [`seguridad-y-limites.md`](seguridad-y-limites.md).
- **La lógica de puntos es pura** (`puntaje.js`) y está probada sin red. El instructivo y las reglas
  rápidas leen sus constantes, así que nunca pueden contradecir al juego.
- **Las reglas prohíben borrar desde el cliente.** La contraseña de `/host` es solo de interfaz;
  abrir el borrado dejaría vaciar el juego desde la consola del navegador. Por eso «Empezar de cero»
  *oculta* en lugar de borrar.
- **«Empezar de cero» usa una `generacion`.** Cada registro guarda la generación en la que se
  inscribió; el panel solo muestra la vigente. A quien el anfitrión saca a mano **sí** se le sigue
  viendo (es de esta generación, solo inactivo) porque hay que poder devolverlo. Los documentos sin el
  campo cuentan como generación 0, así que no hace falta migrar.
- **El contador de ronda se conserva internamente** aunque no se muestre: filtra el log y las
  inversiones por partida y hace posible «Empezar de cero» sin tocar transacciones verificadas.
- **El proyector es la vista en vivo principal.** El celular no escucha la lista completa a propósito
  (ver [`cuota-y-rendimiento.md`](cuota-y-rendimiento.md)).
- **En el proyector, sin scroll, lo de altura fija se mide en `vh`, no en `vw`.** Con `vw`, en un
  televisor panorámico el contenido crecería y quedaría cortado sin aviso.

## Interfaz

- Celular: mobile-first estricto, «funcional antes que bonito».
- Proyector: una sola vista sin scroll (`height: 100dvh; overflow: hidden` a partir de 900 px), con
  rankings, QR con reglas rápidas, log y una cinta de tickers. Al cerrar el mercado muestra un podio
  con los tres primeros y 8 indicadores calculados en memoria (cero lecturas extra), incluido
  cuántas personas se quedaron sin recibir ninguna inversión.
- Una frase rotativa traduce jerga bursátil a «habla con gente» (61 frases: 51 curiosidades de
  economía por sector y 10 sobre la sala).
