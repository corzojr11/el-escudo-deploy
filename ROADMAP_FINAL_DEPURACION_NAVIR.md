# Roadmap final de depuracion y enfoque - EL ESCUDO

Fecha: 2026-06-07

Base de ejecucion: `audit_report.md`. Este es el roadmap vivo para ir cerrando fases y tachando avance real.

Objetivo: convertir la app en un sistema personal real, rapido y confiable en Android, con NAVIR como cerebro operativo y sin capas duplicadas, ruido visual ni funciones que estorben.

---

## Veredicto unificado

La app tiene una base tecnica fuerte, pero hoy esta demasiado dispersa.

Lo que esta claro:
- NAVIR debe ser el centro operativo.
- El chat no debe competir con el dashboard.
- No se puede mantener la misma logica en frontend y backend a la vez.
- La navegacion tiene demasiadas superficies para el valor real que entrega.
- Hay modulos utiles y modulos que solo suman ruido.

Mi lectura final:
- No hace falta rehacer todo.
- Si hace falta podar fuerte, unificar y simplificar.
- Hay que frenar la expansion hasta que el nucleo quede solido.

---

## Lo que se queda

- NAVIR como cerebro principal.
- Finanzas.
- Turnos y horarios.
- Sueï¿½o y descanso.
- Gimnasio y rutinas.
- Peso y salud.
- Foco y rachas.
- Dashboard de hoy reducido y util.
- Login, persistencia y sincronizacion bien cerrados.

---

## Lo que se congela o se elimina si estorba

- IABubble flotante si no ejecuta acciones reales.
- Chat-dashboard duplicado.
- Web paralela si solo duplica trabajo y no aporta valor real.
- Clanes.
- Challenges.
- Leaderboard.
- XP y niveles si no aportan uso real.
- Recetas ruidosas o duplicadas si el lenguaje natural ya resuelve la tarea.
- Pantallas ocultas o sin ruta clara.

Nota:
- La regla no es "borrar todo".
- La regla es conservar solo lo que sume al uso diario real.

---

## Principios de ataque

1. Una sola fuente de verdad por dato.
2. Una sola forma de ejecutar acciones criticas.
3. Un solo flujo de confirmacion para acciones sensibles.
4. Menos pantallas, menos menus, menos ruido.
5. Primero seguridad y estabilidad, luego simplificacion, luego expansion.
6. Si algo no ayuda a decidir, actuar o entender el dia, probablemente sobra.

---

## Fase 0 - Bloqueadores

Objetivo: cerrar riesgos que impiden seguir construyendo con confianza.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Seguridad | Rotar todas las claves expuestas | P0 | Supabase, Gemini, JWT y cualquier secreto sensible |
| [ ] | Seguridad | Sacar secretos del repo y del historial | P0 | `.env` y rastros en Git |
| [ ] | Auth | Fijar JWT a un solo algoritmo seguro | P0 | Evitar confusion de algoritmos |
| [ ] | API | Quitar `localhost` por defecto en builds reales | P0 | Android fisico no puede depender de eso |
| [ ] | Backend | Corregir crashes de notificaciones push | P0 | Notificaciones deben ser confiables |
| [ ] | Auth | Persistir sesion correctamente en el cliente | P0 | No perder login al cerrar la app |

---

## Fase 1 - NAVIR como motor unico

Objetivo: que el asistente entienda, confirme, ejecute, consulte y deje trazabilidad.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Asistente | Unificar el flujo de intencion a ejecucion | P0 | intencion -> validacion -> preview -> confirmacion -> ejecucion -> log |
| [ ] | Asistente | Eliminar logica duplicada entre frontend y backend | P0 | El cliente no debe repetir reglas de negocio |
| [ ] | Asistente | Agregar historial y auditoria de acciones | P1 | Saber que entendio y que ejecuto NAVIR |
| [ ] | Asistente | Soportar lectura real de datos | P0 | "Cuanto gaste", "como va mi peso", "que turno tengo" |
| [ ] | Asistente | Pedir confirmacion para acciones destructivas | P0 | Borrar, reemplazar, completar masivo, etc. |
| [ ] | Asistente | Evitar doble ejecucion en acciones criticas | P0 | Idempotencia real |

---

## Fase 2 - Simplificacion del producto

