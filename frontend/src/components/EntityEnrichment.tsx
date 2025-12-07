import React, { useState } from 'react';
import { enrichmentAPI } from '../lib/api';

interface EnrichmentResult {
  provider: string;
  confidence: number;
  data: any;
  error?: string;
}

interface EntityEnrichmentProps {
  entryId: number;
  entryData: Record<string, any>;
  onClose: () => void;
}

const EntityEnrichment: React.FC<EntityEnrichmentProps> = ({ entryId, entryData, onClose }) => {
  const [extracting, setExtracting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [entities, setEntities] = useState<any>({});
  const [enrichmentResults, setEnrichmentResults] = useState<Record<string, any>>({});
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; value: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extract entities from entry text and store them
  const extractEntities = async () => {
    setExtracting(true);
    setError(null);
    try {
      const response = await enrichmentAPI.extractEntities(entryId);
      const extractedData = response.data.extracted || {};
      const createdEntities = response.data.created || [];
      
      // Store both extracted data and created entity IDs
      setEntities({
        ...extractedData,
        _entityIds: createdEntities.reduce((acc: any, entity: any) => {
          const key = `${entity.entity_type}:${entity.value}`;
          acc[key] = entity.id;
          return acc;
        }, {})
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to extract entities');
    } finally {
      setExtracting(false);
    }
  };

  // Enrich a specific entity value and save to database
  const enrichEntity = async (entityType: string, value: string) => {
    setEnriching(true);
    setError(null);
    setSelectedEntity({ type: entityType, value });
    
    try {
      // Check if we have a stored entity ID
      const entityKey = `${entityType}:${value}`;
      const entityId = entities._entityIds?.[entityKey];
      
      let response;
      if (entityId) {
        // Use stored enrichment endpoint (saves to database)
        response = await enrichmentAPI.enrichEntity(entityId);
      } else {
        // Fall back to temporary enrichment
        response = await enrichmentAPI.enrichValue({
          entity_type: entityType,
          value: value
        });
      }
      
      setEnrichmentResults(prev => ({
        ...prev,
        [entityKey]: response.data
      }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  const renderEnrichmentResult = (result: EnrichmentResult) => {
    if (result.error) {
      return (
        <div style={{ padding: '12px', backgroundColor: 'rgba(127, 29, 29, 0.2)', border: '1px solid #b91c1c', borderRadius: '4px', fontSize: '14px' }}>
          <div style={{ fontWeight: 600, color: '#fca5a5' }}>{result.provider}</div>
          <div style={{ color: '#fecaca', fontSize: '12px', marginTop: '4px' }}>{result.error}</div>
        </div>
      );
    }

    return (
      <div style={{ padding: '12px', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{result.provider}</div>
          <div style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: 'rgba(30, 58, 138, 0.3)', color: '#93c5fd', borderRadius: '4px' }}>
            Confidence: {(result.confidence * 100).toFixed(0)}%
          </div>
        </div>
        <pre style={{ fontSize: '12px', color: '#d1d5db', overflowX: 'auto', maxHeight: '192px', backgroundColor: '#111827', padding: '8px', borderRadius: '4px', margin: 0 }}>
          {JSON.stringify(result.data, null, 2)}
        </pre>
      </div>
    );
  };

  const entityTypes = Object.keys(entities).filter(key => entities[key]?.length > 0);
  const hasEntities = entityTypes.length > 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        borderRadius: '8px',
        maxWidth: '896px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #374151'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderBottom: '1px solid #374151' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#f3f4f6', margin: 0 }}>Entity Enrichment</h2>
          <button
            onClick={onClose}
            style={{ color: '#9ca3af', fontSize: '32px', border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {error && (
            <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: 'rgba(127, 29, 29, 0.2)', border: '1px solid #b91c1c', borderRadius: '8px', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {/* Extract Entities Section */}
          {!hasEntities && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ color: '#9ca3af', marginBottom: '16px' }}>
                Extract entities (IPs, domains, hashes, emails) from this timeline entry
              </p>
              <button
                onClick={extractEntities}
                disabled={extracting}
                style={{
                  padding: '12px 24px',
                  backgroundColor: extracting ? '#4b5563' : '#2563eb',
                  color: '#fff',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: extracting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  opacity: extracting ? 0.5 : 1
                }}
              >
                {extracting ? 'Extracting...' : '🔍 Extract Entities'}
              </button>
              <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'rgba(30, 58, 138, 0.2)', border: '1px solid #1e40af', borderRadius: '8px', textAlign: 'left' }}>
                <p style={{ color: '#93c5fd', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>What can be enriched?</p>
                <ul style={{ color: '#60a5fa', fontSize: '14px', listStyleType: 'disc', paddingLeft: '20px', margin: '8px 0' }}>
                  <li>IP addresses (e.g., 192.168.1.1, 8.8.8.8)</li>
                  <li>Domain names (e.g., google.com, malware-site.ru)</li>
                  <li>File hashes (MD5, SHA1, SHA256)</li>
                  <li>Email addresses</li>
                </ul>
                <p style={{ color: '#60a5fa', fontSize: '12px', marginTop: '8px' }}>
                  Tip: If no entities are found, try a different entry or search for entries containing network indicators.
                </p>
              </div>
            </div>
          )}

          {/* Entities List */}
          {hasEntities && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {entityTypes.map(entityType => (
                <div key={entityType} style={{ backgroundColor: '#111827', borderRadius: '8px', padding: '16px', border: '1px solid #374151' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#f3f4f6', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ padding: '4px 8px', backgroundColor: 'rgba(30, 58, 138, 0.3)', color: '#60a5fa', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>
                      {entityType}
                    </span>
                    <span style={{ fontSize: '14px', color: '#9ca3af' }}>
                      ({entities[entityType].length} found)
                    </span>
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {entities[entityType].map((value: string, idx: number) => {
                      const key = `${entityType}:${value}`;
                      const result = enrichmentResults[key];

                      return (
                        <div key={idx} style={{ backgroundColor: '#1f2937', borderRadius: '4px', padding: '12px', border: '1px solid #4b5563' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <code style={{ fontSize: '14px', color: '#34d399', fontFamily: 'monospace' }}>{value}</code>
                            {!result && (
                              <button
                                onClick={() => enrichEntity(entityType, value)}
                                disabled={enriching && selectedEntity?.value === value}
                                style={{
                                  padding: '4px 12px',
                                  backgroundColor: (enriching && selectedEntity?.value === value) ? '#6b21a8' : '#7c3aed',
                                  color: '#fff',
                                  fontSize: '14px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  cursor: (enriching && selectedEntity?.value === value) ? 'not-allowed' : 'pointer',
                                  opacity: (enriching && selectedEntity?.value === value) ? 0.5 : 1
                                }}
                              >
                                {enriching && selectedEntity?.value === value ? 'Enriching...' : '✨ Enrich'}
                              </button>
                            )}
                          </div>

                          {result && (
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
                                Overall Confidence: {(result.confidence * 100).toFixed(0)}%
                              </div>
                              {result.results?.map((r: EnrichmentResult, ridx: number) => (
                                <div key={ridx}>
                                  {renderEnrichmentResult(r)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '24px', borderTop: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '14px', color: '#9ca3af' }}>
            {hasEntities && `${entityTypes.reduce((sum, type) => sum + entities[type].length, 0)} entities detected`}
          </div>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', backgroundColor: '#374151', color: '#e5e7eb', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntityEnrichment;
