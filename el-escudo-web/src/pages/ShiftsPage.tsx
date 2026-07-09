import { Card } from 'primereact/card';
import { useAppStore } from '../store';

export default function ShiftsPage() {
  const { activeShifts } = useAppStore();

  const mockShifts = activeShifts.length > 0 ? activeShifts : [
    { id: '1', start_time: new Date().toISOString(), end_time: null, active: true, tasks_completed: 4 },
    { id: '2', start_time: new Date(Date.now() - 86400000).toISOString(), end_time: new Date(Date.now() - 36000000).toISOString(), active: false, tasks_completed: 8 },
  ];

  return (
    <div className="container-fluid p-4">
      <h4 style={{ color: '#00FF9D', fontFamily: 'Space Mono, monospace', letterSpacing: '1px', marginBottom: '1.5rem' }}>
        <i className="pi pi-calendar me-2" /> TURNOS DE TRABAJO
      </h4>

      <div className="row g-4">
        {mockShifts.map((shift, i) => (
          <div key={shift.id || i} className="col-lg-6">
            <Card style={{ background: '#12161a', border: `1px solid ${shift.active ? 'rgba(0, 255, 157, 0.3)' : 'rgba(255, 255, 255, 0.05)'}`, borderRadius: '12px' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span style={{ fontFamily: 'Space Mono, monospace', color: '#ffffff', fontSize: '0.9rem' }}>
                  Turno #{i + 1}
                </span>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '50px',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '0.7rem',
                  background: shift.active ? 'rgba(0, 255, 157, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  color: shift.active ? '#00FF9D' : '#a0a5b0',
                  border: `1px solid ${shift.active ? '#00FF9D' : '#2a2f38'}`,
                }}>
                  {shift.active ? 'ACTIVO' : 'COMPLETADO'}
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <div>
                  <small style={{ color: '#a0a5b0' }}>Inicio</small>
                  <p style={{ color: '#ffffff', fontFamily: 'Space Mono, monospace', margin: 0, fontSize: '0.85rem' }}>
                    {new Date(shift.start_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-end">
                  <small style={{ color: '#a0a5b0' }}>Tareas</small>
                  <p style={{ color: '#00E5FF', fontFamily: 'Space Mono, monospace', margin: 0, fontSize: '0.85rem' }}>
                    {shift.tasks_completed} completadas
                  </p>
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>

      <button type="button" className="cyber-pill mt-4">
        <i className="pi pi-play me-1" /> Iniciar Nuevo Turno
      </button>
    </div>
  );
}