Objetivo: bajar el ruido y dejar una experiencia clara y predecible.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Navegacion | Definir un solo centro principal | P0 | Chat-first o hoy-first, pero no ambos al mismo tiempo |
| [ ] | Navegacion | Reducir tabs a lo esencial | P1 | Menos superficies visibles |
| [ ] | UI | Sacar widgets que duplican informacion | P1 | El chat no debe ser otro dashboard |
| [ ] | UI | Reducir elementos decorativos sin valor | P1 | Si no ayuda, estorba |
| [ ] | Producto | Congelar modulos secundarios no core | P1 | Social, ranking, retos, etc. si no suman ahora |
| [ ] | Producto | Unificar vistas que hacen lo mismo | P1 | Evitar duplicacion visual y funcional |

Recomendacion de superficies visibles:
- Estado o Hoy
- NAVIR
- Finanzas
- Cuerpo
- Perfil o Mas

---

## Fase 3 - Modulos core realmente utiles

Objetivo: que las areas principales tengan valor real y esten conectadas al flujo diario.

### Finanzas
| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Finanzas | Soportar ingresos variables | P0 | El sueldo no siempre es fijo |
| [ ] | Finanzas | Restar gastos de ingresos correctamente | P0 | Mostrar disponible real |
| [ ] | Finanzas | Separar pagos fijos de gasto libre | P1 | Mejor lectura del mes |
| [ ] | Finanzas | Consultar por periodo y categoria | P1 | Mes, semana, pendientes |
| [ ] | Finanzas | Registrar gasto desde chat en una frase | P0 | Debe ser facil y rapido |

### Sueï¿½o y descanso
| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Descanso | Cerrar el modelo de ciclos de sueï¿½o | P1 | Alinear con turnos y traslado |
| [ ] | Descanso | Sugerir hora de dormir realista | P1 | Basado en turno del dia siguiente |
| [ ] | Descanso | Mostrar recomendaciones breves y accionables | P2 | Menos texto, mas claridad |

### Gimnasio
| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Gimnasio | Integrar rutinas por grupo muscular | P1 | Brazo, pecho/espalda, pierna |
| [ ] | Gimnasio | Adaptar rutinas al kit de pesas real | P1 | No inventar ejercicios imposibles |
| [ ] | Gimnasio | Llevar historial, series y progreso | P2 | Que no sea solo una lista de ejercicios |

### Foco / rachas
| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Foco | Mantener solo lo que tenga valor real | P1 | Racha, impulsos, recaidas, seguimiento |
| [ ] | Foco | Hacer que NAVIR ayude a decidir en momentos de impulso | P1 | No solo registrar |
| [ ] | Foco | Evitar convertirlo en sistema de juego artificial | P2 | Menos decoracion, mas utilidad |

---

## Fase 4 - Rendimiento y fluidez

Objetivo: que la app se sienta ligera y no parezca pesada al cambiar de menu.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | Rendimiento | Virtualizar listas largas | P1 | Chat, historial, movimientos, actividad |
| [ ] | Rendimiento | Reducir re-renders innecesarios | P1 | Componentes pesados primero |
| [ ] | Rendimiento | Separar pantallas monoliticas | P1 | Mejor mantenimiento y carga |
| [ ] | Rendimiento | Revisar loaders y transiciones | P2 | Evitar pantallas de carga innecesarias |
| [ ] | Rendimiento | Bajar peso visual en pantallas de uso diario | P2 | Inicio, Finanzas, Cuerpo, NAVIR |

---

## Fase 5 - Calidad y salida real a Android

Objetivo: validar que todo funciona en dispositivo real y no solo en desarrollo.

| Hecho | Area | Tarea | Prioridad | Observaciones |
|---|---|---|---|---|
| [ ] | QA | Probar login, persistencia y reingreso | P0 | Cerrar y abrir la app no debe romper nada |
| [ ] | QA | Probar registro y consulta de finanzas | P0 | Gasto, ingreso, pago y resumen |
| [ ] | QA | Probar NAVIR como chat operativo | P0 | Debe consultar y ejecutar |
| [ ] | QA | Probar turnos, sueï¿½o, peso y rutina | P0 | Flujos personales base |
| [ ] | QA | Probar push notifications en Android real | P1 | No solo en navegador |
| [ ] | QA | Validar que nada dependa de localhost | P0 | Condicion de salida |

---

## Lo que no haria ahora

- No agregaria mas menus.
- No agregaria mas pantallas decorativas.
- No expandiria gamificacion social antes de cerrar el nucleo.
- No seguiria duplicando logica en cliente y servidor.
- No abriria otro frente de producto mientras NAVIR no sea realmente operativo.

---

## Criterio de salida

La app se considera lista para uso personal real cuando:

