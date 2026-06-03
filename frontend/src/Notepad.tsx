import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface Note {
  id: string;
  title: string;
  contentMarkdown: string;
  updatedAt: number;
}

// --- GRAPH MODAL COMPONENT ---
function GraphModal({ notes, onClose, onNodeClick }: { notes: Note[], onClose: () => void, onNodeClick: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    let graphInstance: any = null;
    
    const initGraph = async () => {
      // Generate graph data client-side
      const nodes = notes.map(n => ({ id: n.id, name: n.title }));
      const links: any[] = [];
      const titleToId = new Map(notes.map(n => [n.title.toLowerCase(), n.id]));
      
      notes.forEach(note => {
        const content = note.contentMarkdown || '';
        const matches = [...content.matchAll(/\[\[(.*?)\]\]/g)];
        matches.forEach(match => {
          const targetTitle = match[1].toLowerCase();
          const targetId = titleToId.get(targetTitle);
          if (targetId && targetId !== note.id) {
            links.push({ source: note.id, target: targetId });
          }
        });
      });

      const data = { nodes, links };
      
      // Load force-graph script if not present
      if (!(window as any).ForceGraph) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/force-graph';
        script.onload = () => renderGraph(data);
        document.head.appendChild(script);
      } else {
        renderGraph(data);
      }
    };
    
    const renderGraph = (data: any) => {
      if (!containerRef.current || !(window as any).ForceGraph) return;
      graphInstance = (window as any).ForceGraph()(containerRef.current)
        .graphData(data)
        .nodeLabel('name')
        .nodeAutoColorBy('id')
        .onNodeClick((node: any) => onNodeClick(node.id))
        .linkDirectionalParticles(2)
        .linkDirectionalParticleSpeed(0.01)
        .backgroundColor('#0f1115')
        .width(window.innerWidth - 100)
        .height(window.innerHeight - 100);
    };

    initGraph();

    return () => {
      if (graphInstance) {
        graphInstance._destructor();
      }
    };
  }, [notes]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div 
        className="glass-panel animate-fade-in" 
        style={{ padding: '20px', borderRadius: '16px', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ color: 'var(--text-light)', margin: 0 }}>Knowledge Graph</h2>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div ref={containerRef} style={{ borderRadius: '8px', overflow: 'hidden' }}></div>
      </div>
    </div>
  );
}

