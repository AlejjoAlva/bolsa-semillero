# Lecciones aprendidas

Errores reales de la construcción y decisiones que costó tomar. Es la parte del conocimiento que el
código no cuenta por sí sola.

## Errores que se encontraron y corrigieron

**`useRoster` borraba el registro recién creado, a todo el mundo.** Al registrarse, el listado es
todavía la foto anterior y el listener del documento propio aún no ha respondido: `yo` sale `null`
con el ticker puesto, y el efecto de «ticker huérfano» borraba el registro. Se recuperaba solo al
llegar el siguiente cambio de `activos_count`, pero si esa escritura fallaba, la persona quedaba
atrapada en el formulario. *Arreglo:* `useRoster` expone `propioResuelto` y el ticker solo se descarta
cuando el listener del documento propio confirmó que no existe.
**Lección:** al cambiar un `onSnapshot` de colección por `getDocs`, revisa todo efecto que deduzca una
*ausencia* a partir del listado.

**`getDocs` no reintenta como `onSnapshot`.** Sin reintento, un fallo de red al abrir dejaba el
listado vacío; como la pantalla del participante borra su `localStorage` cuando no encuentra el
perfil, esa persona se habría registrado dos veces. Ahora hay 4 reintentos con espera exponencial y
`cargado` solo se marca si hubo respuesta.

**El registro se caía si fallaba la escritura de `activos_count`**, pero la persona ya estaba
inscrita (el documento se crea dentro de la transacción) → habría quedado con dos tickers. Esa
escritura es ahora accesoria.

**La recuperación por `uid` resucitaba tickers retirados** tras «Empezar de cero», porque el
documento viejo conserva el mismo `uid` anónimo. Dejaba al celular atascado en «el anfitrión te sacó
del mercado», y como la generación ya estaba guardada, ningún reinicio posterior lo limpiaba.
*Arreglo:* la recuperación filtra por `esActivo` y por generación.

**`empezarDeCero` escribe la sesión antes de retirar a la gente.** Al revés, un fallo entre ambas
dejaba a todos con su ticker y el documento ya inactivo, atrapados sin vuelta al registro.

**El podio espera a que no quede rumor sin resolver.** El resolutor de respaldo del proyector reparte
puntos 8 s después de cerrar, y habría recolocado el podio en vivo.

**`registrarFallo` recibe la ronda**; sin ella, `escribirLog` gastaba una lectura de sesión por cada
respuesta fallida.

**`COMISION_LIQUIDAR` estaba re-exportada pero no importada** en `acciones.js`; usarla en una
plantilla habría reventado en tiempo de ejecución. Se detectó antes del evento.

## Hallazgo conocido, no corregido a propósito

`activos_count` es la única señal de refresco del celular y puede ser un *no-op* si un registro (+1)
y una salida (−1) caen entre dos instantáneas. Esa persona quedaría invisible para los demás hasta
que alguien pulse «Actualizar lista». Corregirlo exige un campo `roster_version` en tres rutas de
escritura; se decidió no tocarlo a días del evento porque el botón manual y el proyector (siempre en
vivo) lo mitigan.

## Decisiones que se tomaron explícitamente

- **No «mejorar» lo que el organizador descartó:** sin Cloud Functions, sin epochs de reseteo, sin
  power-ups manuales, sin eventos de mercado más allá del rumor, sin detección de trampa, sin
  animaciones ni sonidos. «Funcional antes que bonito».
- **No se separaron los documentos en `perfiles`/`marcadores`.** Era la propuesta inicial para bajar
  el consumo. Se descartó porque el ahorro no venía de partir documentos sino de que el celular
  dejara de recibir los ajenos, y eso se logra tocando 4 archivos en vez de 7 y sin invalidar la
  verificación de las transacciones.
- **No se abrió el borrado en las reglas** (ni siquiera con un candado de «solo si el mercado no está
  abierto»). Se prefirió ocultar por generación.
- **Se mantuvo Spark.** Blaze no se pudo activar porque el proyecto vivía en una organización de
  Google Workspace y los pagos fallaron con `OR-CBAT-23`. El diseño demostró que no hacía falta.

## Prácticas que funcionaron

- **Medir antes y después**, con scripts reproducibles, y desconfiar de las tablas que el propio
  script imprime.
- **Revisar el código con una pasada independiente antes del evento:** encontró el bug de
  `useRoster`, que las pruebas existentes no cubrían.
- **Un runbook con síntoma → causa → acción**, escrito antes del evento ([`operacion.md`](operacion.md)).
- **Reglas de Firestore con verificación real:** se comprobó que sin token la API respondía `403` y
  con un usuario anónimo `200`, y que el bundle publicado era el build local.
- **Dejar la base en solo lectura al terminar.** Evita que el enlace público se use para agotar la
  cuota.

## Si lo vuelves a montar

1. No ensayes el mismo día desde la red de la sala (100 cuentas anónimas/hora/IP).
2. Una sola pestaña de `/host`.
3. Cambia `VITE_HOST_PASSWORD` por algo desechable: queda visible en el JavaScript público.
4. Después de cambiar el `.env`, vuelve a compilar **y** a desplegar.
5. Si algo se ve raro: recarga primero, despliega al final.
