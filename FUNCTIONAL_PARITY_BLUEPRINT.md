# FUNCTIONAL PARITY BLUEPRINT — EL ESCUDO

## Comparativa: app móvil (el-escudo) vs web (escudo-web-v2)

### Leyenda
- ✅ = implementada correctamente
- ⚠️ = parcial, necesita completar
- ❌ = falta por completo
- 🚫 = no debe trasladarse

---

## 1. PERFIL Y ONBOARDING

| Funcionalidad | Móvil | Web | Estado | Prioridad |
|---|---|---|---|---|
| Onboarding 3 pasos (nombre/edad, peso/talla, objetivo) | ✅ | ✅ /onboarding | ✅ | — |
| Perfil editable (nombre, fecha nac., talla, objetivo) | ❌ (solo local) | ✅ /perfil | ✅ | — |
| Persistencia en backend | ❌ (POST /api/v1/profile sin endpoint) | ✅ PUT /api/v1/profile | ✅ | — |

**Estado**: Completo en web. Mejor que el móvil (persiste en DB).

---

## 2. DASHBOARD / CENTRO DE MANDO

| Funcionalidad | Móvil | Web | Estado | Prioridad |
|---|---|---|---|---|
| Resumen financiero (balance, ingresos, gastos) | ✅ | ✅ Dashboard | ✅ | — |
| Turno actual / próximo | ❌ (vía store, no en dashboard) | ✅ Dashboard | ✅ | — |
| Peso actual y tendencia | ✅ | ✅ Dashboard | ✅ | — |
| Hidratación diaria | ❌ | ✅ Dashboard | ✅ | — |
| Hábitos completados hoy | ❌ | ✅ Dashboard | ✅ | — |
| Misiones diarias | ✅ | ✅ Dashboard | ✅ | — |
| XP, nivel, progreso | ✅ | ✅ Dashboard | ✅ | — |
| Wellness Score (0-100) | ✅ | ❌ | ❌ | P2 |
| Insight semanal | ✅ | ❌ | ❌ | P2 |
| Sugerencias OMNI accionables | ✅ | ❌ | ❌ | P2 |
| **Plan del día (sueño, entreno, horario)** | ✅ vía Chronos | ❌ | ❌ | P0 |
| Home Pulse (resumen narrativo del día) | ✅ | ❌ | ❌ | P2 |

**P0**: Plan del día con sueño y entrenamiento.

---

## 3. METAS, PROGRESO Y MISIONES

| Funcionalidad | Móvil | Web | Estado | Prioridad |
|---|---|---|---|---|
| CRUD de metas | ❌ (solo local) | ✅ /metas | ✅ | — |
| Registrar progreso (métricas) | ❌ | ✅ | ✅ | — |
| Meta con porcentaje y deadline | ❌ | ✅ | ✅ | — |
| CRUD de misiones/tareas | ✅ | ✅ /misiones | ✅ | — |
| Prioridad y fecha programada | ✅ | ✅ | ✅ | — |
| Completar misión con XP | ✅ | ✅ | ✅ | — |
| Filtros (todas, pendientes, completadas) | ✅ | ✅ | ✅ | — |
| Dashboard con misiones reales | ❌ (tareasHoy store) | ✅ | ✅ | — |

**P1**: Misiones no tienen UI en la web.

---

## 4. HÁBITOS Y RACHAS

| Funcionalidad | Móvil | Web | Estado | Prioridad |
|---|---|---|---|---|
| CRUD de hábitos | ❌ | ✅ /habitos | ✅ | — |
| Toggle diario (check/uncheck) | ❌ | ✅ | ✅ | — |
| Rachas (streak) | ❌ | ✅ | ✅ | — |
| Fecha Bogotá para toggle | ❌ | ✅ | ✅ | — |

**Estado**: Completo en web.

---

## 5. FINANZAS

| Funcionalidad | Móvil | Web | Estado | Prioridad |
|---|---|---|---|---|
| CRUD de transacciones | ✅ | ✅ /finanzas | ✅ | — |
| Balance, ingresos, gastos | ✅ | ✅ | ✅ | — |
| Categorías | ✅ | ✅ | ✅ | — |
| Escaneo de comprobantes (OCR) | ✅ | ❌ | ❌ | P2 |
| Quick entry por texto | ✅ | ❌ | ❌ | P2 |
| Deudas y gastos fijos | ✅ | ❌ | ❌ | P2 |
| Análisis financiero | ✅ (local) | ❌ | ❌ | P2 |

**Estado**: CRUD completo. Faltan features avanzados (P2).

---

## 6. TURNOS, CALENDARIO Y AGENDA

| Funcionalidad | Móvil | Web | Estado | Prioridad |
|---|---|---|---|---|
| CRUD de turnos | ✅ | ✅ /turnos | ✅ | — |
| Estado actual (en turno / libre) | ✅ | ✅ | ✅ | — |
| Próximo turno con cuenta regresiva | ✅ | ✅ | ✅ | — |
| **Minutos de traslado configurables** | ✅ | ❌ | ❌ | P0 |
| **Hora objetivo de despertar configurable** | ✅ | ❌ | ❌ | P0 |
| **Hora objetivo de dormir configurable** | ✅ | ❌ | ❌ | P0 |
| Transición domingo-lunes | ✅ | ✅ (compute_current_status) | ✅ | — |
| Turnos nocturnos (cruzan medianoche) | ✅ | ✅ (compute_current_status) | ✅ | — |
| Calendario semanal | ✅ | ✅ (grid) | ✅ | — |
| OCR de horario desde foto | ✅ | ❌ | ❌ | P2 |
| Cronología diaria (timeline) | ✅ | ❌ | ❌ | P2 |

