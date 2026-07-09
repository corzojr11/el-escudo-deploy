import { Card } from 'primereact/card';
import { useAppStore } from '../store';

export default function HealthPage() {
  const { latestWeight, weightTrend, weightRecords } = useAppStore();

  return (
    <div className="container-fluid p-4">
      <h4 style={{ color: '#00FF9D', fontFamily: 'Space Mono, monospace', letterSpacing: '1px', marginBottom: '1.5rem' }}>
        <i className="pi pi-heart me-2" /> CONTROL DE PESO Y SUEÑO
      </h4>

      <div className="row g-4 mb-4">
        <div className="col-lg-4">
          <Card style={{ background: '#12161a', border: '1px solid rgba(0, 255, 157, 0.12)', borderRadius: '12px' }}>
            <small style={{ color: '#a0a5b0' }}>Peso Actual</small>
            <h2 style={{ color: '#ffffff', fontFamily: 'Space Mono, monospace', marginTop: '0.5rem' }}>
              {latestWeight != null ? `${latestWeight} kg` : '-- kg'}
            </h2>
            {weightTrend != null && (
              <div className="d-flex align-items-center gap-1 mt-2">
                <i className={`pi pi-arrow-${weightTrend < 0 ? 'down' : 'up'}`} style={{ color: weightTrend < 0 ? '#00FF9D' : '#FF3B5C' }} />
                <small style={{ color: weightTrend < 0 ? '#00FF9D' : '#FF3B5C' }}>
                  {weightTrend > 0 ? '+' : ''}{weightTrend.toFixed(1)} kg esta semana
                </small>
              </div>
            )}
          </Card>
        </div>
        <div className="col-lg-8">
          <Card title="Historial de Peso" style={{ background: '#12161a', border: '1px solid rgba(0, 255, 157, 0.12)', borderRadius: '12px' }}>
            {weightRecords.length === 0 ? (
              <p style={{ color: '#a0a5b0', fontStyle: 'italic' }}>No hay registros de peso aún. Registra tu primer peso para ver el historial.</p>
            ) : (
              <div className="d-flex align-items-end gap-3" style={{ height: '120px' }}>
                {weightRecords.slice(-7).map((rec, i) => (
                  <div key={rec.id || i} className="text-center flex-grow-1">
                    <div style={{
                      height: `${Math.max(20, (rec.weight / 100) * 120)}px`,
                      backgroundColor: i === weightRecords.slice(-7).length - 1 ? '#00FF9D' : 'rgba(0, 255, 157, 0.3)',
                      borderRadius: '4px 4px 0 0',
                      marginBottom: '4px',
                    }} />
                    <small style={{ color: '#a0a5b0', fontSize: '0.65rem' }}>
                      {new Date(rec.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <button type="button" className="cyber-pill">
        <i className="pi pi-plus me-1" /> Registrar Peso
      </button>
    </div>
  );
}
