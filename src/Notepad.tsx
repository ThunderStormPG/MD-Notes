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
}

const STORAGE_KEY = 'local_first_notepad_data';

export default function Notepad() {
  // 1. Core State Structure with Lazy Initialization
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // 3. Autosave logic
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  // Derived active note
  const activeNote = useMemo(() => notes.find((n) => n.id === activeNoteId) || null, [notes, activeNoteId]);

  // Auto-Titling Logic
  const generateTitle = (content: string): string => {
    if (!content.trim()) return 'Untitled Note';
    const firstLine = content.split('\n')[0].replace(/^#+\s*/, '');
    return firstLine.slice(0, 24);
  };

  const handleNewNote = useCallback(() => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      content: '',
      updatedAt: Date.now(),
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

  // Secure Rendering Logic
  const renderedHTML = useMemo(() => {
    if (!activeNote) return '';
    const rawHTML = marked.parse(activeNote.content);
    return DOMPurify.sanitize(rawHTML as string);
  }, [activeNote]);

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={handleNewNote}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition"
          >
            + New Note
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {notes.map((note) => (
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
            <header className="h-14 border-b border-gray-200 flex items-center justify-between px-6 bg-white">
              <h2 className="font-semibold text-gray-800 truncate">{activeNote.title}</h2>
              <button
                onClick={(e) => handleDeleteNote(activeNote.id, e)}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Delete
              </button>
            </header>
            
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
              <textarea
                value={activeNote.content}
                onChange={(e) => handleUpdateNote(e.target.value)}
                className="w-full h-full p-6 outline-none resize-none border-r border-gray-200 font-mono text-sm leading-relaxed"
                placeholder="Start writing in Markdown..."
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
