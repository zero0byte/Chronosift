import { useState, useEffect, useCallback } from 'react';
import { uploadAPI, transformAPI } from '../lib/api';

interface FileUploaderProps {
  timelineId: number;
  onComplete: () => void;
}

export default function FileUploader({ timelineId, onComplete }: FileUploaderProps) {
  const [expanded, setExpanded] = useState(false);
  const [transforms, setTransforms] = useState<any[]>([]);
  const [selectedTransform, setSelectedTransform] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    loadTransforms();
  }, []);

  useEffect(() => {
    if (taskId) {
      const interval = setInterval(checkStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [taskId]);

  const loadTransforms = async () => {
    try {
      const res = await transformAPI.list();
      setTransforms(res.data.transforms);
    } catch (error) {
      console.error('Failed to load transforms:', error);
    }
  };

  const checkStatus = async () => {
    if (!taskId) return;
    
    try {
      const res = await uploadAPI.status(taskId);
      setStatus(res.data);
      
      if (res.data.state === 'SUCCESS' || res.data.state === 'FAILURE') {
        setTaskId(null);
        setUploading(false);
        if (res.data.state === 'SUCCESS') {
          onComplete();
        }
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedTransform) {
      alert('Please select both a file and a transform');
      return;
    }

    setUploading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('timeline_id', timelineId.toString());
    formData.append('transform_id', selectedTransform.toString());

    try {
      const res = await uploadAPI.uploadFile(formData);
      setTaskId(res.data.task_id);
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error.response?.data?.error || error.message}`);
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setSelectedTransform(null);
    setTaskId(null);
    setStatus(null);
    setUploading(false);
  };

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '20px' }}>
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          padding: '15px', 
          cursor: 'pointer', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: expanded ? '1px solid #ddd' : 'none'
        }}
      >
        <h3 style={{ margin: 0 }}>Upload File</h3>
        <span style={{ fontSize: '20px' }}>{expanded ? '▼' : '▶'}</span>
      </div>
      
      {expanded && (
        <div style={{ padding: '20px' }}>

      {!uploading && !status && (
        <>
          {/* Transform Selection */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Select Transform *
            </label>
            <select
              value={selectedTransform || ''}
              onChange={(e) => setSelectedTransform(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            >
              <option value="">-- Choose a transform --</option>
              {transforms.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.input_format.toUpperCase()})
                </option>
              ))}
            </select>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Transforms define how to parse your file into timeline entries
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? '#007bff' : '#ccc'}`,
              borderRadius: '4px',
              padding: '40px',
              textAlign: 'center',
              backgroundColor: isDragging ? '#f0f8ff' : '#fafafa',
              cursor: 'pointer',
              marginBottom: '15px',
              transition: 'all 0.2s'
            }}
          >
            {file ? (
              <div>
                <div style={{ fontSize: '18px', marginBottom: '10px' }}>📄</div>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{file.name}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {(file.size / 1024).toFixed(2)} KB
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  style={{ marginTop: '10px', padding: '4px 12px', fontSize: '12px', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>📁</div>
                <div style={{ marginBottom: '10px', color: '#666' }}>
                  Drag and drop your file here
                </div>
                <div style={{ marginBottom: '15px', fontSize: '14px', color: '#999' }}>or</div>
                <label style={{ padding: '8px 16px', backgroundColor: '#007bff', color: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'inline-block' }}>
                  Browse Files
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    accept=".csv,.json,.xml,.txt"
                    style={{ display: 'none' }}
                  />
                </label>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>
                  Supported: CSV, JSON, XML
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || !selectedTransform}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: file && selectedTransform ? '#28a745' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: file && selectedTransform ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            Upload and Process
          </button>
        </>
      )}

      {uploading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
            Processing...
          </div>
          {status && (
            <>
              <div style={{ color: '#666', marginBottom: '10px' }}>
                {status.status}
              </div>
              {status.progress !== undefined && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ width: '100%', backgroundColor: '#e0e0e0', borderRadius: '4px', height: '8px' }}>
                    <div style={{ width: `${status.progress}%`, backgroundColor: '#28a745', height: '100%', borderRadius: '4px', transition: 'width 0.3s' }}></div>
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                    {status.progress}%
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {status && status.state === 'SUCCESS' && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>✅</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#28a745' }}>
            Upload Complete!
          </div>
          <div style={{ color: '#666', marginBottom: '15px' }}>
            Created {status.result.created_count} entries
            {status.result.error_count > 0 && ` (${status.result.error_count} errors)`}
          </div>
          <button
            onClick={resetUpload}
            style={{ padding: '8px 16px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Upload Another File
          </button>
        </div>
      )}

      {status && status.state === 'FAILURE' && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>❌</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#dc3545' }}>
            Upload Failed
          </div>
          <div style={{ color: '#666', marginBottom: '15px' }}>
            {status.error}
          </div>
          <button
            onClick={resetUpload}
            style={{ padding: '8px 16px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      )}
        </div>
      )}
    </div>
  );
}
