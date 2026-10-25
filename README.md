# La Bolsa

Juego de integración para un salón de 30 a 40 personas: **cada persona sale a bolsa como una
«acción» y los demás invierten en ella** después de hablarle en persona y acertar un mini-quiz sobre
sus respuestas privadas. Gana quien más puntos junte. Se hizo para la actividad de integración del
semillero de la Unidad de Análisis en Ciencias Económicas (UACE) y funcionó con la sala completa.

> **Stack:** Vite + React · Firestore · Firebase Auth anónima · Firebase Hosting · plan gratuito
> **Spark** · **sin Cloud Functions** (toda la lógica corre en el cliente).

## Cómo se juega

1. La gente escanea un QR y se registra: nombre, área, si es nueva o antigua, y 4 respuestas privadas
   (comida, superpoder, anécdota, ciudad). Recibe un *ticker* como `$ANA47`.
2. Para **invertir** en alguien hay que hablarle y acertar una pregunta de 3 opciones sobre sus
   respuestas. Acertar da puntos; fallar rompe la racha.
3. Hay giros que mantienen viva la partida: **venta en corto**, **corrección por sobrecompra**,
   **rumores de sector** y un **cierre volátil**.
4. El proyector muestra los rankings, el log en vivo y, al cerrar, un podio con indicadores.

Reglas completas, con cifras: [`docs/reglas-del-juego.md`](docs/reglas-del-juego.md).

## Tres pantallas, una sola app

| Ruta | Para quién | Qué hace |
|---|---|---|
| `/` | Celular del participante | Registro, perfil, buscar a alguien e invertir |
| `/display` | Proyector | Estado del mercado, rankings, log en vivo, QR |
| `/host` | Laptop del anfitrión | Abrir y cerrar el mercado, rumores, cierre volátil, reiniciar, sacar gente (pide contraseña) |

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/replicar.md`](docs/replicar.md) | **Montar todo desde cero** en tu propio Firebase, paso a paso |
| [`docs/reglas-del-juego.md`](docs/reglas-del-juego.md) | Puntos, rachas, rumores, cierre |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Cómo está hecho y las decisiones que no conviene deshacer |
| [`docs/cuota-y-rendimiento.md`](docs/cuota-y-rendimiento.md) | Cómo se midió y se bajó el consumo del plan gratuito (de 67–118 % a 8–15 %) |
| [`docs/operacion.md`](docs/operacion.md) | Runbook del evento: antes, durante, si algo falla, qué no tocar |
| [`docs/seguridad-y-limites.md`](docs/seguridad-y-limites.md) | Qué protege y qué no esta versión |
| [`docs/lecciones-aprendidas.md`](docs/lecciones-aprendidas.md) | Errores reales y decisiones |

## Inicio rápido (local)

```bash
npm install
cp .env.example .env      # y llena los valores de tu proyecto de Firebase (docs/replicar.md §1)
npm run dev               # http://localhost:5173
```

Sin proyecto de Firebase, con los emuladores (requiere Java):

```bash
npm run emu                           # terminal 1 (usa el proyecto de demostración demo-bolsa)
cp .env.local.example .env.local      # terminal 2: modo emulador
npm run dev                           # y abre varias ventanas de incógnito para simular gente
```

## Pruebas

```bash
npm test        # 71 pruebas de la lógica pura (puntaje, tickers, quiz, roster, generaciones)
npm run lint
npm run build
```

## Resultados medidos

Con **35 celulares simultáneos** contra Firestore real: 35/35 conexiones anónimas en 3,1 s, 34/34
transacciones concurrentes sin conflicto y **3,06 lecturas por inversión** repartidas entre todos.
Proyección del evento completo: **8–15 % del tope diario de lecturas**. Detalle y método en
[`docs/cuota-y-rendimiento.md`](docs/cuota-y-rendimiento.md).

## Autoría y licencia

Diseñado y desarrollado por **Alejandro V. Alvarado** ([@AlejjoAlva](https://github.com/AlejjoAlva))
para la Unidad de Análisis en Ciencias Económicas.

Código bajo licencia **MIT**. El logo de la UACE tiene condiciones propias: ver
[`NOTICE.md`](NOTICE.md).
