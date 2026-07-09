import { useState } from 'react';
import { Sidebar } from 'primereact/sidebar';
import { InputText } from 'primereact/inputtext';
import { useAppStore } from '../store';

interface OmniCopilotProps {
  visible: boolean;
  onHide: () => void;
}

const recipeCategories = [
  {
    header: 'Trabajo y Productividad',
    recipes: [
      'Iniciar turno de trabajo',
      'Registrar avance de meta',
      'Ver tareas pendientes',
    ],
  },
  {
    header: 'Finanzas',
    recipes: [
      'Registrar gasto',
      'Ver balance semanal',
      'Calcular ahorro meta',
    ],
  },
  {
    header: 'Salud',
    recipes: [
      'Registrar peso',
      'Ver progreso salud',
      'Iniciar rutina ejercicio',
    ],
  },
];

export default function OmniCopilot({ visible, onHide }: OmniCopilotProps) {
  const [command, setCommand] = useState('');
  const { chatHistory, isLoading, sendOmniCommand } = useAppStore();

  const handleRecipeClick = (recipe: string) => {
    setCommand(recipe);
  };

  const handleSend = () => {
    if (!command.trim()) return;
    sendOmniCommand(command.trim());
    setCommand('');
  };

  const sidebarHeader = (
    <div className="d-flex align-items-center w-100">
      <div className="d-flex align-items-center">
        <span className="pulsing-led me-2" style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#00ff9d',
          display: 'inline-block',
        }} />
        <span style={{ color: '#00FF9D', fontFamily: 'Space Mono, monospace', fontSize: '0.95rem', letterSpacing: '1px' }}>
          {'>'} OMNI_TERMINAL
        </span>
      </div>
      <small className="ms-auto" style={{ color: '#6c757d', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem' }}>
        v1.0.4 // ONLINE
      </small>
    </div>
  );

  return (
    <Sidebar
      visible={visible}
      onHide={onHide}
      position="right"
      style={{
        width: '420px',
        backgroundColor: '#151a22',
        color: '#ffffff',
        borderLeft: '1px solid #2a2f38',
      }}
      showCloseIcon
      icons={() => (
        <button
          type="button"
          className="btn btn-link text-decoration-none p-0"
          style={{ color: '#a0a5b0' }}
          onClick={onHide}
        >
          <i className="pi pi-times" style={{ fontSize: '1.2rem' }} />
        </button>
      )}
      header={sidebarHeader}
    >
      <div className="d-flex flex-column" style={{ height: 'calc(100vh - 80px)' }}>
        {/* Chat Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 380px)',
            paddingRight: '4px',
          }}
          className="mb-3"
        >
          {chatHistory.map((msg, i) => (
            <div
              key={i}
              className={`mb-2 d-flex ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
            >
              <div
                className={msg.role === 'user' ? 'terminal-msg-user' : 'terminal-msg-omni'}
                style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                }}
              >
                <div>{msg.text}</div>
                <small className="terminal-msg-time" style={{ display: 'block', marginTop: '4px' }}>
                  [{msg.time}]
                </small>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="mb-2 d-flex justify-content-start">
              <div
                style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  backgroundColor: '#0c0f12',
                  color: '#00E5FF',
                  fontSize: '0.8rem',
                  fontFamily: 'Space Mono, monospace',
                  border: '1px solid rgba(0, 229, 255, 0.2)',
                }}
              >
                <span style={{ color: '#00FF9D' }}>{'>'}</span> procesando...
              </div>
            </div>
          )}
        </div>

        {/* Recetas Rápidas — Píldoras Cyberpunk */}
        <div style={{ maxHeight: '160px', overflowY: 'auto' }} className="mb-3">
          <small
            className="text-muted text-uppercase d-block mb-2"
            style={{ fontSize: '0.7rem', letterSpacing: '1px', fontFamily: 'Space Mono, monospace' }}
          >
            <i className="pi pi-book me-1" /> RECETAS RÁPIDAS
          </small>
          <div className="d-flex flex-wrap gap-2">
            {recipeCategories.flatMap((cat) =>
              cat.recipes.map((recipe) => (
                <button
                  key={recipe}
                  type="button"
                  className="cyber-pill"
                  style={{ padding: '4px 12px', fontSize: '0.7rem', borderWidth: '1px' }}
                  onClick={() => handleRecipeClick(recipe)}
                >
                  {recipe}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Input de Comandos */}
        <div className="d-flex gap-2 align-items-center mt-auto">
          <div className="flex-grow-1">
            <InputText
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Escribe un comando..."
              style={{
                width: '100%',
                backgroundColor: '#0c0f12',
                border: '1px solid #2a2f38',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '0.85rem',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
          </div>
          <button
            type="button"
            className="btn btn-link text-decoration-none p-0"
            style={{ color: command.trim() ? '#00FF9D' : '#6c757d', fontSize: '1.2rem' }}
            onClick={handleSend}
          >
            <i className="pi pi-send" />
          </button>
          <button
            type="button"
            className="btn btn-link text-decoration-none p-0"
            style={{ color: '#6c757d', fontSize: '1.2rem' }}
            title="Micrófono (próximamente)"
          >
            <i className="pi pi-microphone" />
          </button>
        </div>
      </div>
    </Sidebar>
  );
}