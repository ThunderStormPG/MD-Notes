import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import Notepad from './Notepad';

describe('Notepad Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders correctly and allows creating a new note', () => {
    render(<Notepad />);
    
    const newNoteBtn = screen.getByText('+ New Note');
    fireEvent.click(newNoteBtn);
    
    expect(screen.getByText('Untitled Note', { selector: 'span' })).toBeInTheDocument();
  });

  it('updates title when content changes', () => {
    render(<Notepad />);
    fireEvent.click(screen.getByText('+ New Note'));
    
    const textarea = screen.getByPlaceholderText('Start writing in Markdown...');
    fireEvent.change(textarea, { target: { value: '# Hello World' } });
    
    expect(screen.getByText('Hello World', { selector: 'span' })).toBeInTheDocument();
  });
});
