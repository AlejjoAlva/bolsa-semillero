# Bolsa del Semillero

Web app para la actividad de integración: cada persona sale a bolsa como una "acción" y los demás
invierten en ella después de hablarle en persona y acertar un mini-quiz sobre sus respuestas privadas.

Tres rutas, una sola SPA:

| Ruta       | Para quién                | Qué hace                                                              |
|------------|---------------------------|-----------------------------------------------------------------------|
| `/`        | Celular del participante  | Registro, perfil, buscar a alguien e invertir (quiz)                   |
| `/display` | Proyector                 | Estado del mercado, dos rankings, log en vivo, QR de registro          |
| `/host`    | Tu laptop                 | Abrir/cerrar mercado, Bull Run de 5 min, log completo (pide contraseña)|

Stack: Vite + React + react-router · Firestore (listeners en vivo) · Firebase Auth anónima ·
Firebase Hosting. **Sin Cloud Functions**: toda la lógica corre en el cliente y escribe directo a
Firestore, protegida solo por las reglas de `firestore.rules`.

---

## 0. Preparar esta máquina (antes que nada)

> ✅ **Ya hecho en esta máquina** (2026-09-03): nvm + Node 22.23.2 + firebase-tools 15.29.0.
> Verifícalo con `node -v` y `firebase --version` en una terminal nueva. Lo de abajo queda
> documentado por si repites el montaje en otro computador.

Dos cosas de esta Ubuntu bloquean el CLI de Firebase:

- **Node 18.** `firebase-tools` 14 y 15 exigen Node 20 o más nuevo.
- **`npm install -g` apunta a `/usr/local`**, así que pediría `sudo`.

