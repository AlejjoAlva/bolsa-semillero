# Operación del evento (runbook)

Qué revisar antes de abrir, qué puede fallar durante la actividad y cómo reconocerlo, y qué no
tocar mientras haya gente jugando.

> **Lo primero, casi siempre: recarga la página.** Es seguro en las tres pantallas. El estado vive
> en Firestore, no en el navegador, y no se pierde nada.

## 1. Antes de abrir el mercado

En este orden. Los tres primeros evitan los fallos que de verdad ocurren; el resto es montaje.

1. **No ensayes el mismo día desde el wifi del salón.** Firebase permite **100 cuentas anónimas
   nuevas por hora y por IP**. Cada registro de ensayo consume una y todos los celulares de la sala
   comparten IP. Si gastas el cupo probando por la mañana, la gente no podrá registrarse por la
   tarde. Es el único techo que 35 personas pueden rozar de verdad.
2. **Cierra todas las pestañas que no uses.** Cada pestaña abierta cuenta como un participante más,
   y una pestaña de `/host` olvidada **lanza rumores automáticos por su cuenta** al cruzar los
   hitos del mercado: arruinó dos corridas de prueba. Debe quedar exactamente una de cada pantalla.
3. **Desactiva la suspensión del portátil del proyector.** Si esa pantalla se duerme, el tablero se
   congela para toda la sala y los rumores se quedan colgados. Conéctalo a la corriente.
4. **Abre `/host` una vez** y deja el mercado en espera. Eso crea la sesión (`session/main`). El
   estado debe decir *MERCADO POR ABRIR*. No lo abras todavía.
5. **Proyecta `/display`** y compruébalo desde el fondo del salón: todo debe caber en una pantalla
   sin barra de desplazamiento, y se deben leer los tickers y el QR.
6. **Registra una persona de prueba y bórrala.** Confirma que el QR funciona y que aparece en el
   tablero. Luego, en `/host`, pulsa *Empezar de cero*: ese registro desaparece y los celulares
   vuelven al formulario. Hazlo *antes* de que llegue la gente, nunca después.
7. **Ten a mano la contraseña de `/host` y no la proyectes.** Está a la vista en el código público
   de la página; trátala como un pestillo, no como una cerradura.

## 2. Durante el evento

1. Proyector en `/display` (F11 para pantalla completa). El QR de esa pantalla es el que escanea la
   gente.
2. Deja que todos se registren con el mercado en `esperando`. Verán su ticker y «El mercado abre
   pronto».
3. Explica la mecánica y pulsa **Iniciar juego**.
4. A mitad de la actividad, cuando ya haya portafolios armados, se lanza un **rumor de sector**
   (solo, o a mano). Anúncialo en voz alta: es el momento en que todos tienen que decidir y moverse.
5. **Cerrar mercado** al final. Los rankings quedan congelados en `/display` para premiar.

## 3. Si algo falla

Ordenado por probabilidad real, no por gravedad teórica.

| Síntoma | Causa | Qué hacer |
|---|---|---|
| Varias personas no logran registrarse **a la vez** | Se agotó el cupo de 100 cuentas anónimas por hora para la IP del salón | Que apaguen el wifi y se registren con **datos móviles**. Una vez dentro pueden volver al wifi. Si no hay datos, el cupo se renueva solo en una hora |
| Aviso de conexión perdida; los números no se mueven | Se cayó el wifi del dispositivo | Nada: se reconecta sola y recupera lo perdido. **No reinicies la partida**, no se pierde ningún dato |
| Alguien quedó registrado **dos veces** | Envió el registro dos veces o recargó a mitad | En `/host`, **saca del mercado** el ticker que no use (confirma primero con la persona cuál tiene) |
| Alguien no ve en su lista a una persona recién llegada | Por diseño el celular no escucha la lista completa en vivo (ver [cuota](cuota-y-rendimiento.md)) | Que pulse **↻ Actualizar lista**. El proyector sí está siempre en vivo |
| «El anfitrión te sacó del mercado» sin que nadie lo hiciera | Casi siempre un ticker viejo de una prueba guardado en ese navegador | Si lo sacaste por error: *devolver al mercado*. Si es un ticker viejo: borrar los datos del sitio, o abrir la página en **ventana de incógnito** y registrarse de nuevo |
| Un rumor se queda colgado en el proyector | El portátil del anfitrión se durmió | **Espera diez segundos**: el proyector resuelve solo a los 8 s. Si no, recarga el proyector |
| El mercado se cerró solo antes de tiempo | Alguien invirtió en **todas** las personas; la regla dice que ahí termina | Si quieres seguir: **Reiniciar partida** (puntos a cero, nadie pierde su ticker) y vuelve a abrir |
| Todo se congela sin aviso de conexión | Cuota diaria agotada. Muy improbable: la actividad proyecta 8–15 % | No hay arreglo en caliente; el cupo se renueva a las 2:00 a. m. de Bogotá. Continúa a mano con el último ranking en pantalla |

## 4. No toques esto con gente jugando

