import { formatShortcut, KeyboardShortcut } from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  shortcuts: KeyboardShortcut[];
  onClose: () => void;
}

export default function KeyboardShortcutsHelp({ shortcuts, onClose }: KeyboardShortcutsHelpProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>⌨️ Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            style={{
              padding: '4px 12px',
              fontSize: '18px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#666',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
              }}
            >
              <span style={{ fontSize: '14px', color: '#333' }}>{shortcut.description}</span>
              <kbd
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                {formatShortcut(shortcut)}
              </kbd>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
          Press <kbd style={{ padding: '2px 6px', backgroundColor: '#f0f0f0', borderRadius: '3px' }}>?</kbd> to show this help
        </div>
      </div>
    </div>
  );
}
