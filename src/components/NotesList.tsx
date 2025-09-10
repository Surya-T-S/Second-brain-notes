'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { getUserNotes, getUserNotebooks } from '@/lib/noteService';
import { Note, Notebook } from '@/types';

interface NotesListProps {
  onSelectNote?: (noteId: string) => void;
  selectedNoteId?: string;
}

export function NotesList({ onSelectNote, selectedNoteId }: NotesListProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserNotes();
    }
  }, [user]);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      try {
        const nbs = await getUserNotebooks(user.uid);
        setNotebooks(nbs);
      } catch (e) {
        console.error('Failed to load notebooks', e);
      }
    };
    run();
  }, [user]);

  // Scroll helpers and visibility state
  const updateScrollState = () => {
    const el = listRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 0);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  };

  const scrollByDelta = (delta: number) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollBy({ top: delta, behavior: 'smooth' });
    // Schedule a state update slightly after scroll begins
    setTimeout(updateScrollState, 180);
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    updateScrollState();
    const onScroll = () => updateScrollState();
    el.addEventListener('scroll', onScroll);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [notes]);

  const loadUserNotes = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const userNotes = await getUserNotes(user.uid);
      setNotes(userNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewNote = () => {
    const newNoteId = `note-${Date.now()}`;
    onSelectNote?.(newNoteId);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const stripHtml = (html: string): string => {
    // Create a temporary div element
    const tmp = document.createElement('div');
    // Set the HTML content
    tmp.innerHTML = html;
    // Return the text content without HTML tags
    return tmp.textContent || tmp.innerText || '';
  };

  const getPreview = (note: Note) => {
    const custom = (note.title || '').trim();
    if (custom) return custom;
    if (note.rootNodes.length === 0) return 'Empty note';
    const firstNode = note.rootNodes[0];
    const content = firstNode.content || '';
    // Strip HTML tags and trim the result
    return stripHtml(content).trim() || 'Untitled';
  };

  // All tags present in user's notes (for filter chips)
  const uniqueTags = useMemo<string[]>(() => {
    const set = new Set<string>();
    notes.forEach((n: Note) => (n.tags || []).forEach((t: string) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [notes]);

  // Notes filtered by selected notebook and selected tags
  const filteredNotes = useMemo<Note[]>(() => {
    return notes.filter((n: Note) => {
      const notebookOk = !selectedNotebookId || n.notebookId === selectedNotebookId;
      const tagsOk = selectedTags.length === 0 || selectedTags.every((t: string) => (n.tags || []).includes(t));
      return notebookOk && tagsOk;
    });
  }, [notes, selectedNotebookId, selectedTags]);

  // Group filtered notes by recency buckets similar to iPhone
  const groups = useMemo(() => {
    const buckets: { [key: string]: Note[] } = {};
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const msInDay = 24 * 60 * 60 * 1000;
    filteredNotes.forEach(n => {
      const updated = n.updatedAt instanceof Date ? n.updatedAt : new Date(n.updatedAt);
      const diffDays = Math.floor((startOfDay(now).getTime() - startOfDay(updated).getTime()) / msInDay);
      let key = 'Older';
      if (diffDays <= 0) key = 'Today';
      else if (diffDays === 1) key = 'Yesterday';
      else if (diffDays <= 7) key = 'Last 7 Days';
      else if (diffDays <= 30) key = 'Last 30 Days';
      (buckets[key] ||= []).push(n);
    });
    const order = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Older'];
    return order
      .filter(k => buckets[k]?.length)
      .map(k => ({ title: k, items: buckets[k].sort((a, b) => (b.updatedAt as any) - (a.updatedAt as any)) }));
  }, [filteredNotes]);

  return (
    <div className="w-80 h-full bg-white/70 dark:bg-gray-800/50 backdrop-blur-md border-r border-white/20 dark:border-white/10 flex flex-col min-h-0 shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-white/30 dark:border-white/10 bg-white/50 dark:bg-gray-900/20 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white ios-heading ios-animate-in">
            Notes
          </h2>
          <button
            onClick={createNewNote}
            className="px-3 py-1.5 text-white text-sm rounded-md transition-colors bg-blue-500/85 hover:bg-blue-500/95 border border-white/20 shadow-sm backdrop-blur-md inline-flex items-center gap-1.5"
            title="Create new note"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>New</span>
          </button>
        </div>
        {/* Filters */}
        <div className="space-y-2">
          {/* Notebook filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-300">Notebook</label>
            <select
              className="flex-1 px-2 py-1 rounded-md bg-white/60 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100"
              value={selectedNotebookId}
              onChange={(e) => setSelectedNotebookId(e.target.value)}
            >
              <option value="">All</option>
              {notebooks.map(nb => (
                <option key={nb.id} value={nb.id}>{nb.name}</option>
              ))}
            </select>
          </div>
          {/* Tags filter */}
          {uniqueTags.length > 0 && (
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Filter by tags</div>
              {/* Selected tags row with remove buttons */}
              {selectedTags.length > 0 && (
                <div className="mb-1 flex flex-wrap gap-1">
                  {selectedTags.map((t) => (
                    <span key={`sel-${t}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-blue-500 text-white border border-blue-500">
                      #{t}
                      <button type="button" className="ml-1 opacity-90 hover:opacity-100" onClick={() => setSelectedTags(prev => prev.filter(x => x !== t))}>×</button>
                    </span>
                  ))}
                  <button type="button" onClick={() => setSelectedTags([])} className="ml-1 px-2 py-0.5 rounded-md text-xs border bg-white/60 dark:bg-gray-900/30 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700">Clear</button>
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {uniqueTags.map((tag: string) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => {
                        setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
                      }}
                      className={`px-2 py-0.5 rounded-md text-xs border ${active ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/60 dark:bg-gray-900/30 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700'}`}
                      title={active ? 'Remove filter' : 'Filter by tag'}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notes List */}
      <div className="relative flex-1 min-h-0">
        {/* Scrollable list */}
        <div ref={listRef} className="h-full overflow-y-auto scroll-smooth overscroll-contain touch-pan-y">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            Loading notes...
          </div>
        ) : notes.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <p className="mb-2">No notes yet</p>
            <p className="text-sm">Create your first note to get started</p>
          </div>
        ) : (
          <div className="p-2">
            {groups.map(group => (
              <div key={group.title} className="mb-3">
                <div className="px-2 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {group.title}
                </div>
                {group.items.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => onSelectNote?.(note.id)}
                    className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors ${
                      selectedNoteId === note.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="font-medium text-gray-900 dark:text-white text-sm mb-1 truncate">
                        {getPreview(note)}
                      </div>
                      {/* Small meta row */}
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(note.updatedAt)}
                        </div>
                        <div className="flex items-center gap-1">
                          {(note.tags || []).slice(0, 3).map((t, idx) => (
                            <span key={`${note.id}-${t}-${idx}`} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px]">#{t}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {note.rootNodes.length} item{note.rootNodes.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Top gradient & Up button */}
        {canScrollUp && (
          <>
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-white/90 dark:from-gray-800/90 to-transparent z-10" />
            <button
              type="button"
              aria-label="Scroll up"
              title="Scroll up"
              onClick={() => scrollByDelta(-240)}
              className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center bg-white/70 dark:bg-gray-900/50 border border-white/30 dark:border-white/10 shadow-sm backdrop-blur-md text-gray-700 dark:text-gray-200 hover:bg-white/90 dark:hover:bg-gray-900/70"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
          </>
        )}

        {/* Bottom gradient & Down button */}
        {canScrollDown && (
          <>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white/90 dark:from-gray-800/90 to-transparent z-10" />
            <button
              type="button"
              aria-label="Scroll down"
              title="Scroll down"
              onClick={() => scrollByDelta(240)}
              className="absolute bottom-2 right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center bg-white/70 dark:bg-gray-900/50 border border-white/30 dark:border-white/10 shadow-sm backdrop-blur-md text-gray-700 dark:text-gray-200 hover:bg-white/90 dark:hover:bg-gray-900/70"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
