# Reglas del juego

Tal como quedaron implementadas. Las constantes (puntos, umbrales, minutos) viven en
`src/lib/puntaje.js`; el instructivo del celular y las reglas rápidas del proyector las leen de ahí,
así que no pueden contradecir al juego.

**Áreas** — las cuatro del semillero: Macroeconomía, divisas y commodities · Inversiones
alternativas · Analítica de negocios · Mercado de capitales. Viven en `src/lib/areas.js` con tres
nombres cada una (oficial, corto para titulares y sigla de 3 letras para las tablas). El rumor de
sector y el bono de cruce se apoyan en este campo.

**Registro** — nombre, área, nuevo/antiguo y 4 respuestas privadas (comida, superpoder, anécdota,
ciudad). El ticker son las 3 primeras letras del nombre sin tildes + 2 dígitos (`ANA47`); si ese
ID ya existe se reintenta, y la verificación final ocurre dentro de una transacción, así que dos
personas registrándose al mismo tiempo no pueden quedarse con el mismo ticker. El ticker se guarda
en `localStorage`: si recargan la página no vuelven a ver el formulario. Si borran el navegador,
la app igual los reconoce por su `uid` anónimo. **El registro está siempre abierto**, incluso con
el mercado ya activo o cerrado.

**Invertir** — se elige a alguien de la lista (buscable por ticker o nombre), la app arma en
memoria una pregunta de 3 opciones sobre una de sus 4 respuestas privadas, con dos distractores
tomados de otros participantes. La pregunta se congela al abrir: no cambia mientras eligen.

**Puntos** — 2 base · +1 si es cruce nuevo↔antiguo · +1 cada vez que la racha llega a múltiplo de
3. Todo se calcula y se escribe dentro de una `runTransaction` que además crea
`investments/{investor}_{target}_r{ronda}`: por el ID compuesto, **nadie puede invertir dos veces
en la misma persona dentro de una ronda**, ni siquiera dando doble tap.

**Venta en corto** — antes de responder se puede marcar la apuesta: acertar paga el doble, fallar
cuesta 2 puntos. El castigo es elegido, así que nunca se siente injusto.

**Si fallan** — no se crea la inversión (pueden reintentar con esa persona más tarde), la racha se
va a 0 y, si habían apostado, pierden 2 puntos. Los puntos nunca bajan de 0.

**Corrección por sobrecompra** — cuando alguien llega a 6 inversiones recibidas, su acción se
declara sobrevalorada y **todos los que ya invirtieron en ella pierden 1 punto**. Premia descubrir
a quien nadie ha buscado y castiga a la manada. La marca `correccion_ronda` la hace idempotente:
si dos personas cruzan el umbral a la vez, el castigo se aplica una sola vez.

**Rumor de sector** — el anfitrión lanza un rumor sobre un área ("dicen que Macro se va a
desplomar") con 3 minutos de reloj. Cada quien elige **Mantener** o **Liquidar** en su celular; no
elegir es mantener. Al vencer el plazo el proyector **sortea** si era cierto:

| | Rumor cierto | Rumor falso |
|---|---|---|
| **Mantener** | −1 por cada persona de ese sector en tu portafolio | +1 por cada una |
| **Liquidar** | 0, te blindaste | −1 de comisión |

**El rumor se lanza solo.** El panel del host vigila la madurez del mercado y dispara el rumor
—sorteando el sector— en cuanto **al menos el 30% de la sala (mínimo 3 personas) tiene exposición
a un mismo sector**. Antes de eso el rumor no movería nada y el momento se desperdiciaría. El panel
muestra el conteo por sector para que sepas cuánto falta. El disparo automático ocurre **una sola
vez por ronda**; los siguientes rumores los lanzas tú a mano.

Quien no tenga a nadie de ese sector no se ve afectado. Mientras corre el reloj el mercado sigue
abierto, así que se puede correr a aumentar exposición o a huir a otro sector. El sorteo lo dispara
el panel del host al vencer el plazo, y es idempotente.

**Fin de la ronda** — el juego se cierra **solo** en cuanto alguien ha invertido en todo el
mercado. Se anuncia en la pantalla grande, pero **gana quien tenga más puntos**, no quien completó.

**Cierre volátil** — con el mercado ya cerrado, el anfitrión aplica el ajuste final: las 3 acciones
más compradas pierden 2 puntos y las 3 menos buscadas ganan 2. Una sola vez por ronda.

**Host** — abrir y cerrar el mercado, lanzar el rumor de sector, aplicar el cierre volátil, sacar
y devolver gente, y reiniciar la partida.
