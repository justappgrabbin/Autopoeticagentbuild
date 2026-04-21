// src/components/LibraryPanel.jsx
import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export const LibraryPanel = ({ agent, onKnowledgeUpdate }) => {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [gaps, setGaps] = useState([]);
  const [library, setLibrary] = useState([]);
  const pasteRef = useRef(null);

  // Load existing library on mount
  React.useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    const res = await fetch('/api/library');
    const data = await res.json();
    setLibrary(data.items || []);
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    const newFiles = acceptedFiles.map(f => ({
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: f.name,
      size: f.size,
      type: f.type || inferType(f.name),
      status: 'pending',
      progress: 0,
      file: f
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/zip': ['.zip'],
      'application/gzip': ['.gz', '.tar.gz', '.tgz'],
      'text/plain': ['.txt', '.md', '.js', '.jsx', '.ts', '.tsx', '.py', '.json'],
      'application/msword': ['.doc', '.docx'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    }
  });

  const inferType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      pdf: 'application/pdf',
      zip: 'application/zip',
      gz: 'application/gzip',
      tar: 'application/x-tar',
      txt: 'text/plain',
      md: 'text/markdown',
      js: 'text/javascript',
      jsx: 'text/javascript',
      ts: 'text/typescript',
      tsx: 'text/typescript',
      py: 'text/python',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return map[ext] || 'application/octet-stream';
  };

  const handlePaste = async (e) => {
    const text = e.clipboardData.getData('text');
    if (!text.trim()) return;
    
    const pasteFile = {
      id: `paste_${Date.now()}`,
      name: `Pasted Snippet ${new Date().toLocaleTimeString()}`,
      size: text.length,
      type: 'text/pasted',
      status: 'pending',
      content: text,
      isPaste: true
    };
    
    setFiles(prev => [...prev, pasteFile]);
  };

  const processFile = async (fileObj) => {
    setProcessing(true);
    
    try {
      let response;
      
      if (fileObj.isPaste) {
        response = await fetch('/api/library/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'pasted_text',
            content: fileObj.content,
            filename: fileObj.name,
            dyadId: agent?.dyadId
          })
        });
      } else {
        const formData = new FormData();
        formData.append('file', fileObj.file);
        formData.append('dyadId', agent?.dyadId || 'unknown');
        
        response = await fetch('/api/library/upload', {
          method: 'POST',
          body: formData
        });
      }

      const result = await response.json();
      
      // Update file status
      setFiles(prev => prev.map(f => 
        f.id === fileObj.id 
          ? { ...f, status: 'complete', result, progress: 100 }
          : f
      ));

      // Show gap analysis
      if (result.gaps && result.gaps.length > 0) {
        setGaps(prev => [...prev, { file: fileObj.name, gaps: result.gaps }]);
      }

      // Notify agent of new knowledge
      if (agent && result.integrated) {
        await agent.teach(fileObj.name, result.summary);
        onKnowledgeUpdate?.();
      }

      await loadLibrary();
      
    } catch (err) {
      setFiles(prev => prev.map(f => 
        f.id === fileObj.id 
          ? { ...f, status: 'error', error: err.message }
          : f
      ));
    } finally {
      setProcessing(false);
    }
  };

  const processAll = async () => {
    const pending = files.filter(f => f.status === 'pending');
    for (const file of pending) {
      await processFile(file);
    }
  };

  const queryLibrary = async (query) => {
    const res = await fetch('/api/library/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, dyadId: agent?.dyadId, topK: 5 })
    });
    return res.json();
  };

  const applyGapFill = async (gapId, fileName) => {
    const res = await fetch('/api/library/apply-gap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gapId, fileName, dyadId: agent?.dyadId })
    });
    const result = await res.json();
    if (result.applied) {
      onKnowledgeUpdate?.();
      setGaps(prev => prev.filter(g => g.gaps.every(gap => gap.id !== gapId)));
    }
  };

  return (
    <div className="library-panel">
      <h2>Resonance Library</h2>
      <p className="subtitle">
        Upload your magic notebook. The agent will analyze gaps, extract codon mappings, 
        and integrate into the CHNOPS engine.
      </p>

      {/* Paste Area */}
      <div 
        className="paste-zone"
        onPaste={handlePaste}
        tabIndex={0}
        ref={pasteRef}
      >
        <p>Click here and paste text directly (Ctrl+V)</p>
        <small>Code, notes, PDF excerpts, anything</small>
      </div>

      {/* Drop Zone */}
      <div {...getRootProps()} className={`drop-zone ${isDragActive ? 'active' : ''}`}>
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the files here...</p>
        ) : (
          <p>Drag & drop files here, or click to select</p>
        )}
        <small>Supports: PDF, DOCX, ZIP, TAR.GZ, JS/TS/PY/JSON, TXT, MD</small>
      </div>

      {/* File Queue */}
      {files.length > 0 && (
        <div className="file-queue">
          <h3>Ingestion Queue</h3>
          {files.map(file => (
            <div key={file.id} className={`file-item ${file.status}`}>
              <span className="file-name">{file.name}</span>
              <span className="file-type">{file.type}</span>
              <span className="file-status">{file.status}</span>
              {file.status === 'pending' && (
                <button onClick={() => processFile(file)} disabled={processing}>
                  Process
                </button>
              )}
              {file.result?.chunks && (
                <span className="chunks">{file.result.chunks} chunks extracted</span>
              )}
            </div>
          ))}
          <button onClick={processAll} disabled={processing} className="process-all">
            {processing ? 'Processing...' : 'Process All Pending'}
          </button>
        </div>
      )}

      {/* Gap Analysis */}
      {gaps.length > 0 && (
        <div className="gap-analysis">
          <h3>Knowledge Gaps Detected</h3>
          {gaps.map((entry, idx) => (
            <div key={idx} className="gap-group">
              <h4>From: {entry.file}</h4>
              {entry.gaps.map(gap => (
                <div key={gap.id} className="gap-card">
                  <div className="gap-type">{gap.type}</div>
                  <div className="gap-desc">{gap.description}</div>
                  <div className="gap-confidence">
                    Confidence: {(gap.confidence * 100).toFixed(0)}%
                  </div>
                  {gap.missingCodons && (
                    <div className="missing-codons">
                      Missing codons: {gap.missingCodons.join(', ')}
                    </div>
                  )}
                  <button onClick={() => applyGapFill(gap.id, entry.file)}>
                    Apply to Agent
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Library Browser */}
      {library.length > 0 && (
        <div className="library-browser">
          <h3>Knowledge Base ({library.length} sources)</h3>
          <div className="search-box">
            <input 
              type="text" 
              placeholder="Query your library..."
              onKeyPress={async (e) => {
                if (e.key === 'Enter') {
                  const results = await queryLibrary(e.target.value);
                  console.log('Query results:', results);
                }
              }}
            />
          </div>
          <div className="library-grid">
            {library.map(item => (
              <div key={item.id} className="library-card">
                <div className="card-header">
                  <span className="card-type">{item.type}</span>
                  <span className="card-date">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h4>{item.filename}</h4>
                <div className="card-meta">
                  <span>{item.chunkCount} chunks</span>
                  <span>{item.codonTags?.length || 0} codon tags</span>
                </div>
                <div className="chnops-signature">
                  {item.chnopsSignature && Object.entries(item.chnopsSignature)
                    .filter(([_, v]) => v > 0)
                    .map(([el, val]) => (
                      <span key={el} className={`atom ${el}`}>
                        {el}:{val.toFixed(1)}
                      </span>
                    ))
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