- **No despliegues.** Nada de `firebase deploy` ni cambios de código. Un despliegue a mitad del
  evento puede dejar la página en blanco y no hay marcha atrás ensayada. Desplegar en caliente es el
  último recurso, no el primero.
- **No pulses «Empezar de cero».** Expulsa a todos y obliga a registrarse de nuevo. Es para entre
  ensayos.
- **No borres nada desde la terminal.** Los `firestore:delete` son irreversibles y no distinguen
  entre datos de prueba y la partida en curso.
- **No abras `/host` en un segundo dispositivo.** Ambos lanzarían rumores automáticos y se pisarían.
- «Reiniciar partida» es seguro, pero pone todos los puntos a cero.

## 5. Qué hace cada botón del panel

| Botón | Qué hace |
|---|---|
| **Abrir mercado** | Suena la campana en el proyector y se habilita invertir en todos los celulares |
| **Cerrar mercado** | Congela las inversiones sin terminar la partida |
| **Lanzar rumor** | Anuncia que un sector se desploma; la sala tiene 90 s para mantener o liquidar y el proyector sortea si era cierto |
| **Congelar rumor** | Durante los 20 s de aviso previo, deja el rumor armado para lanzarlo cuando convenga |
| **Cierre volátil** | Las 3 acciones más compradas pierden 2 puntos y las 3 menos buscadas ganan 2. Una vez por ronda |
| **Finalizar partida** | Cierra la rueda y muestra el podio. Pide confirmación |
| **Sacar del mercado** | Retira a una persona de listas, rankings y quizzes. Reversible con *devolver al mercado* |
| **Reiniciar partida** | Puntos a cero. Nadie pierde su ticker |
| **Empezar de cero** | Retira a todos y los saca de la lista; los celulares vuelven al registro. Solo entre ensayos |

## 6. Cómo saber que va bien

No hace falta mirar ninguna consola: el **log de actividad se mueve solo** con cada inversión, los dos
rankings se reordenan y la cinta de tickers cambia de valores. Si eso ocurre, el sistema está sano.

Para el dato duro: consola de Firebase › Firestore › *Uso*. Números esperados, medidos con 35
clientes reales (ver [cuota-y-rendimiento.md](cuota-y-rendimiento.md)):

| Inversiones en la actividad | Lecturas | Escrituras |
|---|---|---|
| 300 (≈ 9 por persona) | 4.243 · 8 % | 1.899 · 9 % |
| 420 (≈ 12 por persona) | 5.450 · 11 % | 2.379 · 12 % |
| 630 (el mercado completo) | 7.562 · 15 % | 3.219 · 16 % |

El cupo diario se renueva a medianoche del Pacífico: **2:00 a. m. en Bogotá**.

## 7. Empezar de cero entre ensayos

Dos niveles, según lo que necesites.

**Desde el panel, botón «Empezar de cero»** (al final de `/host`, pide escribir `EMPEZAR DE CERO`).
Retira del mercado a todos los registrados, los deja en ceros y sube el contador `generacion` de la
sesión. Cada celular detecta el cambio, olvida su ticker y **vuelve solo al registro**.

Lo que ese botón **no** hace es borrar. Los documentos antiguos siguen en Firestore, marcados
`activo: false` y de una generación anterior, invisibles para la app. Es deliberado: las reglas no
permiten borrar desde el cliente porque la contraseña de `/host` es solo de interfaz, y abrir ese
permiso dejaría que cualquiera vaciara el juego desde la consola del navegador a mitad del evento
(ver [seguridad-y-limites.md](seguridad-y-limites.md)).

**Borrado físico, desde la terminal.** Para dejar la base literalmente vacía (lo recomendable justo
antes del evento real, para que la carga inicial de cada celular sea mínima):

```bash
firebase firestore:delete participants --recursive -f
firebase firestore:delete investments --recursive -f
firebase firestore:delete logs --recursive -f
firebase firestore:delete session --recursive -f
```

Después abre `/host` una vez: la sesión se recrea sola en estado *esperando*.

Si un comando falla con *«Failed to fetch documents to delete»* o un despliegue se cae por
autenticación, **caducaron las credenciales del CLI**: `firebase login --reauth` (interactivo). Se
detecta con `firebase projects:list`.

## 8. Despliegue de emergencia

Solo si de verdad hace falta cambiar algo durante el evento:

```bash
firebase login --reauth        # las credenciales del CLI caducan; es interactivo
npm test && npm run lint       # nunca desplegar sin esto
npm run build && firebase deploy --only hosting
```

Para volver atrás: `git log`, `git revert <commit>`, y build y deploy otra vez.

## 9. Después del evento

Deja las reglas de Firestore en **solo lectura** (`allow write: if false`, lectura solo para
autenticados) y despliégalas: la URL pública no debería poder usarse para llenar tu cuota. Hay un
archivo listo: `firestore.rules.solo-lectura` (cópialo sobre `firestore.rules` y ejecuta
`firebase deploy --only firestore:rules`). Para volver a jugar, restaura `firestore.rules` desde git.