`nvm` resuelve las dos de una vez, sin tocar nada del sistema:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
exec bash                 # recarga la terminal para que "nvm" exista
nvm install 22            # instala y activa Node 22
nvm alias default 22      # que sea el de siempre al abrir terminal
node -v                   # debe decir v22.x
npm install -g firebase-tools   # ya sin sudo: se instala dentro de ~/.nvm
firebase --version        # debe imprimir 15.x
```

Si prefieres no instalar nvm, la alternativa es quedarte en Node 18 con la última versión
compatible del CLI: `sudo npm install -g firebase-tools@13`. Funciona igual para lo que
necesitamos, pero es una versión vieja y pide contraseña de sudo.

---

## 1. Lo que tienes que hacer tú (una sola vez)

> ✅ **Ya hecho (2026-09-03).** El proyecto es **`TU-PROYECTO-FIREBASE`** (cuenta
> `la cuenta institucional del semillero`) y el sitio está publicado en
> **<https://TU-PROYECTO-FIREBASE.web.app>** — esa es la URL que va en el QR.
> Quedaron listos: Firestore (`(default)`, modo producción), Authentication anónima
> (verificada creando un usuario de prueba), la app web `bolsa-web`, el `.env` con la config
> real, `.firebaserc`, y el deploy de `firestore.rules` + hosting.
> **Pendiente antes del evento:** cambiar `VITE_HOST_PASSWORD` y volver a correr
> `npm run build && firebase deploy --only hosting`.
> Lo de abajo queda documentado por si hay que rehacerlo o montarlo en otro proyecto.

Estos pasos necesitan tu cuenta de Google, así que van por la consola.

### 1.1 Crear el proyecto en Firebase

1. Entra a <https://console.firebase.google.com> → **Agregar proyecto**. Nombre sugerido:
   `bolsa-semillero`. Google Analytics: **desactívalo** (no lo necesitas).
2. Dentro del proyecto → **Compilación › Firestore Database › Crear base de datos**.
   - Modo: **producción** (las reglas correctas se despliegan en el paso 3.3).
   - Ubicación: `nam5` o `southamerica-east1`. **No se puede cambiar después.**
3. **Compilación › Authentication › Comenzar**, pestaña **Sign-in method / Método de acceso** →
   proveedor **Anónimo** → Habilitar. Sin esto nadie puede registrarse: la app entera depende del
   login anónimo.

   > **Límite a tener en cuenta el día del evento**: Firebase permite **100 cuentas nuevas por hora
   > desde una misma IP**. Los 30-40 celulares del salón conectados al mismo wifi cuentan como una
   > sola IP. Alcanza de sobra para el grupo, pero no hagas pruebas masivas (decenas de ventanas de
   > incógnito) el mismo día y desde la misma red, porque esas también consumen cuota. Si te
   > acercas al tope, que la gente se registre con sus datos móviles en vez del wifi.
4. **Configuración del proyecto (⚙️) › Tus apps › `</>` (Web)**. Registra la app con cualquier
   apodo, **no** marques Firebase Hosting ahí (eso se hace por CLI). Copia el bloque
   `firebaseConfig` que te muestra.

> **¿Necesito el plan Blaze?** No. Firestore, Auth y Hosting funcionan en el plan gratuito (Spark).
> Blaze solo haría falta si algún día agregamos Cloud Functions (v2).

### 1.2 Pegar tu config

En la carpeta del proyecto:

```bash
cd ~/Proyectos/bolsa-semillero
cp .env.example .env
```

Abre `.env` y llena cada valor con lo que copiaste del `firebaseConfig`:

```
VITE_FB_API_KEY=AIza...                 ← apiKey
VITE_FB_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FB_PROJECT_ID=tu-proyecto
VITE_FB_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FB_SENDER_ID=123456789012
VITE_FB_APP_ID=1:1234...:web:abcd...
VITE_HOST_PASSWORD=lo-que-tu-quieras    ← cámbiala antes del evento
VITE_USE_EMULATOR=false
```

No hay que tocar `src/lib/firebase.js`: ese archivo ya lee estas variables.
`.env` está en `.gitignore`, no se sube al repo.

> **Esto es lo que más se olvida**: Vite congela estos valores dentro del JavaScript en el momento
> del `npm run build`. Si cambias algo en `.env` después de desplegar, hay que volver a correr
> `npm run build` **y** `firebase deploy`, o el sitio publicado seguirá con los valores viejos.

> Ojo: en una app web estas claves **son públicas por diseño** (van dentro del JS del navegador).
> Lo que protege los datos son las reglas de Firestore, no el `apiKey`.

### 1.3 Conectar el CLI y desplegar

Con `firebase-tools` ya instalado (paso 0):

```bash
firebase login     # abre el navegador para que autorices con tu cuenta de Google
firebase use --add # lista tus proyectos: elige el tuyo y ponle el alias "default"
```

`firebase use --add` es suficiente y no toca ningún archivo tuyo. Si prefieres correr
`firebase init`, marca solo **Firestore** y **Hosting**, y responde **No** a todo lo que pregunte
si quiere sobrescribir `firebase.json`, `firestore.rules` o `firestore.indexes.json` — esos
archivos ya están escritos y configurados. En Hosting: carpeta pública `dist`, SPA **sí**,
builds automáticos con GitHub **no**.

Después:

```bash
npm run build
firebase deploy --only firestore:rules,hosting
```

Al terminar te imprime la URL (`https://tu-proyecto.web.app`). Esa es la que va en el QR.

Si el deploy falla con un error tipo `HTTP Error: 404` o "site not found", es porque el proyecto
todavía no tiene sitio de Hosting creado: abre **Compilación › Hosting › Comenzar** en la consola,
avanza hasta que te muestre el panel, y vuelve a correr el `firebase deploy`.

### 1.4 Abrir el panel de host una vez

Entra a `https://tu-proyecto.web.app/host`, escribe la contraseña de `VITE_HOST_PASSWORD`.
Al entrar, el panel crea el documento `session/main` con estado `esperando`. Hazlo antes del
evento: hasta que exista ese documento nadie puede invertir.

---

## 2. Probarlo antes del evento

### 2.1 Contra tu proyecto real (la más simple, empieza por aquí)

```bash
npm run dev    # http://localhost:5173
```

