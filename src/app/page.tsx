'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider } from '@/components/AuthProvider'

// Lazy-load heavy client components to reduce initial bundle
const NotesEditor = dynamic(() => import('@/components/NotesEditor').then(m => ({ default: m.NotesEditor })), { ssr: false });
const AISidebar = dynamic(() => import('@/components/AISidebar').then(m => ({ default: m.AISidebar })), { ssr: false });
const NotesList = dynamic(() => import('@/components/NotesList').then(m => ({ default: m.NotesList })), { ssr: false });

export default function Home() {
  const [selectedNoteId, setSelectedNoteId] = useState<string>('default');
  const [notesListKey, setNotesListKey] = useState(0);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // On small screens hide sidebars by default
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      if (w < 768) {
        setShowLeft(false);
        setShowRight(false);
      }
    }
  }, []);

  // Adjust layout on resize: keep editor space primary on small screens
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const mobile = w < 768;
      setIsMobile(mobile);
      if (mobile) {
        // Auto-close drawers to prioritize typing space
        setShowLeft(false);
        setShowRight(false);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleNoteSelect = (noteId: string) => {
    setSelectedNoteId(noteId);
    if (isMobile) setShowLeft(false);
  };

  const handleNoteChange = () => {
    // Refresh the notes list when a note is updated
    setNotesListKey(prev => prev + 1);
  };

  return (
    <AuthProvider>
      <main className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        {/* Left sidebar wrapper with smooth animation */}
        <div className={
          isMobile
            ? `fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out ${showLeft ? 'translate-x-0' : '-translate-x-full'} w-80`
            : `transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 min-h-0 h-full ${showLeft ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`
        }>
          {showLeft && (
            <NotesList 
              key={notesListKey}
              onSelectNote={handleNoteSelect}
              selectedNoteId={selectedNoteId}
            />
          )}
        </div>

        {/* Center content */}
        <div
          className="flex-1 flex flex-col min-w-0 min-h-0"
          onClick={() => {
            if (isMobile && (showLeft || showRight)) {
              setShowLeft(false);
              setShowRight(false);
            }
          }}
        >
          <header className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md shadow-sm border-b border-gray-200/70 dark:border-gray-700/60 px-4 md:px-6 py-3 md:py-4 flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white ios-heading ios-animate-in">
                Second Brain Notes
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLeft(v => !v)}
                  className="px-2.5 py-1.5 rounded-lg border border-white/20 dark:border-white/10 bg-white/30 dark:bg-white/10 backdrop-blur-md text-gray-700 dark:text-gray-200 hover:bg-white/45 dark:hover:bg-white/20 transition-colors"
                  title={showLeft ? 'Hide Notes' : 'Show Notes'}
                  aria-pressed={!showLeft}
                >
                  {/* Left sidebar icon */}
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2" ry="2"/>
                    <line x1="8" y1="4" x2="8" y2="20"/>
                  </svg>
                </button>
                <button
                  onClick={() => setShowRight(v => !v)}
                  className="px-2.5 py-1.5 rounded-lg border border-white/20 dark:border-white/10 bg-white/30 dark:bg-white/10 backdrop-blur-md text-gray-700 dark:text-gray-200 hover:bg-white/45 dark:hover:bg-white/20 transition-colors"
                  title={showRight ? 'Hide AI' : 'Show AI'}
                  aria-pressed={!showRight}
                >
                  {/* AI/Chat icon */}
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z"/>
                  </svg>
                </button>
              </div>
            </div>
          </header>
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            {/* NotesEditor is heavy; lazy load while showing a minimal fallback */}
            <NotesEditor 
              key={selectedNoteId}
              noteId={selectedNoteId}
              onNoteChange={handleNoteChange}
            />
          </div>
        </div>

        {/* Right sidebar wrapper with smooth animation */}
        <div className={
          isMobile
            ? `fixed inset-y-0 right-0 z-30 transform transition-transform duration-300 ease-in-out ${showRight ? 'translate-x-0' : 'translate-x-full'} w-96`
            : `transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 min-h-0 h-full ${showRight ? 'w-96 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`
        }>
          {showRight && <AISidebar />}
        </div>

        {/* Scrim overlay for mobile drawers */}
        {isMobile && (showLeft || showRight) && (
          <div
            className="fixed inset-0 z-20 bg-black/30"
            onClick={() => { setShowLeft(false); setShowRight(false); }}
            aria-hidden
          />
        )}
      </main>
    </AuthProvider>
  )
}
