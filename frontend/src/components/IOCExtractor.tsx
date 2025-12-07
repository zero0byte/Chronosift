import React, { useState } from 'react';
import axios from '../lib/api';

interface IOCExtractorProps {
  projectId: number;
  timelineId?: number;
  entryIds?: number[];
  onExtractionComplete?: () => void;
}

interface ExtractedIOC {
  ioc_type: string;
  value: string;
  confidence: string;
  severity: string;
}

const IOCExtractor: React.FC<IOCExtractorProps> = ({
  projectId,
  timelineId,
  entryIds,
  onExtractionComplete
}) => {
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<{ extracted: ExtractedIOC[]; created: number } | null>(null);

  const handleExtract = async () => {
    setExtracting(true);
    setResult(null);
    
    try {
      const response = await axios.post(`/iocs/projects/${projectId}/iocs/extract`, {
        timeline_id: timelineId,
        entry_ids: entryIds,
        auto_create: true
      });
      
      setResult(response.data);
      
      if (onExtractionComplete) {
        onExtractionComplete();
      }
    } catch (error) {
      console.error('Failed to extract IOCs:', error);
      alert('Failed to extract IOCs');
    } finally {
      setExtracting(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return { backgroundColor: '#f8d7da', color: '#dc3545' };
      case 'high': return { backgroundColor: '#ffe5d0', color: '#fd7e14' };
      case 'medium': return { backgroundColor: '#fff3cd', color: '#ffc107' };
      default: return { backgroundColor: '#cff4fc', color: '#0dcaf0' };
    }
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        onClick={handleExtract}
        disabled={extracting}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '10px 20px',
          backgroundColor: extracting ? '#9333ea80' : '#9333ea',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: extracting ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          whiteSpace: 'nowrap'
        }}
      >
        {extracting ? (
          <>⏳ Extracting IOCs...</>
        ) : (
          <>🛡️ Extract IOCs</>
        )}
      </button>

      {result && (
        <div style={{
          marginTop: '15px',
          padding: '15px',
          backgroundColor: '#d1e7dd',
          border: '1px solid #badbcc',
          borderRadius: '4px'
        }}>
          <div style={{ fontWeight: '600', color: '#0f5132', marginBottom: '8px' }}>
            IOC Extraction Complete
          </div>
          <div style={{ fontSize: '14px', color: '#0f5132', marginBottom: '10px' }}>
            <div>Found {result.extracted.length} potential IOCs</div>
            <div>Created {result.created} new IOC{result.created !== 1 ? 's' : ''}</div>
          </div>
          
          {result.extracted.length > 0 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#495057', marginBottom: '8px' }}>
                Extracted IOCs:
              </div>
              <div style={{ 
                maxHeight: '200px', 
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                {result.extracted.map((ioc, idx) => (
                  <div 
                    key={idx} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      backgroundColor: '#fff',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #dee2e6'
                    }}
                  >
                    <span style={{
                      fontWeight: '600',
                      color: '#666',
                      textTransform: 'uppercase',
                      minWidth: '60px'
                    }}>
                      {ioc.ioc_type}
                    </span>
                    <span style={{
                      fontFamily: 'monospace',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {ioc.value}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '500',
                      ...getSeverityColor(ioc.severity)
                    }}>
                      {ioc.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IOCExtractor;
