import { useEffect } from 'react';
import { Card } from 'primereact/card';
import { useAppStore } from '../store';

export default function DashboardHome() {
  const { profile, todayIncome, todayExpense, todayTasksCompleted, todayTasksTotal, activeShifts, goals, latestWeight, weightTrend, isLoading, hydrateStore } = useAppStore();

  useEffect(() => {
    hydrateStore();
  }, [hydrateStore]);

  const playerLevel = profile?.level ?? 0;
  const playerXP = profile?.xp ?? 0;
  const xpToNextLevel = profile?.xp_to_next_level ?? 100;
  const xpPercent = xpToNextLevel > 0 ? (playerXP / xpToNextLevel) * 100 : 0;
  const currentStreak = profile?.streak ?? 0;

  const monthGoals = goals.length > 0
    ? goals.map((g) => ({ label: g.title, progress: g.progress }))
    : [
        { label: 'Ahorrar $5,000', progress: 35 },
        { label: '15 días de ejercicio', progress: 60 },
        { label: 'Leer 3 libros', progress: 80 },
      ];

  const recentExpenses = [
    { month: 'Ene', height: 40 },
    { month: 'Feb', height: 55 },
    { month: 'Mar', height: 70 },
  ];

  return (
    <div className="container-fluid p-4">
      {isLoading && (
        <div className="text-end mb-2">
          <small style={{ color: '#FFB800' }}>
            <i className="pi pi-spin pi-spinner me-1" /> Sincronizando...
          </small>
        </div>
      )}
      {/* Fila KPIs */}
      <div className="row g-4 mb-4">
        <div className="col-lg-4 col-md-6">
          <Card
            title={
              <span style={{ color: '#FFB800', fontSize: '1rem' }}>
                <i className="pi pi-star-fill me-2" /> Nivel del Jugador
              </span>
            }
            style={{ backgroundColor: '#151a22', color: '#ffffff', border: '1px solid #2a2f38' }}
          >
            <h3 style={{ color: '#FFB800', marginBottom: '0.5rem' }}>Nivel {playerLevel}</h3>
            <div className="progress" style={{ height: '8px', backgroundColor: '#2a2f38', borderRadius: '4px' }}>
              <div
                className="progress-bar"
                role="progressbar"
                style={{ width: `${xpPercent}%`, backgroundColor: '#00FF9D', borderRadius: '4px' }}
              />
            </div>
            <small className="text-muted mt-2 d-block">
              {playerXP.toLocaleString()} / {xpToNextLevel.toLocaleString()} XP
            </small>
          </Card>
        </div>

        <div className="col-lg-4 col-md-6">
          <Card
            title={
              <span style={{ color: '#FFB800', fontSize: '1rem' }}>
                <i className="pi pi-bolt me-2" /> Racha Actual
              </span>
            }
            style={{ backgroundColor: '#151a22', color: '#ffffff', border: '1px solid #2a2f38' }}
          >
            <h1 style={{ color: '#FFB800', fontSize: '2.5rem', marginBottom: '0.5rem' }}>
              <i className="pi pi-bolt me-2" />
              {currentStreak}
            </h1>
            <p className="text-muted">Días consecutivos</p>
          </Card>
        </div>

        <div className="col-lg-4 col-md-12">
          <Card
            title={
              <span style={{ color: '#FFB800', fontSize: '1rem' }}>
                <i className="pi pi-wallet me-2" /> Balance del Día
              </span>
            }
            style={{ backgroundColor: '#151a22', color: '#ffffff', border: '1px solid #2a2f38' }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <small className="text-muted d-block">Ingresos</small>
                <span style={{ color: '#00FF9D', fontWeight: 600, fontSize: '1.1rem' }}>
                  +${todayIncome.toLocaleString()}
                </span>
              </div>
              <div className="text-end">
                <small className="text-muted d-block">Gastos</small>
                <span style={{ color: '#FF3B5C', fontWeight: 600, fontSize: '1.1rem' }}>
                  -${todayExpense.toLocaleString()}
                </span>
              </div>
            </div>
            <hr style={{ borderColor: '#2a2f38', margin: '0.5rem 0' }} />
            <div className="text-center">
              <small className="text-muted">Neto</small>
              <strong
                className="d-block"
                style={{
                  color: todayIncome - todayExpense >= 0 ? '#00FF9D' : '#FF3B5C',
                  fontSize: '1.2rem',
                }}
              >
                ${(todayIncome - todayExpense).toLocaleString()}
              </strong>
            </div>
          </Card>
        </div>
      </div>

      {/* Sección Central */}
      <div className="row g-4">
        {/* Columna Izquierda — Productividad */}
        <div className="col-lg-8">
          <h5 style={{ color: '#FFB800', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <i className="pi pi-briefcase me-2" /> Productividad
          </h5>

          <Card
            title={
              <span style={{ color: '#ffffff', fontSize: '1rem' }}>
                <i className="pi pi-check-circle me-2" style={{ color: '#00FF9D' }} />
                Resumen Diario
              </span>
            }
            style={{ backgroundColor: '#151a22', color: '#ffffff', border: '1px solid #2a2f38' }}
            className="mb-3"
          >
            <div className="mb-3">
              <div className="d-flex justify-content-between mb-1">
                <span><i className="pi pi-check-circle me-1" style={{ color: '#00FF9D' }} /> Tareas completadas</span>
                <strong style={{ color: '#00FF9D' }}>{todayTasksCompleted}/{todayTasksTotal}</strong>
              </div>
              <div className="progress" style={{ height: '6px', backgroundColor: '#2a2f38', borderRadius: '3px' }}>
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{ width: `${todayTasksTotal > 0 ? (todayTasksCompleted / todayTasksTotal) * 100 : 0}%`, backgroundColor: '#00FF9D', borderRadius: '3px' }}
                />
              </div>
            </div>
            <p className="mb-0">
              <i className="pi pi-calendar me-1" style={{ color: '#00E5FF' }} /> Turnos activos:{' '}
              <strong style={{ color: '#00E5FF' }}>{activeShifts.length}</strong>
            </p>
          </Card>

          <Card
            title={
              <span style={{ color: '#ffffff', fontSize: '1rem' }}>
                <i className="pi pi-flag me-2" style={{ color: '#FFB800' }} />
                Objetivos del Mes
              </span>
            }
            style={{ backgroundColor: '#151a22', color: '#ffffff', border: '1px solid #2a2f38' }}
          >
            {monthGoals.map((goal, i) => (
              <div key={i} className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <small>{goal.label}</small>
                  <small style={{ color: '#00FF9D' }}>{goal.progress}%</small>
                </div>
                <div className="progress" style={{ height: '6px', backgroundColor: '#2a2f38', borderRadius: '3px' }}>
                  <div
                    className="progress-bar"
                    role="progressbar"
                    style={{ width: `${goal.progress}%`, backgroundColor: '#00FF9D', borderRadius: '3px' }}
                  />
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Columna Derecha — Salud & Finanzas */}
        <div className="col-lg-4">
          <h5 style={{ color: '#FFB800', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <i className="pi pi-heart me-2" /> Salud & Finanzas
          </h5>

          <Card
            title={
              <span style={{ color: '#ffffff', fontSize: '1rem' }}>
                <i className="pi pi-heart me-2" style={{ color: '#FF3B5C' }} />
                Control de Peso
              </span>
            }
            style={{ backgroundColor: '#151a22', color: '#ffffff', border: '1px solid #2a2f38' }}
            className="mb-3"
          >
            <div className="d-flex justify-content-between align-items-end">
              <div>
                <small className="text-muted d-block">Último registro</small>
                <h3 style={{ color: '#ffffff', fontSize: '2rem', marginBottom: '0' }}>
                  {latestWeight != null ? latestWeight : '--'} <small style={{ fontSize: '0.9rem', color: '#a0a5b0' }}>kg</small>
                </h3>
              </div>
              <div className="text-end">
                {weightTrend != null && (
                  <>
                    <i
                      className={`pi pi-arrow-${weightTrend < 0 ? 'down' : 'up'}`}
                      style={{ color: weightTrend < 0 ? '#00FF9D' : '#FF3B5C', fontSize: '1.5rem', display: 'block' }}
                    />
                    <small style={{ color: weightTrend < 0 ? '#00FF9D' : '#FF3B5C' }}>
                      {weightTrend > 0 ? '+' : ''}{weightTrend.toFixed(1)} kg
                    </small>
                  </>
                )}
                {weightTrend == null && (
                  <small className="text-muted">--</small>
                )}
              </div>
            </div>
            <small className="text-muted d-block mt-2">Esta semana</small>
          </Card>

          <Card
            title={
              <span style={{ color: '#ffffff', fontSize: '1rem' }}>
                <i className="pi pi-chart-bar me-2" style={{ color: '#00E5FF' }} />
                Gastos Recientes
              </span>
            }
            style={{ backgroundColor: '#151a22', color: '#ffffff', border: '1px solid #2a2f38' }}
            className="mb-3"
          >
            <div className="d-flex justify-content-around align-items-end" style={{ height: '100px' }}>
              {recentExpenses.map((item, i) => (
                <div key={item.month} className="text-center">
                  <div
                    style={{
                      width: '28px',
                      height: `${item.height}px`,
                      backgroundColor: i === recentExpenses.length - 1 ? '#00FF9D' : 'rgba(0, 255, 157, 0.4)',
                      margin: '0 auto 0.25rem',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                    }}
                  />
                  <small className="text-muted">{item.month}</small>
                </div>
              ))}
            </div>
          </Card>

          {/* Accesos Rápidos */}
          <div className="d-flex gap-2">
            <button type="button" className="cyber-pill flex-grow-1 text-center">
              <i className="pi pi-wallet me-1" /> Registrar Gasto
            </button>
            <button type="button" className="cyber-pill-cyan flex-grow-1 text-center">
              <i className="pi pi-heart me-1" /> Registrar Peso
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}