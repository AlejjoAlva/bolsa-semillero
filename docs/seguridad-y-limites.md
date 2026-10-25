# Seguridad y límites conocidos

Esta versión se hizo para un grupo cerrado y una sala supervisada, y eso condiciona el diseño. Si
vas a usarla en un contexto menos controlado, lee esto primero.

- **La contraseña de `/host` es solo de interfaz.** Las reglas permiten escribir en `session/main`
  a cualquier usuario autenticado, porque sin Cloud Functions no hay forma de distinguir al host.
  Para un salón cerrado de compañeros es un riesgo asumido; blindarlo requiere Cloud Functions.
- **La lógica de puntos vive en el navegador.** Alguien con consola de desarrollador abierta podría
  escribir puntos a mano. Mismo razonamiento: grupo conocido y sala supervisada.
- Las respuestas privadas viajan al cliente de todos (así se arman los quizzes sin llamadas
  extra), así que no son secretas de verdad. Que nadie escriba nada sensible ahí.
  Las reglas al menos exigen estar autenticado para leer
  (`allow read: if request.auth != null` en las cuatro colecciones), así que
  ya no se pueden listar desde internet sin abrir la app. Verificado: sin token la API responde
  `403 PERMISSION_DENIED`; con un usuario anónimo, `200`. Contra alguien de la sala con la consola
  abierta eso no protege — para eso harían falta Cloud Functions.
- **La contraseña de `/host` queda escrita en el JavaScript público.** Vite reemplaza las `VITE_*`
  dentro del bundle en el `npm run build`, así que cualquiera puede leerla con Ver código fuente.
  Cámbiala por algo desechable, nunca por una contraseña que uses en otro lado.
- No hay *fallbacks* silenciosos en `Host.jsx` ni en `lib/firebase.js`: si
  compilas sin `.env`, la app muestra en pantalla qué variables faltan en vez de salir con la
  contraseña de ejemplo apuntando a un proyecto inexistente. Verificado compilando sin `.env`:
  el bundle ya no contiene `cambia-esta-clave` ni `demo-bolsa`.
- No hay límites de cuota: la URL es escribible por cualquiera con internet, no solo por la sala.
  Para 30-40 personas el plan gratuito sobra. Después del evento conviene dejar las reglas en
  solo lectura.
- No hay detección automática de trampa: el log queda completo en `/host` para revisarlo a ojo.
- **Sacar a alguien del mercado no lo borra**, solo le pone `activo: false`. Deja de aparecer en
  rankings, listas y quizzes, y conserva sus puntos por si hay que devolverlo. Lo mismo aplica a
  `npm run seed -- --limpiar`: los falsos siguen en la base, apagados.
