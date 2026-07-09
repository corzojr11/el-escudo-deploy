# Roadmap real de cierre para Android personal

Fecha: 2026-06-01

Este roadmap resume solo lo que sigue vivo hoy para que la app quede usable en Android personal con menos riesgo.

## Bloqueadores reales

- [ ] Rotar secretos expuestos del backend y mover credenciales sensibles fuera del repo.
- [x] Cambiar Supabase web client para persistir sesion con `AsyncStorage`.
- [x] Reducir validacion JWT a `HS256` solamente.
- [x] Corregir el crash de `register_push_token` en backend.
- [x] Agregar plugin de `expo-notifications` para builds EAS.
- [x] Quitar fallback silencioso de Supabase en el backend.

## Robustez movil

- [x] Confirmar que la URL del backend se pueda cambiar y persistir desde la app.
- [ ] Verificar push notifications en Android real.
- [ ] Confirmar login persistente al cerrar y abrir la app.
- [ ] Validar sincronizacion sin red y en reconexion.

## Producto

- [ ] Cerrar el modulo de gimnasio con rutina, progresion y registros utiles.
- [ ] Reducir friccion de navegacion en pantallas secundarias.
- [ ] Separar componentes muy grandes cuando afecten rendimiento o mantenimiento.

## Criterio de salida

La app se considera lista para uso personal en Android cuando:
- abre en un APK real,
- mantiene sesion,
- conecta al backend real,
- registra acciones desde OMNI,
- no crashea en push ni login,
- y el flujo principal funciona sin depender de localhost.