Lee el `.env`, así que habla con tu Firestore de verdad: es exactamente lo que va a pasar el día
del evento. La contra es que deja datos de prueba que hay que borrar a mano antes de empezar
(consola de Firebase › Firestore › borrar las colecciones). Para una app de este tamaño es la
forma más rápida y realista de probar.

### 2.2 Con el Firebase Emulator Suite (opcional)

Sirve para probar sin ensuciar la base real ni gastar cuota, y trae el `npm run seed` para
inventarse 20 participantes de golpe. Cuesta un poco más de montaje: el emulador de Firestore
corre sobre Java, así que primero:

```bash
sudo apt install default-jre     # solo la primera vez; verifica con "java -version"
```

(Este es el único paso de todo el proceso que sí pide `sudo`.)

Luego, en **dos terminales**:

```bash
# Terminal 1 — emuladores de Auth y Firestore
npm run emu

# Terminal 2 — la app apuntando al emulador
cp .env.local.example .env.local
npm run dev
```

`.env.local` tiene `VITE_USE_EMULATOR=true` y Vite lo carga por encima de `.env`, así que mientras
ese archivo exista **todo va al emulador y nada toca producción**. Para volver a producción,
bórralo o renómbralo.

Para no registrar 12 personas a mano:

```bash
npm run seed          # 12 participantes falsos + mercado abierto
npm run seed -- 25    # o los que quieras
```

El seed solo habla con `127.0.0.1:8080`; nunca escribe en producción.

