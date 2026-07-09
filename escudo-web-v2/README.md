# El Escudo — Web App v2

Nueva base del frontend web de **El Escudo**, construida con:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui (base-nova)
- Supabase Auth (base preparada)

## Estado

Fundación inicial lista. Contiene:

- Layout principal de dashboard responsive (sidebar + topbar + menú móvil).
- Navegación base para los módulos V1: Dashboard, OMNI, Finanzas, Metas, Salud, Turnos y Hábitos.
- Placeholders limpios para cada módulo.
- Tema oscuro con la identidad visual de El Escudo.
- Base preparada para autenticación con Supabase (cliente + variables de entorno de ejemplo).

## Scripts

```bash
npm run dev      # Servidor de desarrollo en http://localhost:3000
npm run build    # Compilación de producción
npm run start    # Servidor de producción
npm run lint     # ESLint
```

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=
```

## Estructura relevante

```
src/
  app/
    (dashboard)/        # Layout y rutas del dashboard
      page.tsx          # Dashboard principal
      omni/
      finanzas/
      metas/
      salud/
      turnos/
      habitos/
    login/              # Placeholder de login
  components/
    dashboard/          # Sidebar, Topbar, MobileNav, ModulePlaceholder
    ui/                 # Componentes shadcn/ui
  lib/
    auth/               # Cliente Supabase y README de autenticación
    constants/          # Navegación
```

## Notas

- `el-escudo-web/` y `el-escudo/` son referencia visual/funcional, no base técnica.
- No se migraron módulos funcionales completos ni CRUDs grandes en esta fase.
- El backend existente y Supabase se conservan.