- NAVIR puede consultar, crear, editar y cerrar datos de forma consistente.
- No hay doble ejecucion ni dudas sobre lo que paso.
- La sesion persiste.
- El backend responde en Android real.
- Las notificaciones funcionan.
- Finanzas, sueï¿½o, gimnasio, foco y turnos estan conectados.
- El usuario puede resolver la mayoria de tareas desde el chat o con pocos toques.
- La experiencia ya no se siente como prototipo.

---

## Orden sugerido de ataque

1. Bloqueadores y seguridad.
2. Contrato unico de NAVIR.
3. Simplificacion de producto y navegacion.
4. Integracion real de modulos core.
5. Rendimiento y fluidez.
6. QA en Android real.


---

## Progreso ejecutado hoy

- [x] Eliminar IABubble flotante duplicado.
- [x] Quitar los widgets de dashboard del chat principal.
- [x] Hacer que NAVIR intente backend primero y use fallback local solo si falla.
- [x] Quitar el fallback agresivo al primer resultado en tareas y metas.
- [x] Activar `detachInactiveScreens` para mejorar la carga entre tabs.
- [x] Eliminar accesos rapidos duplicados del dashboard.
- [x] Corregir tarjetas vacias en el dashboard con datos reales.
- [x] Aï¿½adir `.gitignore` raiz para secretos y basura de build.
- [x] Separar `ScheduleScreen` en componentes reutilizables para calendario y panel de planificacion.
- [x] Separar `HealthScreen` en componentes reutilizables para el panel de templo y el panel de enfoque.
- [x] Reducir `HealthScreen` a un orquestador de estado, sync y modales.
- [x] Sustituir el bloque manual de evolucion por `WeightChart`.
- [x] Separar `FinancesScreen` en un panel de resumen reutilizable y dejar el modal/lï¿½gica en la pantalla.
- [x] Mantener ingresos, gastos, categorias, escaneo y movimientos recientes funcionando igual.
- [x] Validar compilacion TypeScript sin errores despues del refactor.
- [x] Reducir `OmniChatScreen` eliminando calculos visuales que no se renderizaban.
- [x] Mover el estado vacio del chat a `OmniEmptyState` para bajar el costo de render.
- [x] Mantener el historial del chat como `FlatList` virtualizada con limites mas bajos.
- [x] Validar compilacion TypeScript sin errores despues del refactor del chat.
- [x] Memoizar y estabilizar `ActionConfirmPanel` para reducir renders innecesarios.
- [x] Memoizar y estabilizar `RecipesModal` con lista y formularios mas livianos.
- [x] Reducir el render del chat moviendo el empty state a un componente dedicado.
- [x] Quitar animacion y carga extra en tabs para que el cambio de menu sea mas inmediato.
- [x] Limpiar `App.tsx` con tema memoizado y arranque mas estable.
- [x] Optimizar `WeightChart` para evitar sorts duplicados y calcular la tendencia en una sola pasada.
- [x] Optimizar `GymOverview` con lookup de musculos y analisis reutilizable para reducir trabajo repetido por render.
- [x] Memoizar la lista principal de `OmniChatScreen` para separar el transcript del input y bajar re-renders.
- [x] Reforzar `TabNavigator` para aislar pantallas inactivas y congelar tabs no visibles en native.
- [x] Separar `RecipesModal` en formulario y lista memoizados para evitar que la edicion del formulario repinte todo el modal.
- [x] Endurecer `ActionConfirmPanel` con comparador mas fino y filas de accion memoizadas.

- [x] Consolidar derivados de `FinancesScreen` en un solo resumen memoizado para evitar filtros y reducciones repetidas.
- [x] Memoizar el contexto derivado de `ScheduleScreen` y mover helpers de tiempo fuera del componente para bajar el costo por render.

- [x] Diferir `useOmniAgent` hasta que haya configuracion base y sesion activa para evitar trabajo innecesario en el arranque.
- [x] Consolidar calculos pesados del dashboard en `EstadoScreen` para evitar filtros y reducciones repetidas.

- [x] Memoizar lista de PRs y ventanas de sueï¿½o en `HealthTemplePanel` para evitar recalcular tarjetas en cada render.
- [x] Consolidar las props derivadas del dashboard visual para que `WellnessScoreCard` reciba arreglos estables.

- [x] Consolidar estilos compartidos de `TabNavigator` para reducir objetos recreados en cada render.

- [x] Hacer que NAVIR pueda regenerar un plan semanal completo de gimnasio desde el chat usando el equipo disponible.
- [x] Mostrar el split semanal del gimnasio en la UI para que no quede escondido como solo datos internos.


