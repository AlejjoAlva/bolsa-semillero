# Cuota y rendimiento

El plan gratuito **Spark** de Firebase permite **50.000 lecturas, 20.000 escrituras y 20.000
borrados de Firestore por día**, con reinicio a medianoche del Pacífico (2:00 a. m. en Bogotá). Blaze
(con pago) no es necesario ni se usó. Esta página resume cómo se midió el consumo, qué se cambió y qué
cifras esperar.

## El problema

La primera versión escuchaba la colección `participants` completa desde cada celular. Cada vez que
alguien ganaba puntos, Firestore reenviaba su documento a los 35 celulares, aunque **el celular
nunca muestra los puntos de nadie más**. Medido con 8 celulares simulados:

- **2,17 lecturas por inversión y por cada celular conectado.**
- Una corrección por sobrecompra cuesta 7 documentos × cada cliente conectado.
- Modelo para el evento completo: `1.225 + 2×37×I + 7×37×35 + 3×I`, con I = inversiones. Proyecta
  **67 % del tope con 300 inversiones, 85 % con 420, 105 % con 550 y 118 % con 630**. El escenario que
  rompe la app (pasarse del tope y que Firestore devuelva errores en vivo) es justo el escenario en
  que el evento sale bien.

## La solución

El celular dejó de escuchar documentos ajenos. El hook `useRoster(miTicker, activosCount)` en
`src/lib/data.js`:

1. carga el listado **una vez** con `getDocs`;
2. escucha en vivo **solo su propio documento**;
3. pide el *delta* (`where('created_at', '>=', marca)`) cuando `activos_count` sube;
4. recarga el listado entero cuando baja (una consulta por fecha no ve un documento que cambió sin
   crearse);
5. reintenta hasta 4 veces con espera exponencial, porque `getDocs` no reintenta como `onSnapshot`.

`useParticipants` (la colección completa en vivo) **se mantiene en `/display` y `/host` a
propósito**: son dos clientes, cuestan casi nada, y el proyector debe ser la vista en vivo principal.
El botón **↻ Actualizar lista** del celular recarga el listado a mano.

Funciones puras con pruebas: `fusionarRoster` y `marcaMasReciente` en `src/lib/participantes.js`.

## Resultado medido

Con 35 clientes simultáneos contra Firestore real (`prueba-carga.mjs`):

| Prueba | Resultado |
|---|---|
| 35 cuentas anónimas conectándose a la vez | 35/35 en 3,1 s |
| 35 clientes sosteniendo listeners | 35/35 |
| 34 transacciones de inversión concurrentes | 34/34, cero conflictos |
| 35 escrituras simultáneas al mismo documento | 35/35, ningún incremento perdido en 2,3 s |
| Lecturas por inversión, repartidas entre los 35 | **3,06** |

Proyección del evento completo:

| Inversiones | Lecturas | Escrituras |
|---|---|---|
| 300 | 4.243 · 8 % | 1.899 · 9 % |
| 420 | 5.450 · 11 % | 2.379 · 12 % |
| 630 (mercado completo) | 7.562 · 15 % | 3.219 · 16 % |

(Antes del cambio: 67–118 % de las lecturas.) El día de desarrollo completo —todas las mediciones,
la auditoría de carga y varios borrados— consumió 31 % de las lecturas, 14 % de las escrituras y 5 %
de los borrados.

La contención temida en el documento de sesión **no existe**: Firestore resuelve `increment` como una
transformación del servidor, no como leer-modificar-escribir.

## Lección: escuchar en vivo es más barato que sondear

Una escucha `onSnapshot` entrega solo los documentos que cambian (2 por inversión). Sondear la
colección cada 30 s habría costado **147.000 lecturas contra 25.700**. No cambies listeners por
*polling* sin medir.

## Cómo medir

Los módulos de `src/lib/` usan `import.meta.env`, así que no corren en Node pelado. Los scripts de la
raíz se compilan con Vite y se ejecutan desde la raíz del proyecto (para que resuelva `node_modules`):

```bash
npx vite build --ssr prueba-carga.mjs --outDir .medicion
node .medicion/prueba-carga.js
```

| Script | Para qué |
|---|---|
| `medir-lecturas.mjs` | Consumo con el esquema viejo (referencia histórica) |
| `medir-nuevo.mjs` | Consumo con el esquema actual |
| `prueba-carga.mjs` | 35 clientes simultáneos e inversiones concurrentes |
| `prueba-registro-simultaneo.mjs` | 35 escrituras a la vez al documento de sesión |
| `verificar-roster.mjs` | `useRoster` y el registro tardío contra Firestore real |
| `verificar-cero.mjs` | «Empezar de cero» contra Firestore real |
| `limpiar.mjs` | Deja la app en blanco |

> Estos scripts **consumen cuota real** y crean cuentas anónimas. El tope de Auth es 100 cuentas
> nuevas por hora y por IP: no los ejecutes el mismo día del evento ni desde la red de la sala.
> `medir-lecturas.mjs` imprime una tabla que **subestima** la corrección por sobrecompra (promedia la
> proporción forzada de la prueba, no la real); rehaz esa cuenta a mano con el modelo de arriba.

## Leer el consumo real sin `gcloud`

La API de Cloud Monitoring acepta el `access_token` que la CLI de Firebase guarda en
`~/.config/configstore/firebase-tools.json` (tiene el alcance `cloud-platform`). Las métricas son
`firestore.googleapis.com/document/read_count`, `write_count` y `delete_count`, agregadas por día
del **Pacífico**. Refresca el token con `firebase projects:list`.

## Un emulador para no gastar cuota

`npm run emu` levanta los emuladores de Auth y Firestore (requiere Java). Con `.env.local` en modo
emulador, todo corre sin tocar producción. Ver [`replicar.md`](replicar.md) §2.2.
