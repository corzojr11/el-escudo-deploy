# Roadmap de ataque - NAVIR y EL ESCUDO

Fecha: 2026-06-07

Objetivo: dejar la app lista para uso personal real en Android, con NAVIR como cerebro operativo, menos ruido, menos duplicacion y mas control sobre finanzas, salud, turnos, sueño, foco y gimnasio.

## Principios que no se negocian

- NAVIR debe ser el centro operativo, no un adorno.
- Una accion critica no puede ejecutarse dos veces.
- El frontend no debe contener inteligencia de negocio duplicada si el backend ya la tiene.
- Menos pantallas, menos menues, menos friccion.
- Primero estabilidad, luego simplificacion, luego expansion.
- Todo lo que no ayude al uso diario real se congela o se saca del camino.

## Veredicto actual

- La app tiene una base muy buena.
- Todavia no esta lista para salir como producto personal serio en Android sin limpiar bloqueadores.
- El problema no es solo que falten features, sino que hay duplicacion, exceso de superficies y poca claridad en el flujo principal.

---

## Fase 0 - Bloqueadores y seguridad

Objetivo: cerrar riesgos graves antes de seguir construyendo.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Seguridad | Rotar todas las claves expuestas y revisar historial del repo | P0 | Hacer esto antes de seguir exponiendo o distribuyendo builds |
| [ ] | Backend | Eliminar secretos de `.env` del control de version | P0 | Mover todo a variables de entorno reales |
| [ ] | Auth | Fijar JWT a un solo algoritmo seguro | P0 | Evitar confusion de algoritmos |
| [ ] | API | Quitar cualquier `localhost` por defecto en builds reales | P0 | Android fisico no puede depender de localhost |
| [ ] | Backend | Corregir cualquier crash en registro de push tokens | P0 | Notificaciones deben quedar estables |
| [ ] | Auth | Persistir sesion con almacenamiento local correcto | P0 | La sesion no debe perderse al cerrar la app |

Observaciones:
- Si esta fase no queda cerrada, todo lo demas se vuelve inestable.
- Esta fase tiene prioridad sobre UI, features y nuevos modulos.

---

## Fase 1 - Contrato unico de NAVIR

Objetivo: que NAVIR entienda, valide, confirme, ejecute y deje trazabilidad de cada accion.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Asistente | Unificar el flujo `intencion -> validacion -> vista previa -> confirmacion -> ejecucion -> persistencia -> log` | P0 | Un solo contrato para todas las acciones |
| [ ] | Asistente | Quitar logica duplicada entre frontend y backend | P0 | El cliente debe quedar como capa visual y de confirmacion |
| [ ] | Asistente | Agregar registro de acciones ejecutadas y fallidas | P1 | Sirve para auditar dinero, salud, turnos y tareas |
| [ ] | Asistente | Implementar confirmacion obligatoria para acciones destructivas | P0 | Borrar, completar masivo, reemplazar datos, etc. |
| [ ] | Asistente | Asegurar que una accion critica no se ejecute dos veces | P0 | Idempotencia real |
| [ ] | Asistente | Habilitar lectura real, no solo escritura | P1 | NAVIR debe poder responder preguntas de datos |

Observaciones:
- Si NAVIR no ejecuta acciones con seguridad, el producto no esta cumpliendo su promesa principal.

---

## Fase 2 - Simplificacion del producto

Objetivo: bajar el ruido, reducir superficies y dejar el flujo principal claro.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Navegacion | Definir si la app es chat-first o hoy-first | P0 | No pueden convivir dos centros principales sin confusion |
| [ ] | Navegacion | Reducir tabs y exponer menos superficies al usuario | P1 | Dejar solo lo esencial visible |
| [ ] | Producto | Congelar o esconder modulos secundarios no core | P1 | Social, clanes, retos, leaderboard, etc. si estorban |
| [ ] | Dashboard | Convertir el home en resumen util, no en un tablero pesado | P1 | Menos widgets, mas claridad |
| [ ] | UI | Fusionar vistas duplicadas o superpuestas | P1 | Evitar pantallas que repiten informacion |
| [ ] | UI | Bajar la cantidad de elementos decorativos sin valor | P1 | Si no ayuda a decidir o actuar, sobra |

Observaciones:
- El usuario debe entender en segundos donde registrar, consultar y continuar su dia.
- Menos menues y menos capas significa mas uso real.

---

## Fase 3 - Chat como motor real

Objetivo: que el chat no solo conteste, sino que gobierne la app.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Asistente | Hacer que el chat pueda crear, editar, consultar y cerrar datos dentro de toda la app | P0 | Finanzas, salud, turnos, sueño, foco, gimnasio y tareas |
| [ ] | Asistente | Permitir consultas naturales sobre datos reales | P0 | "Cuanto gaste", "como va mi racha", "que turno tengo" |
| [ ] | Asistente | Dar respuestas cortas, claras y accionables | P1 | Nada de texto largo si no aporta |
| [ ] | Asistente | Mantener contexto conversacional corto y util | P1 | Sin depender de mensajes sueltos aislados |
| [ ] | Asistente | Dejar trazabilidad de lo que NAVIR entendio y ejecuto | P1 | El usuario debe confiar en el resultado |
| [ ] | Asistente | Mostrar previsualizacion cuando haga falta confirmar | P0 | Evita errores costosos |