- [x] Permitir que NAVIR cambie, agregue y quite ejercicios individuales de la rutina usando lenguaje natural.
- [x] Hacer que las altas/bajas de rutina conserven equipo y grupos musculares para no perder contexto de entrenamiento.


- [x] Unificar el puerto backend a 8001 en `config/api.ts` y `.env.example`.
- [x] Corregir el destino de notificaciones para volver al tab `Estado`.
- [x] Convertir `M?s` en un acceso real a ajustes: backend, notificaciones y cierre de sesi?n.

- [x] Corregir `liquidateDebt` para que no encole una rama muerta y no duplique la ruta de error.
- [x] Hacer que NAVIR confirme acciones sin reintentar IA cuando la ejecucion local ya cubre la tarea.
- [x] Empezar un ejecutor local determinista para finanzas, rutinas, turnos, metas, tareas y foco.
- [x] Quitar el acceso rapido redundante de "Mas" del dashboard principal.
- [x] Convertir "Mas" en una pantalla de ajustes real con backend, notificaciones y cierre de sesion.
- [x] Hacer visible el registro rapido de ingresos desde FinancesScreen para que no quede escondido en el modal.
- [x] Virtualizar tambien la lista de movimientos recientes de Finanzas para bajar el costo de render.
- [x] Volver mas accionable el bloque de sueÃ±o en ScheduleScreen con una guia directa sobre el descanso.
- [x] Resumir el split real del gimnasio en una sola linea visible para no perder la lectura del plan semanal.
- [x] Volver mas accionable el panel de foco con un protocolo corto de salida del impulso.
- [x] Virtualizar la lista de PRs en Salud para que el historial crezca sin castigar el render.
- [x] Ejecutar la suite de tests existente y confirmar que pasa limpia.
- [x] Blindar la configuracion del backend para que Android nativo no use localhost por accidente.
- [x] Hacer mas robusto el alta de push tokens usando projectId cuando exista.
- [x] Validado el guard de localhost con prueba automática en src/__tests__/apiConfig.test.ts y mock global de AsyncStorage para Jest.
- [x] Blindar useOmniAgent para no llamar APIs de background task cuando no esten soportadas en el runtime.
- [x] Evitar el parpadeo del login esperando getSession() y marcando el arranque de auth como listo antes de renderizar.
- [x] Bloquear localhost guardado en API_BASE_URL al leerlo y al persistirlo, para que Android no herede una URL inutil.
- [x] Sincronizar isAuthenticated con setSession() para que el store no quede desfasado respecto a la sesión real.
- [x] Fijar la validacion JWT local a HS256 y cubrirlo con prueba en ackend/tests/test_auth.py.
- [x] Limpiar ackend/.env.example y reemplazar secretos reales por placeholders.
- [x] Eliminar logs locales del backend que exponian trazas y ruido innecesario (uvicorn-8001*.log).
- [x] Sanear guias de deploy para reemplazar ejemplos de secretos por placeholders.
- [x] Registrar cada comando de NAVIR en observabilidad para tener auditoria real del chat y sus acciones.
- [x] Restaurar `normalize_text` y `normalize_goal_type` en `omni_service.py` para recuperar la compatibilidad con la suite de backend.
- [x] Dejar la suite completa de backend pasando limpia tras los ajustes de OMNI y observabilidad.- [x] Extender la auditoria de acciones a salud, horarios, metas y rutinas para que la trazabilidad no se quede solo en el chat.
- [x] Mantener la suite completa de backend pasando limpia despues de aÃ±adir observabilidad transversal.- [x] Evitar recargas redundantes del resumen de finanzas con un guard simple de in-flight y ventana corta de refresco.
- [x] Confirmar que TypeScript y la suite de frontend siguen pasando despues del ajuste de finanzas.- [x] Reducir sincronizaciones redundantes en Salud y Horarios quitando refresh de foco que ya estaba cubierto por el dashboard y por los propios cambios.
- [x] Confirmar que TypeScript y la suite de frontend siguen pasando despues de esa poda.- [x] Dejar de rehidratar todo el store despues de altas/bajas de finanzas y actualizar la lista localmente.
- [x] Confirmar que TypeScript y la suite de frontend siguen pasando despues de ese ajuste.- [x] Quitar la sincronizacion automatica al enfocar Finanzas y dejar solo refresh manual mas cambios locales.
- [x] Confirmar que TypeScript y la suite de frontend siguen pasando despues de la simplificacion.