La UI del emulador (<http://127.0.0.1:4000>) te deja ver y borrar documentos, útil para resetear
entre pruebas.

### 2.3 Simular varias personas

Cada ventana de **incógnito** tiene su propio almacenamiento, así que Firebase le da un `uid`
anónimo distinto y la app la trata como otra persona:

1. Ventana normal → `/host`, "Iniciar juego".
2. Otra pestaña normal → `/display` (el proyector).
3. Tres o cuatro ventanas de incógnito → `/`, registra a "Ana", "Carlos", "Lucía"…
   (una ventana de incógnito con varias pestañas comparte sesión: abre **ventanas** separadas).
4. Desde una, invierte en otra: verás subir los puntos en `/display` en tiempo real.

Para probar el celular contra tu laptop en la misma wifi: `npm run dev -- --host` y entra desde el
teléfono a `http://IP-DE-TU-LAPTOP:5173`.

### 2.4 Pruebas automáticas

```bash
npm test     # 13 pruebas: puntaje, generación de tickers, armado del quiz
npm run lint
npm run build
```

Cubren la lógica pura (sin red): las reglas de puntos, que un ticker nunca choque con otro, y que
el quiz siempre traiga la respuesta correcta más distractores ajenos y sin repetir.

---

## 3. Reglas del juego (como quedaron implementadas)

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
3 · todo x2 si hay Bull Run vigente. Todo se calcula y se escribe dentro de una `runTransaction`
que además crea `investments/{investor}_{target}`: por el ID compuesto, **nadie puede invertir dos
veces en la misma persona**, ni siquiera dando doble tap.

**Si fallan** — no se crea la inversión (pueden reintentar con esa persona más tarde) pero la
racha se va a 0.

**Host** — "Iniciar juego" abre el mercado, "Cerrar mercado" bloquea nuevas inversiones en todos
los celulares al instante, "Activar Bull Run" da 5 minutos de puntos dobles y lo anuncia en el log
y en la pantalla grande con cuenta regresiva.

---

## 4. Runbook del día

1. **Antes de salir de casa**: `npm run build && firebase deploy`, abre `/host` y confirma que dice
   "Estado actual: esperando". Ten la URL corta a mano.
2. **En el salón**: proyector en `/display` (F11 para pantalla completa). El QR de esa pantalla es
   el que escanea la gente.
3. Deja que todos se registren con el mercado en `esperando`. Van a ver su ticker y el mensaje
   "El mercado abre pronto".
4. Explica la mecánica → **Iniciar juego**.
5. A mitad de la actividad, cuando decaiga la energía → **Activar Bull Run**. Anúncialo en voz alta.
6. **Cerrar mercado** al final. Los rankings quedan congelados en `/display` para premiar.

**Si algo falla**: casi todo se arregla recargando la página (los datos viven en Firestore, no en
el celular). Si alguien perdió su ticker, está en la lista de `/display` y en `/host`.

**Resetear** (por ejemplo, después de un ensayo): consola de Firebase → Firestore → borra las
colecciones `participants`, `investments` y `logs`, y pon `session/main` en `esperando`. La app
detecta que el ticker guardado ya no existe y devuelve a la gente al formulario.

---

## 5. Límites conocidos de esta versión

- **La contraseña de `/host` es solo de interfaz.** Las reglas permiten escribir en `session/main`
  a cualquier usuario autenticado, porque sin Cloud Functions no hay forma de distinguir al host.
  Para un salón cerrado de compañeros es un riesgo asumido; blindarlo requiere Cloud Functions.
- **La lógica de puntos vive en el navegador.** Alguien con consola de desarrollador abierta podría
  escribir puntos a mano. Mismo razonamiento: grupo conocido y sala supervisada.
- Las respuestas privadas viajan al cliente de todos (así se arman los quizzes sin llamadas
  extra), así que no son secretas de verdad. Que nadie escriba nada sensible ahí.
  Desde el 2026-09-03 las reglas al menos exigen estar autenticado para leer
  (`allow read: if request.auth != null` en las cuatro colecciones, antes era `if true`), así que
  ya no se pueden listar desde internet sin abrir la app. Verificado: sin token la API responde
  `403 PERMISSION_DENIED`; con un usuario anónimo, `200`. Contra alguien de la sala con la consola
  abierta eso no protege — para eso harían falta Cloud Functions.
- **La contraseña de `/host` queda escrita en el JavaScript público.** Vite reemplaza las `VITE_*`
  dentro del bundle en el `npm run build`, así que cualquiera puede leerla con Ver código fuente.
  Cámbiala por algo desechable, nunca por una contraseña que uses en otro lado.
- Ojo con los *fallbacks* silenciosos de `Host.jsx` y `lib/firebase.js` (`?? 'cambia-esta-clave'`,
  `?? 'demo-bolsa'`): si compilas sin `.env`, el sitio sale con la contraseña de ejemplo y
  apuntando a un proyecto que no existe, sin ningún error visible.
- No hay límites de cuota: la URL es escribible por cualquiera con internet, no solo por la sala.
  Para 30-40 personas el plan gratuito sobra. Después del evento conviene dejar las reglas en
  solo lectura.
- No hay detección automática de trampa: el log queda completo en `/host` para revisarlo a ojo.

---

## 6. Estructura

```
src/
  routes/      Participant.jsx · Display.jsx · Host.jsx
  components/  RegisterForm · InvestModal · Leaderboard · LogFeed
  lib/
    firebase.js   init de app, auth anónima, conexión al emulador
    data.js       hooks de listeners (session, participants, logs) y utilidades de bull run
    acciones.js   escrituras: registrar, invertir, romper racha, controles del host
    puntaje.js    reglas de puntos (puras, sin Firebase — lo que prueban los tests)
    ticker.js     generación de tickers e ID de inversión
    quiz.js       armado de la pregunta con distractores
tests/         pruebas de la lógica pura (node --test)
scripts/seed.mjs  siembra participantes falsos en el emulador
firestore.rules   las reglas que son el único filtro real de seguridad
```

---

## 7. Autoría

Desarrollado y desplegado por **Alejandro V. Alvarado**
([@AlejjoAlva](https://github.com/AlejjoAlva)) para la Unidad de Análisis en Ciencias Económicas.

El proyecto de Firebase y este repositorio están a nombre de la cuenta institucional del semillero
([@uamffcebog123](https://github.com/uamffcebog123)) para que la infraestructura no dependa de una
cuenta personal.
