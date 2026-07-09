import { Card } from 'primereact/card';
import { useAppStore } from '../store';

export default function GoalsPage() {
  const { goals } = useAppStore();
  const displayGoals = goals.length > 0 ? goals : [
    { id: '1', title: 'Ahorrar $5,000', progress: 35, target: 100, category: 'finanzas', completed: false },
    { id: '2', title: '15 días de ejercicio', progress: 60, target: 100, category: 'salud', completed: false },
    { id: '3', title: 'Leer 3 libros', progress: 80, target: 100, category: 'personal', completed: false },
    { id: '4', title: 'Completar 20 turnos de trabajo', progress: 45, target: 100, category: 'trabajo', completed: false },
  ];

  return (
    <div className="container-fluid p-4">
      <h4 style={{ color: '#00FF9D', fontFamily: 'Space Mono, monospace', letterSpacing: '1px', marginBottom: '1.5rem' }}>
        <i className="pi pi-flag me-2" /> METAS Y PROYECTOS
      </h4>

      <div className="row g-4">
        {displayGoals.map((goal, i) => (
          <div key={goal.id || i} className="col-lg-6">
            <Card style={{ background: '#12161a', border: '1px solid rgba(0, 255, 157, 0.12)', borderRadius: '12px' }}>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <h6 style={{ color: '#ffffff', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', margin: 0 }}>
                  {goal.title}
                </h6>
                <span style={{ color: goal.completed ? '#00FF9D' : '#FFB800', fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', fontWeight: 600 }}>
                  {goal.progress}%
                </span>
              </div>
              <div className="progress" style={{ height: '6px', backgroundColor: '#1a1f2a', borderRadius: '3px' }}>
                <div className="progress-bar" style={{ width: `${goal.progress}%`, backgroundColor: goal.completed ? '#00FF9D' : '#FFB800', borderRadius: '3px' }} />
              </div>
              <small style={{ color: '#a0a5b0', marginTop: '4px', display: 'block' }}>
                {goal.category.toUpperCase()}
              </small>
            </Card>
          </div>
        ))}
      </div>

      <button type="button" className="cyber-pill mt-4">
        <i className="pi pi-plus me-1" /> Nueva Meta
      </button>
    </div>
  );
}