export default function Notepad() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  
  const [splitMode, setSplitMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showGraph, setShowGraph] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('km_notes_local');
    if (saved) {
      const parsed = JSON.parse(saved);
      setNotes(parsed);
      if (parsed.length > 0) setActiveNoteId(parsed[0].id);
    } else {
      const initialNote = {
        id: crypto.randomUUID(),
        title: 'Welcome to Knowledge Vault',
        contentMarkdown: '# Getting Started\n\nWelcome to your new local-first second brain. Start typing on the left, or toggle preview modes above. Your data stays securely in your browser.\n\nTry making a link by typing `[[Welcome to Knowledge Vault]]` and open the Graph View!',
        updatedAt: Date.now()
      };
      setNotes([initialNote]);
      setActiveNoteId(initialNote.id);
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem('km_notes_local', JSON.stringify(notes));
    }
  }, [notes]);

  // Keyboard Shortcuts (Cmd+K for search, Escape for Zen Mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      if (e.key === 'Escape') {
        if (showSearch) setShowSearch(false);
        if (zenMode) setZenMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, zenMode]);

  // Focus Search Input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchQuery('');
    }
  }, [showSearch]);

  const activeNote = notes.find(n => n.id === activeNoteId);

  const updateActiveNote = (updates: Partial<Note>) => {
    if (!activeNoteId) return;
    setNotes(notes.map(n => 
      n.id === activeNoteId 
        ? { ...n, ...updates, updatedAt: Date.now() } 
        : n
    ));
  };

  const createNewNote = () => {
    const newNote = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      contentMarkdown: '',
      updatedAt: Date.now()
    };
    setNotes([newNote, ...notes]);
    setActiveNoteId(newNote.id);
  };

  // File Upload via Drag & Drop (Base64)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    
    const file = e.dataTransfer.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Only images are supported.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (!base64) return;
      
      const imageMarkdown = `\n![${file.name}](${base64})\n`;
      
      // Insert at cursor position if possible
      if (textareaRef.current) {
        const { selectionStart, selectionEnd } = textareaRef.current;
        const currentContent = activeNote?.contentMarkdown || '';
        const newContent = currentContent.substring(0, selectionStart) + imageMarkdown + currentContent.substring(selectionEnd);
        updateActiveNote({ contentMarkdown: newContent });
      } else {
        updateActiveNote({ contentMarkdown: (activeNote?.contentMarkdown || '') + imageMarkdown });
      }
    };
    reader.readAsDataURL(file);
  };

  const renderMarkdown = (content: string) => {
    const rawMarkup = marked.parse(content || '', { async: false }) as string;
    return { __html: DOMPurify.sanitize(rawMarkup) };
  };

  const exportMarkdown = () => {
    if (!activeNote) return;
    const blob = new Blob([activeNote.contentMarkdown || ''], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title || 'Untitled'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => {
    window.print();
  };

  // Fuzzy match logic
  const filteredNotes = notes.filter(n => {
    const term = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(term) || (n.contentMarkdown || '').toLowerCase().includes(term);
  });

  return (
    <div className="app-container">
      {/* Command Palette Overlay */}
      {showSearch && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          zIndex: 100, display: 'flex', justifyContent: 'center', paddingTop: '100px'
        }} onClick={() => setShowSearch(false)}>
          <div 
            className="glass-panel animate-fade-in" 
            style={{ width: '600px', maxHeight: '400px', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search notes... (Cmd+K to close)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '20px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-main)', fontSize: '1.2rem', outline: 'none' }}
            />
            <div style={{ overflowY: 'auto', padding: '10px' }}>
              {filteredNotes.map(note => (
                <div 
                  key={note.id} 
                  className="nav-item" 
                  style={{ padding: '12px', marginBottom: '4px' }}
                  onClick={() => { setActiveNoteId(note.id); setShowSearch(false); }}
                >
                  <div style={{ color: 'var(--text-light)', fontWeight: 600 }}>{note.title || 'Untitled Note'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {note.contentMarkdown?.substring(0, 80) || 'Empty note'}
                  </div>
                </div>
              ))}
              {filteredNotes.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No notes found matching "{searchQuery}"</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      {!zenMode && isSidebarOpen && (
        <aside className="sidebar animate-fade-in">
          <div className="sidebar-header" style={{ justifyContent: 'flex-start' }}>
            <div style={{ width: 24, height: 24, background: 'var(--accent-primary)', borderRadius: 6 }}></div>
            <span className="sidebar-title">Local Vault</span>
          </div>
          <div className="sidebar-content">
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: 16, justifyContent: 'center' }} onClick={createNewNote}>
              + New Note
            </button>
            <button className="btn" style={{ width: '100%', marginBottom: 16, justifyContent: 'center' }} onClick={() => setShowSearch(true)}>
              🔍 Search (Cmd+K)
            </button>
            <button className="btn" style={{ width: '100%', marginBottom: 16, justifyContent: 'center' }} onClick={() => setShowGraph(true)}>
              🌌 Graph View
            </button>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Your Notes
            </div>
            {notes.map(note => (
              <div 
                key={note.id}
                className={`nav-item ${note.id === activeNoteId ? 'active' : ''}`}
                onClick={() => setActiveNoteId(note.id)}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {note.title || 'Untitled Note'}
                </span>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Graph View Modal */}
      {showGraph && (
        <GraphModal 
          notes={notes}
          onClose={() => setShowGraph(false)} 
          onNodeClick={(id) => {
            setActiveNoteId(id);
            setShowGraph(false);
          }}
        />
      )}

      {/* Main Workspace */}
      <main className="main-workspace">
        {!zenMode && (
          <header className="workspace-header">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button className="btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                ☰
              </button>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span>{activeNote?.title || 'No note selected'}</span>
              </div>
            </div>
            <div className="editor-toolbar">
              <button className="btn" onClick={exportMarkdown} title="Export Markdown">⬇️ MD</button>
              <button className="btn" onClick={printPdf} title="Print to PDF">🖨️ PDF</button>
              <button className="btn" onClick={() => setZenMode(true)} title="Zen Mode (Press Esc to exit)">🧘 Zen</button>
              <div style={{ width: '1px', background: 'var(--border-subtle)', margin: '0 8px' }}></div>
              <button 
                className={`btn ${!splitMode && !previewMode ? 'active' : ''}`}
                onClick={() => { setSplitMode(false); setPreviewMode(false); }}
              >
                Raw
              </button>
              <button 
                className={`btn ${splitMode ? 'active' : ''}`}
                onClick={() => { setSplitMode(true); setPreviewMode(false); }}
              >
                Split View
              </button>
              <button 
                className={`btn ${previewMode ? 'active' : ''}`}
                onClick={() => { setSplitMode(false); setPreviewMode(true); }}
              >
                Preview
              </button>
            </div>
          </header>
        )}

        {activeNote ? (
          <div className="editor-container animate-fade-in">
            {/* Editor Pane */}
            {(!previewMode || splitMode) && (
              <div className={`editor-pane ${splitMode ? 'editor-split' : ''}`}
                   onDragOver={e => e.preventDefault()}
                   onDrop={handleDrop}>
                <input 
                  type="text" 
                  className="title-input"
                  placeholder="Note Title"
                  value={activeNote.title}
                  onChange={e => updateActiveNote({ title: e.target.value })}
                />
                <textarea
                  ref={textareaRef}
                  className="markdown-input"
                  placeholder="Start typing in Markdown... (Drag & Drop images here)"
                  value={activeNote.contentMarkdown || ''}
                  onChange={e => updateActiveNote({ contentMarkdown: e.target.value })}
                />
              </div>
            )}

            {/* Preview Pane */}
            {(previewMode || splitMode) && (
              <div className="preview-pane">
                {!splitMode && <h1 style={{marginTop: 0}}>{activeNote.title}</h1>}
                <div 
                  dangerouslySetInnerHTML={renderMarkdown(activeNote.contentMarkdown)} 
                />
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Select or create a note to begin
          </div>
        )}
      </main>
    </div>
  );
}
