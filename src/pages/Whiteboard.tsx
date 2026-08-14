import React, { useRef, useEffect, useState } from 'react';
import { Tldraw, Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { hasAdminAccess } from '../utils/permissions';

export default function Whiteboard() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const MAX_SCROLL = 5000; // max px they can scroll down
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMount = (ed: Editor) => {
    setEditor(ed);
    // Force camera to origin on load
    ed.setCamera({ x: 0, y: 0, z: 1 });
  };

  // Intercept wheel events to create a custom vertical scroll behavior
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !editor) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();

      setScrollY((prev) => {
        let newY = prev + e.deltaY;
        if (newY < 0) newY = 0; // Prevent scrolling past top
        if (newY > MAX_SCROLL) newY = MAX_SCROLL;
        
        // Move camera strictly on Y axis
        editor.setCamera({ x: 0, y: -newY, z: 1 });
        return newY;
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', handleWheel, { capture: true });
  }, [editor]);

  const scrollProgress = (scrollY / MAX_SCROLL) * 100;

  return (
    <>
      <style>
        {`
          .tlui-button[title="Back to content"],
          [data-testid="back-to-content"],
          .tlui-toast__close-button,
          [title*="Back to content"] {
            display: none !important;
          }
          .tl-container {
            background-color: transparent !important;
          }
          .tl-background {
            display: none !important;
          }
        `}
      </style>
      <div className="animate-in fade-in duration-500 flex flex-col h-full w-full min-h-[70vh]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">
          Blue Board
        </h1>
        <p className="text-theme-muted mt-2">Plan your ideas, draw mind maps, and brainstorm visually.</p>
      </div>
      
      <div className="flex-1 w-full flex gap-4">
        {/* Main Canvas Container */}
        <div ref={containerRef} className="flex-1 rounded-2xl overflow-hidden shadow-2xl relative z-10 isolate bg-gradient-to-br from-blue-900/40 to-blue-500/10 border border-blue-500/30 backdrop-blur-sm" style={{ minHeight: '600px' }}>
          <Tldraw 
            persistenceKey="nyghto-whiteboard-data" 
            darkMode={theme === 'dark'} 
            isReadonly={!hasAdminAccess(user?.email)}
            onMount={handleMount}
            components={{
              NavigationPanel: () => null,
              ZoomMenu: () => null,
              Minimap: () => null,
              HelperButtons: () => null,
            }}
          />
        </div>
        
        {/* Custom Vertical Scrollbar */}
        <div className="w-1.5 bg-theme-border/50 rounded-full overflow-hidden relative">
          <div 
            className="w-full bg-nyghto-orange transition-all duration-75 ease-out shadow-[0_0_10px_rgba(255,107,0,0.5)] rounded-full"
            style={{ height: `${scrollProgress}%` }}
          />
        </div>
      </div>
    </div>
    </>
  );
}
