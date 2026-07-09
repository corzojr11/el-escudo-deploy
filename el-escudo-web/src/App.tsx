import { useState } from 'react';
import SidebarNavigation from './components/SidebarNavigation';
import OmniCopilot from './components/OmniCopilot';
import DashboardHome from './pages/DashboardHome';
import FinancesPage from './pages/FinancesPage';
import GoalsPage from './pages/GoalsPage';
import ShiftsPage from './pages/ShiftsPage';
import HealthPage from './pages/HealthPage';
import './App.css';

const sectionTitles: Record<string, string> = {
  dashboard: 'Dashboard / Estado General',
  goals: 'Metas y Proyectos',
  habits: 'Hábitos',
  shifts: 'Turnos de Trabajo',
  finances: 'Gastos y Transacciones',
  health: 'Control de Peso y Sueño',
  clans: 'Clanes',
  leaderboard: 'Leaderboard',
  settings: 'Ajustes',
  stats: 'Estadísticas Avanzadas',
};

function App() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [omniVisible, setOmniVisible] = useState(false);

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      <SidebarNavigation activeSection={activeSection} onNavigate={setActiveSection} onOmniOpen={() => setOmniVisible(true)} />
      <main className="flex-grow-1" style={{ backgroundColor: '#0c0f12', overflow: 'auto' }}>
        {activeSection === 'dashboard' && <DashboardHome />}
        {activeSection === 'finances' && <FinancesPage />}
        {activeSection === 'goals' && <GoalsPage />}
        {activeSection === 'shifts' && <ShiftsPage />}
        {activeSection === 'health' && <HealthPage />}
        {!['dashboard', 'finances', 'goals', 'shifts', 'health'].includes(activeSection) && (
          <div className="p-4">
            <h2 style={{ color: '#00FF9D', fontFamily: 'Space Mono, monospace' }}>{sectionTitles[activeSection]}</h2>
          </div>
        )}
      </main>

      <OmniCopilot visible={omniVisible} onHide={() => setOmniVisible(false)} />
    </div>
  );
}

export default App;