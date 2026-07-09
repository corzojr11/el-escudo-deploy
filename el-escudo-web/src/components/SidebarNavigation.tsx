import { useState } from 'react';

interface NavItem {
  label: string;
  icon: string;
  section: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface SidebarNavigationProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  onOmniOpen: () => void;
}

const navGroups: NavGroup[] = [
  {
    title: 'INICIO',
    items: [
      { label: 'Dashboard', icon: 'pi pi-th-large', section: 'dashboard' },
    ],
  },
  {
    title: 'PRODUCTIVIDAD',
    items: [
      { label: 'Metas', icon: 'pi pi-flag', section: 'goals' },
      { label: 'Hábitos', icon: 'pi pi-check-square', section: 'habits' },
      { label: 'Turnos', icon: 'pi pi-calendar', section: 'shifts' },
    ],
  },
  {
    title: 'FINANZAS',
    items: [
      { label: 'Gastos', icon: 'pi pi-wallet', section: 'finances' },
    ],
  },
  {
    title: 'SALUD & NUTRICIÓN',
    items: [
      { label: 'Salud', icon: 'pi pi-heart', section: 'health' },
    ],
  },
  {
    title: 'COMUNIDAD & LOGROS',
    items: [
      { label: 'Clanes', icon: 'pi pi-users', section: 'clans' },
      { label: 'Ranking', icon: 'pi pi-trophy', section: 'leaderboard' },
    ],
  },
  {
    title: 'CONFIGURACIÓN',
    items: [
      { label: 'Ajustes', icon: 'pi pi-cog', section: 'settings' },
      { label: 'Estadísticas', icon: 'pi pi-chart-bar', section: 'stats' },
    ],
  },
];

export default function SidebarNavigation({ activeSection, onNavigate, onOmniOpen }: SidebarNavigationProps) {
  const [collapsed, setCollapsed] = useState(true);

  const sidebarWidth = collapsed ? '50px' : '220px';

  return (
    <nav
      className="sidebar d-flex flex-column bg-dark min-vh-100 p-2"
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        maxWidth: sidebarWidth,
        transition: 'width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        className="btn btn-link text-decoration-none p-0 mb-4 align-self-start"
        style={{ color: '#FFB800' }}
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <i className="pi pi-bars" style={{ fontSize: '1.2rem' }} />
      </button>

      {navGroups.map((group) => (
        <div key={group.title} style={{ marginBottom: '0.75rem' }}>
          {!collapsed && (
            <small
              className="d-block text-uppercase fw-bold mb-2"
              style={{ color: '#FFB800', fontSize: '0.6rem', letterSpacing: '1px' }}
            >
              {group.title}
            </small>
          )}
          {group.items.map((item) => (
            <button
              key={item.section}
              type="button"
              className="btn btn-link text-decoration-none d-flex align-items-center sidebar-item w-100 text-start border-0 mb-1"
              style={{
                padding: collapsed ? '5px 2px' : '6px 10px',
                color: activeSection === item.section ? '#00FF9D' : '#a0a5b0',
                fontWeight: activeSection === item.section ? 500 : 400,
                background: activeSection === item.section ? 'rgba(0, 255, 157, 0.08)' : 'transparent',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
              onClick={() => onNavigate(item.section)}
            >
              <i className={item.icon} style={{ fontSize: '1rem' }} />
              {!collapsed && (
                <span className="ms-2" style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', letterSpacing: '0.5px' }}>
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}

      {/* OMNI TERMINAL — Botón premium al fondo del sidebar */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(0, 255, 157, 0.1)', paddingTop: '0.75rem' }}>
        <button
          type="button"
          className="btn btn-link text-decoration-none d-flex align-items-center sidebar-item w-100 text-start border-0"
          style={{
            padding: collapsed ? '5px 2px' : '6px 10px',
            color: '#00FF9D',
            fontWeight: 500,
            background: 'rgba(0, 255, 157, 0.06)',
            borderRadius: '6px',
            transition: 'all 0.2s ease',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
          onClick={onOmniOpen}
        >
          <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <i className="pi pi-bolt" style={{ fontSize: '1rem', color: '#00FF9D' }} />
            <span
              className="pulsing-led"
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#00ff9d',
                position: 'absolute',
                top: '-2px',
                right: '-4px',
              }}
            />
          </span>
          {!collapsed && (
            <span className="ms-2" style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', letterSpacing: '0.5px', fontFamily: 'Space Mono, monospace' }}>
              {'>'} OMNI_
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}