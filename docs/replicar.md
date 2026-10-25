# Montar La Bolsa desde cero

Esta guía te lleva de un computador vacío a la app funcionando en internet con **tu propio proyecto
de Firebase**. No necesitas tarjeta de crédito: todo cabe en el plan gratuito **Spark**.

```bash
git clone https://github.com/AlejjoAlva/bolsa-semillero.git
cd bolsa-semillero
npm install
```

## 0. Preparar el computador

En Ubuntu, dos cosas pueden bloquear el CLI de Firebase:

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
compatible del CLI: `sudo npm install -g firebase-tools@13`. Funciona igual, pero es una
versión vieja y pide contraseña de sudo.

---

## 1. Crear y conectar tu proyecto de Firebase (una sola vez)

Estos pasos necesitan tu cuenta de Google, así que van por la consola.

### 1.1 Crear el proyecto en Firebase

1. Entra a <https://console.firebase.google.com> → **Agregar proyecto**. Nombre sugerido:
   `bolsa`. Google Analytics: **desactívalo** (no lo necesitas).
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
cd bolsa-semillero
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

Sirve para probar sin ensuciar la base real ni gastar cuota, y **no necesita un proyecto de Firebase
real** (usa el proyecto de demostración `demo-bolsa`). Cuesta un poco más de montaje: el emulador de
Firestore corre sobre Java, así que primero:

```bash
sudo apt install default-jre     # solo la primera vez; verifica con "java -version"
```

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

Para simular varias personas contra el emulador, abre **ventanas de incógnito** distintas (ver §2.3).

> `npm run seed` **no** funciona con el emulador: escribe en el proyecto real definido en `.env`
> (ver §2.5). Úsalo solo para ensayar contra tu propio proyecto.

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
npm test     # 71 pruebas: puntaje, tickers, quiz, roster, generaciones
npm run lint
npm run build
```

Cubren la lógica pura (sin red): las reglas de puntos, que un ticker nunca choque con otro, y que
el quiz siempre traiga la respuesta correcta más distractores ajenos y sin repetir.

---

## 2.5 Ensayar el evento (rondas y participantes falsos)

**Reiniciar partida** (en `/host`) pone en cero puntos, rachas e inversiones recibidas de todo el
mundo y sube el número de **ronda** en `session/main`. Nadie pierde su registro ni su ticker.

No borra nada, y eso es a propósito: las reglas de Firestore no permiten borrar desde el navegador
y no queremos que lo permitan — con la contraseña de `/host` siendo solo de interfaz, un botón de
borrado sería un botón para tumbar el evento desde la consola. En vez de borrar, el ID de cada
inversión lleva la ronda (`ANA10_BET60_r2`), así que al subir de ronda todas las inversiones
anteriores dejan de contar y se puede volver a invertir en la misma gente. El log filtra por ronda:
lo viejo sigue en la base, pero deja de mostrarse.

Para ensayar con el mercado lleno sin reunir a 30 personas:

```bash
npm run seed                # 12 participantes falsos en el proyecto real
npm run seed -- --n 25      # 25
npm run seed -- --limpiar   # los saca a todos del mercado (no los borra)
```

El script entra con un usuario anónimo normal, no con credenciales de administrador: solo puede
hacer lo que las reglas permiten. Los sembrados quedan marcados con `seed: true`.

> Ojo con el límite de **100 cuentas anónimas nuevas por hora y por IP**: cada ejecución del script
> gasta una, y cada celular que se registra gasta otra. No hagas ensayos masivos el mismo día del
> evento desde el mismo wifi.
