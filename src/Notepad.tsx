import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Note structure definition
 */
interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  type: 'markdown' | 'simple';
}

const STORAGE_KEY = 'local_first_notepad_data';

export default function Notepad() {
  // 1. Core State Structure with Lazy Initialization
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  // 3. Autosave logic
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  // Derived active note
  const activeNote = useMemo(() => notes.find((n) => n.id === activeNoteId) || null, [notes, activeNoteId]);

  // Filter and Sort notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => note.title.toLowerCase().includes(searchQuery.toLowerCase()) || note.content.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, searchQuery]);

  // Auto-Titling Logic
  const generateTitle = (content: string): string => {
    if (!content.trim()) return 'Untitled Note';
    const firstLine = content.split('\n')[0].replace(/^#+\s*/, '');
    return firstLine.slice(0, 24);
  };

  const handleNewNote = useCallback((type: 'markdown' | 'simple') => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      content: '',
      updatedAt: Date.now(),
      type,
    };
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
  }, []);

  const handleUpdateNote = useCallback((content: string) => {
    if (!activeNoteId) return;
    setNotes((prev) =>
      prev.map((note) =>
        note.id === activeNoteId
          ? {
              ...note,
              content,
              title: generateTitle(content),
              updatedAt: Date.now(),
            }
          : note
      )
    );
  }, [activeNoteId]);

  const handleDeleteNote = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNoteId === id) setActiveNoteId(null);
  }, [activeNoteId]);

  const handleExportNote = useCallback(() => {
    if (!activeNote) return;
    const blob = new Blob([activeNote.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeNote]);

  const insertFormatting = (prefix: string, suffix: string = '') => {
    if (!activeNote) return;
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = activeNote.content;
    const selection = text.substring(start, end);
    const newContent = text.substring(0, start) + prefix + selection + suffix + text.substring(end);
    handleUpdateNote(newContent);
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  // Secure Rendering Logic
  const renderedHTML = useMemo(() => {
    if (!activeNote) return '';
    if (activeNote.type === 'simple') {
        return DOMPurify.sanitize(`<div style="text-align: center;">${activeNote.content.replace(/\n/g, '<br/>')}</div>`);
    }
    const rawHTML = marked.parse(activeNote.content);
    return DOMPurify.sanitize(rawHTML as string);
  }, [activeNote]);

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 space-y-2">
          <button
            onClick={() => handleNewNote('markdown')}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition"
          >
            + New MD Note
          </button>
          <button
            onClick={() => handleNewNote('simple')}
            className="w-full py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium text-sm transition"
          >
            + New Simple Note
          </button>
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              onClick={() => setActiveNoteId(note.id)}
              className={`group p-3 rounded-md cursor-pointer flex justify-between items-center transition ${
                activeNoteId === note.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              <span className="truncate text-sm font-medium">{note.title}</span>
              <button
                onClick={(e) => handleDeleteNote(note.id, e)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col h-full bg-white">
        {activeNote ? (
          <>
            {/* Workspace Header */}
            <header className="border-b border-gray-200 p-4 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 truncate">{activeNote.title} <span className="text-xs text-gray-400">({activeNote.type})</span></h2>
                <div className="flex items-center gap-2">
                  <button onClick={handleExportNote} className="text-sm text-gray-600 hover:text-blue-600">Export</button>
                  <button
                    onClick={(e) => handleDeleteNote(activeNote.id, e)}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Last updated: {new Date(activeNote.updatedAt).toLocaleString()}</span>
                <div className="flex gap-2">
                  <button onClick={() => insertFormatting('**', '**')} className="hover:text-blue-600 font-bold">B</button>
                  <button onClick={() => insertFormatting('*', '*')} className="hover:text-blue-600 italic">I</button>
                  <button onClick={() => insertFormatting('## ')} className="hover:text-blue-600">H2</button>
                  <button onClick={() => insertFormatting('[', '](url)')} className="hover:text-blue-600">Link</button>
                  <button onClick={() => insertFormatting('<center>', '</center>')} className="hover:text-blue-600">Center</button>
                </div>
              </div>
            </header>
            
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
              <textarea
                value={activeNote.content}
                onChange={(e) => handleUpdateNote(e.target.value)}
                className="w-full h-full p-6 outline-none resize-none border-r border-gray-200 font-mono text-sm leading-relaxed"
                placeholder={activeNote.type === 'markdown' ? "Start writing in Markdown..." : "Start writing a simple note..."}
              />
              <div
                className="prose prose-sm max-w-none p-6 overflow-y-auto bg-gray-50"
                dangerouslySetInnerHTML={{ __html: renderedHTML }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Select or create a note to begin
          </div>
        )}
      </main>
    </div>
  );
}