**P0**: Configuración de traslado, hora de despertar y dormir.

---

## 7. SUEÑO

| Funcionalidad | Móvil | Web | Estado | Prioridad |
|---|---|---|---|---|
| **Optimizador de sueño (ciclos según turno)** | ✅ Chronos | ✅ plan-diario | ✅ | — |
| **Registrar sueño (hora dormir, despertar, ciclos, calidad)** | ❌ | ✅ /salud | ✅ | — |
| **Resumen últimos 7 días** | ❌ | ✅ /salud | ✅ | — |
| Cálculo de ciclos (4/5/6 × 90min + 15min latencia) | ✅ | ✅ corregido | ✅ | — |
| Considerar traslado y preparación (45 min) | ✅ | ✅ | ✅ | — |
| Texto orientativo (no médico) | ❌ | ✅ | ✅ | —

**Estado**: Completo. Formulario en Salud, cálculo corregido en plan-diario.

---

## 8. SALUD Y ENTRENAMIENTO

| Funcionalidad | Móvil | Web | Estado | Prioridad |
|---|---|---|---|---|
| Peso (CRUD, gráfico) | ✅ | ✅ /salud | ✅ | — |
| Registro de ejercicio (log) | ✅ | ✅ /salud | ✅ | — |
| Personal records (PR) | ✅ | ✅ /salud | ✅ | — |
| Historial reciente de ejercicios | ❌ | ✅ /salud | ✅ | — |
| Rutinas semanales (PPL) | ✅ | ⚠️ (backend sí) | ⚠️ | P2 |
| **Bloque de entrenamiento sugerido** | ✅ Chronos | ❌ | ❌ | P0 |
| Recuperación / descanso cuando no hay ventana | ✅ | ❌ | ❌ | P0 |
| Temporizador de descanso entre series | ✅ | ❌ | ❌ | P2 |
| Equipamiento disponible | ✅ | ❌ | ❌ | P2 |
| Enfoque / disciplina (Modo Discreto) | ✅ | ✅ (parcial, solo lectura) | ⚠️ | P2 |

**P0**: Bloque de entrenamiento sugerido en el plan del día.

---

## 9. OMNI / ASISTENTE IA

| Funcionalidad | Móvil | Web | Estado | Prioridad |
|---|---|---|---|---|
| Chat con IA (comandos) | ✅ | ✅ /omni | ✅ | — |
| Confirmación de acciones | ✅ | ✅ | ✅ | — |
| Historial de mensajes | ✅ | ✅ | ✅ | — |
| Recetas guardadas | ✅ | ✅ | ✅ | — |
| Comandos locales offline | ✅ | ❌ | 🚫 | — |
| Voz (speech recognition) | ✅ | ❌ | 🚫 | — |
| Sugerencias contextuales | ✅ | ⚠️ (parcial) | ⚠️ | P2 |

**Estado**: CRUD completo. Faltan features avanzados (P2).

---

## 10. GAMIFICACIÓN

| Funcionalidad | Móvil | Web | Estado | Prioridad |
|---|---|---|---|---|
| XP, nivel, barra de progreso | ✅ | ✅ Dashboard | ✅ | — |
| Logros (achievements) | ✅ (animaciones) | ❌ | ❌ | P2 |
| Rachas visibles | ✅ | ✅ (focus streak) | ✅ | — |
| Notificaciones push | ✅ | ❌ | ❌ | P2 |

---

## 11. SOCIAL Y COMUNIDAD

| Funcionalidad | Móvil | Web | Estado |
|---|---|---|---|
| Clanes | ✅ | ❌ | 🚫 (fuera de esta fase) |
| Retos (challenges) | ✅ | ❌ | 🚫 (fuera de esta fase) |
| Ranking | ✅ | ❌ | 🚫 (fuera de esta fase) |

---

## 12. CONFIGURACIÓN

| Funcionalidad | Móvil | Web | Estado | Prioridad |
|---|---|---|---|---|
| Hora de despertar | ✅ (vía bio_settings) | ❌ | ❌ | P0 |
| Minutos de traslado | ✅ (vía schedule) | ❌ | ❌ | P0 |
| Configuración biológica completa | ✅ (vía MoreScreen) | ❌ | ❌ | P2 |
| Notificaciones toggle | ✅ | ❌ | ❌ | P2 |

---

## RESUMEN DE PRIORIDADES

### P0 — Plan diario inteligente (esta fase)
1. **Configuración de agenda**: minutos de traslado, hora despertar, hora dormir
2. **Optimizador de sueño**: ciclos 4/5/6, considerar turno + traslado + preparación
3. **Registro de sueño**: fecha, dormir, despertar, ciclos, calidad, notas
4. **Resumen de sueño 7 días**: análisis en dashboard
5. **Bloque de entrenamiento**: ventana sugerida, no solapar con turno
6. **Dashboard enriquecido**: plan del día completo

### P1 — Próxima fase
1. Misiones/tareas con UI web completa
2. Logros y animaciones
3. Ejercicio (log + PR)

### P2 — Backlog
1. Wellness Score, Insight semanal, sugerencias OMNI
2. OCR de comprobantes y horarios
3. Deudas, gastos fijos, quick entry
4. Temporizador de descanso, rutinas, equipamiento
5. Notificaciones push
