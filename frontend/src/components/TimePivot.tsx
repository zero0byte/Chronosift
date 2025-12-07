import { useState } from 'react';
import { TimelineEntry } from '../types';

interface TimePivotProps {
  selectedEntry: TimelineEntry;
  timestampColumn: string;
  onPivot: (windowMinutes: number) => void;
  onProjectWidePivot: (windowMinutes: number) => void;
  onClose: () => void;
}

export default function TimePivot({ selectedEntry, timestampColumn, onPivot, onProjectWidePivot, onClose }: TimePivotProps) {
  const [windowMinutes, setWindowMinutes] = useState(15);
  const [customWindow, setCustomWindow] = useState('');

  const timestamp = selectedEntry.data[timestampColumn];
  const timeOptions = [
    { label: '5 minutes', value: 5 },
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '2 hours', value: 120 },
    { label: '6 hours', value: 360 },
    { label: '12 hours', value: 720 },
    { label: '24 hours', value: 1440 },
    { label: 'Custom', value: -1 }
  ];

  const handleApply = (isProjectWide: boolean) => {
    const minutes = windowMinutes === -1 ? parseInt(customWindow) : windowMinutes;
    if (isNaN(minutes) || minutes <= 0) {
      alert('Please enter a valid time window');
      return;
    }
    if (isProjectWide) {
      onProjectWidePivot(minutes);
    } else {
      onPivot(minutes);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '30px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>⏱️ Time Pivot</h2>
        
        <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f0f8ff', borderRadius: '4px', border: '1px solid #0066cc' }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Selected Event Time:</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#0066cc', fontFamily: 'monospace' }}>
            {timestamp || 'No timestamp'}
          </div>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>
            Select Time Window:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {timeOptions.map(option => (
              <label
                key={option.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px',
                  border: windowMinutes === option.value ? '2px solid #0066cc' : '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: windowMinutes === option.value ? '#f0f8ff' : '#fff',
                  transition: 'all 0.2s'
                }}
              >
                <input
                  type="radio"
                  name="timeWindow"
                  value={option.value}
                  checked={windowMinutes === option.value}
                  onChange={() => setWindowMinutes(option.value)}
                  style={{ marginRight: '10px' }}
                />
                <span style={{ fontWeight: windowMinutes === option.value ? 'bold' : 'normal' }}>
                  {option.label} {option.value > 0 && `(±${option.value} min)`}
                </span>
              </label>
            ))}
          </div>
          
          {windowMinutes === -1 && (
            <div style={{ marginTop: '10px' }}>
              <input
                type="number"
                value={customWindow}
                onChange={(e) => setCustomWindow(e.target.value)}
                placeholder="Enter minutes"
                min="1"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
          )}
        </div>

        <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#fff9e6', borderRadius: '4px', border: '1px solid #ffc107' }}>
          <div style={{ fontSize: '13px', color: '#856404' }}>
            <strong>📍 Timeline Pivot:</strong> Shows events ±{windowMinutes === -1 ? customWindow || '?' : windowMinutes} minutes around this event in the current timeline.
          </div>
          <div style={{ fontSize: '13px', color: '#856404', marginTop: '8px' }}>
            <strong>🌐 Project-Wide Pivot:</strong> Searches ALL timelines in this project for events in the same time window.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleApply(false)}
            style={{
              flex: 1,
              padding: '12px 20px',
              backgroundColor: '#0066cc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0052a3'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0066cc'}
          >
            📍 Pivot Timeline
          </button>
          <button
            onClick={() => handleApply(true)}
            style={{
              flex: 1,
              padding: '12px 20px',
              backgroundColor: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#218838'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
          >
            🌐 Pivot Project
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '12px 20px',
              backgroundColor: '#6c757d',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
