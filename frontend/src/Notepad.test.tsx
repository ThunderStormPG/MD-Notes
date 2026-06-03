import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import Notepad from './Notepad';

describe('Notepad Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders correctly and allows creating a new note', () => {
    render(<Notepad />);
    
    const newNoteBtn = screen.getByText('+ New MD Note');
    fireEvent.click(newNoteBtn);
    
    expect(screen.getByText('Untitled Note', { selector: 'span' })).toBeInTheDocument();
  });

  it('updates title when content changes', () => {
    render(<Notepad />);
    fireEvent.click(screen.getByText('+ New MD Note'));
    
    const textarea = screen.getByPlaceholderText('Start writing in Markdown...');
    fireEvent.change(textarea, { target: { value: '# Hello World' } });
    
    expect(screen.getByText('Hello World', { selector: 'span' })).toBeInTheDocument();
  });

  it('filters notes based on search query', () => {
    render(<Notepad />);
    // Create Note A
    fireEvent.click(screen.getByText('+ New MD Note'));
    fireEvent.change(screen.getByPlaceholderText('Start writing in Markdown...'), { target: { value: 'Note A' } });
    
    // Create Note B
    fireEvent.click(screen.getByText('+ New MD Note'));
    fireEvent.change(screen.getByPlaceholderText('Start writing in Markdown...'), { target: { value: 'Note B' } });
    
    const searchInput = screen.getByPlaceholderText('Search notes...');
    fireEvent.change(searchInput, { target: { value: 'Note A' } });
    
    // Search for the note in the sidebar (using span selector)
    expect(screen.getByText('Note A', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText('Note B', { selector: 'span' })).not.toBeInTheDocument();
  });

  it('sorts notes by update time (newest first)', () => {
    render(<Notepad />);
    
    // Create first note
    fireEvent.click(screen.getByText('+ New MD Note'));
    fireEvent.change(screen.getByPlaceholderText('Start writing in Markdown...'), { target: { value: 'Note 1' } });
    
    // Create second note
    fireEvent.click(screen.getByText('+ New MD Note'));
    fireEvent.change(screen.getByPlaceholderText('Start writing in Markdown...'), { target: { value: 'Note 2' } });
    
    const notes = screen.getAllByText(/Note [1-2]/);
    expect(notes[0]).toHaveTextContent('Note 2'); // Latest one
    expect(notes[1]).toHaveTextContent('Note 1'); // Oldest
  });
});
