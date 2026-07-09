import { Card } from 'primereact/card';
import { useAppStore } from '../store';

export default function FinancesPage() {
  const { todayIncome, todayExpense, transactions } = useAppStore();

  return (
    <div className="container-fluid p-4">
      <h4 style={{ color: '#00FF9D', fontFamily: 'Space Mono, monospace', letterSpacing: '1px', marginBottom: '1.5rem' }}>
        <i className="pi pi-wallet me-2" /> GASTOS Y TRANSACCIONES
      </h4>

      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <Card title="Balance Hoy" style={{ background: '#12161a', border: '1px solid rgba(0, 255, 157, 0.12)', borderRadius: '12px' }}>
            <div className="d-flex justify-content-between">
              <div>
                <small style={{ color: '#a0a5b0' }}>Ingresos</small>
                <h5 style={{ color: '#00FF9D', fontFamily: 'Space Mono, monospace' }}>+${todayIncome.toLocaleString()}</h5>
              </div>
              <div className="text-end">
                <small style={{ color: '#a0a5b0' }}>Gastos</small>
                <h5 style={{ color: '#FF3B5C', fontFamily: 'Space Mono, monospace' }}>-${todayExpense.toLocaleString()}</h5>
              </div>
            </div>
            <div className="progress mt-3" style={{ height: '4px', backgroundColor: '#1a1f2a', borderRadius: '2px' }}>
              <div className="progress-bar" style={{ width: `${todayIncome > 0 ? (todayExpense / todayIncome) * 100 : 0}%`, backgroundColor: '#FF3B5C', borderRadius: '2px' }} />
            </div>
          </Card>
        </div>
        <div className="col-md-8">
          <Card title="Últimas Transacciones" style={{ background: '#12161a', border: '1px solid rgba(0, 255, 157, 0.12)', borderRadius: '12px' }}>
            {transactions.length === 0 ? (
              <p style={{ color: '#a0a5b0', fontStyle: 'italic' }}>No hay transacciones registradas. Usa OMNI para registrar tu primer gasto.</p>
            ) : (
              transactions.slice(0, 5).map((tx, i) => (
                <div key={tx.id || i} className="d-flex justify-content-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: '#ffffff' }}>
                    <i className={`pi ${tx.type === 'income' ? 'pi-arrow-up' : 'pi-arrow-down'} me-2`}
                       style={{ color: tx.type === 'income' ? '#00FF9D' : '#FF3B5C' }} />
                    {tx.description || tx.category}
                  </span>
                  <span style={{ color: tx.type === 'income' ? '#00FF9D' : '#FF3B5C', fontFamily: 'Space Mono, monospace' }}>
                    {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      <div className="d-flex gap-2 mt-3">
        <button type="button" className="cyber-pill">
          <i className="pi pi-plus me-1" /> Nuevo Gasto
        </button>
        <button type="button" className="cyber-pill-cyan">
          <i className="pi pi-plus me-1" /> Nuevo Ingreso
        </button>
      </div>
    </div>
  );
}