Observaciones:
- Si el chat no interactua con el resto de la app, pierde su sentido central.

---

## Fase 4 - Salud, sueño, gimnasio y foco

Objetivo: convertir estas areas en una capa util de orden de vida, no en pantallas sueltas.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Descanso | Reforzar el motor de sueño con ciclos y hora de acostarse | P1 | Debe tomar en cuenta turnos, traslado y energia |
| [ ] | Descanso | Hacer que NAVIR sugiera horario realista de descanso | P1 | Menos manual y mas automatizado |
| [ ] | Gimnasio | Integrar rutinas por grupos musculares y por equipamiento real | P1 | Adaptado al kit de pesas disponible |
| [ ] | Gimnasio | Llevar historial de sesiones, progreso y volumen | P2 | Que no sea solo una lista de ejercicios |
| [ ] | Foco | Integrar rachas, impulsos y recaidas como sistema real | P1 | Debe ayudar a actuar, no solo registrar |
| [ ] | Salud | Hacer que peso, energia y carga diaria se conecten con el resto del dia | P1 | El orden personal debe ser coherente |

Observaciones:
- Este bloque debe sentirse conectado al horario, no separado de la vida real del usuario.

---

## Fase 5 - Finanzas utiles de verdad

Objetivo: que finanzas no sea solo un saldo bonito.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Finanzas | Soportar ingresos variables y sueldo no fijo | P0 | El usuario debe poder registrar lo que le entra realmente |
| [ ] | Finanzas | Restar gastos de ingresos correctamente | P0 | Debe reflejar disponible real |
| [ ] | Finanzas | Separar movimientos simples de pagos fijos | P1 | Para entender gasto real vs compromiso |
| [ ] | Finanzas | Permitir consulta por periodo y categoria | P1 | Mes actual, semana, pendientes |
| [ ] | Finanzas | Reducir pasos para registrar gasto desde chat | P0 | Registrar con una frase debe ser facil |

Observaciones:
- Si finanzas no da una lectura util, se vuelve ruido.

---

## Fase 6 - Rendimiento y fluidez

Objetivo: que la app cargue rapido y no se sienta pesada entre menus.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Rendimiento | Virtualizar listas largas | P1 | Chat, movimientos, historial, actividad |
| [ ] | Rendimiento | Reducir re-renders innecesarios | P1 | Componentes pesados primero |
| [ ] | Rendimiento | Separar pantallas monoliticas en piezas mas pequenas | P1 | Mejora mantenimiento y velocidad |
| [ ] | Rendimiento | Cambiar cargas visibles innecesarias entre tabs | P1 | Menos pantallas de carga falsas |
| [ ] | Rendimiento | Revisar estados vacios y loaders | P2 | Deben informar, no entorpecer |
| [ ] | Rendimiento | Bajar peso visual en pantallas mas usadas | P2 | Inicio, Finanzas, Turnos, Chat |

Observaciones:
- La sensacion de velocidad en Android importa tanto como la velocidad real.

---

## Fase 7 - Navegacion y acceso real

Objetivo: que nada importante quede escondido.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Navegacion | Exponer lo importante sin esconder funciones clave | P1 | No depender de descubrir pantallas ocultas |
| [ ] | Navegacion | Revisar si conviene un tab "Mas" o un drawer | P1 | Para secciones secundarias |
| [ ] | Navegacion | Corregir accesos rotos o no obvios | P0 | Si se ve, debe funcionar |
| [ ] | Navegacion | Evitar repetir el mismo rol en dos pantallas distintas | P1 | Confusion y duplicacion |

Observaciones:
- La navegacion debe ser predecible, no un juego de adivinanza.

---

## Fase 8 - Calidad, pruebas y salida a Android

Objetivo: verificar que todo funciona en dispositivo real.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | QA | Probar login, persistencia y reingreso | P0 | Cerrar y volver a abrir la app |
| [ ] | QA | Probar registro de gasto, ingreso y pago | P0 | Flujos economicos basicos |
| [ ] | QA | Probar registro de peso, rutina y racha | P0 | Flujos personales base |
| [ ] | QA | Probar lectura y respuesta de NAVIR | P0 | Debe actuar como chat real |
| [ ] | QA | Probar notificaciones y permisos en Android real | P1 | No solo en navegador |
| [ ] | QA | Validar que el APK no dependa de localhost | P0 | Condicion de salida |

Observaciones:
- Si no pasa estas pruebas, no se considera lista para uso serio.

---

## Criterio de salida

La app se considera lista para uso personal real cuando:

- NAVIR ejecuta acciones con consistencia.
- No hay doble ejecucion ni dudas sobre el resultado.
- La sesion persiste.
- El backend real responde desde Android.
- Las notificaciones funcionan.
- Finanzas, turnos, sueño, gimnasio y foco se sienten conectados.
- El usuario puede registrar y consultar todo desde chat o con muy pocos toques.
- La app no depende de rutas escondidas para lo importante.
- La experiencia deja de sentirse como prototipo y empieza a sentirse como sistema.

## Orden sugerido de ataque

1. Seguridad y bloqueadores.
2. Contrato unico de NAVIR.
3. Simplificacion de producto y navegacion.
4. Integracion real de chat con toda la app.
5. Rendimiento y fluidez.
6. Refinar salud, sueño, gimnasio y finanzas.
7. QA en Android real y salida final.

