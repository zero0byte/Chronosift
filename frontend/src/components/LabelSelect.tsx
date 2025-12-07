import { useState, useRef, useEffect } from 'react';
import { LabelOption } from '../types';

interface LabelSelectProps {
  value: string | null;
  options: LabelOption[];
  onChange: (value: string | null) => void;
  allowClear?: boolean;
}

export default function LabelSelect({ value, options, onChange, allowClear = true }: LabelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '6px 10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          background: 'white',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}
      >
        {selectedOption ? (
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: '4px',
              backgroundColor: selectedOption.color,
              color: getContrastColor(selectedOption.color),
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            {selectedOption.label}
          </span>
        ) : (
          <span style={{ color: '#999' }}>Select label...</span>
        )}
        <span style={{ fontSize: '12px', color: '#666' }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            zIndex: 1000,
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          {allowClear && value && (
            <>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: '#999',
                  fontSize: '13px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                Clear selection
              </button>
              <div style={{ borderTop: '1px solid #eee' }} />
            </>
          )}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: value === option.value ? '#f0f0f0' : 'none',
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = value === option.value ? '#f0f0f0' : 'none';
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  backgroundColor: option.color,
                  color: getContrastColor(option.color),
                  fontSize: '13px',
                  fontWeight: '500'
                }}
              >
                {option.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper function to determine if text should be light or dark based on background color
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
