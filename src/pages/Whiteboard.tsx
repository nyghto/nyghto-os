import React, { useRef, useEffect, useState } from 'react';
import { Tldraw, Editor, DefaultColorStyle, DefaultHorizontalAlignStyle, createShapeId, getSnapshot, loadSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function Whiteboard() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'loading'>('loading');
  const MAX_SCROLL = 5000; // max px they can scroll down
  const containerRef = useRef<HTMLDivElement>(null);
  const isApplyingRemoteRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedJsonRef = useRef<string>('');

  const handleMount = (ed: Editor) => {
    // Defer state update to next frame to prevent React render loop warning
    requestAnimationFrame(() => {
      setEditor(ed);
      // Force camera to origin on load
      ed.setCamera({ x: 0, y: 0, z: 1 });
      // Set default styling to white and left-aligned
      ed.setStyleForNextShapes(DefaultColorStyle, 'white');
      ed.setStyleForNextShapes(DefaultHorizontalAlignStyle, 'start');
      // Set default tool to text so clicking anywhere starts typing
      ed.setCurrentTool('text');
    });

    // Attach native tldraw event listener for double click & right click
    ed.on('event', (info: any) => {
      // 1. Double click to type
      if (info.name === 'double_click') {
        const point = info.point || ed.inputs.currentPagePoint;
        const shape = ed.getShapeAtPoint(point);
        if (shape && shape.type === 'text') {
          ed.setEditingShape(shape.id);
        } else {
          ed.setCurrentTool('text');
          const id = createShapeId();
          ed.createShape({
            id,
            type: 'text',
            x: point.x,
            y: point.y,
          });
          ed.setEditingShape(id);
        }
      }

      // 2. Right click to delete shape
      if ((info.name === 'pointer_down' && info.button === 2) || info.name === 'context_menu') {
        const point = info.point || ed.inputs.currentPagePoint;
        const shape = ed.getShapeAtPoint(point);
        if (shape) {
          ed.deleteShapes([shape.id]);
        }
      }
    });
  };

  // Real-time Cloud Firestore synchronization across all team member logins
  useEffect(() => {
    if (!editor) return;

    const docRef = doc(db, 'whiteboards', 'main_board');

    // 1. Listen to remote updates from other users in Firebase
    const unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists()) {
        setSyncStatus('synced');
        return;
      }

      const data = docSnap.data();
      if (data && data.snapshotJson) {
        if (data.snapshotJson === lastSavedJsonRef.current) {
          setSyncStatus('synced');
          return;
        }

        try {
          const parsed = JSON.parse(data.snapshotJson);
          isApplyingRemoteRef.current = true;
          loadSnapshot(editor.store, parsed);
          lastSavedJsonRef.current = data.snapshotJson;
          setSyncStatus('synced');
        } catch (err) {
          console.error("Error loading remote whiteboard snapshot:", err);
        } finally {
          setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 150);
        }
      } else {
        setSyncStatus('synced');
      }
    }, (error) => {
      console.error("Whiteboard Firestore subscription error:", error);
      setSyncStatus('synced');
    });

    // 2. Listen to local changes and save to Firebase Cloud for all team members
    const unsubscribeStore = editor.store.listen((entry) => {
      if (isApplyingRemoteRef.current) return;
      if (entry.source === 'user') {
        setSyncStatus('saving');
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
          try {
            const snap = getSnapshot(editor.store);
            const jsonStr = JSON.stringify(snap);
            if (jsonStr === lastSavedJsonRef.current) {
              setSyncStatus('synced');
              return;
            }

            lastSavedJsonRef.current = jsonStr;
            await setDoc(docRef, {
              snapshotJson: jsonStr,
              updatedAt: Date.now(),
              updatedBy: user?.email || 'Authorized User'
            }, { merge: true });
            setSyncStatus('synced');
          } catch (err) {
            console.error("Error saving whiteboard to cloud:", err);
            setSyncStatus('synced');
          }
        }, 600);
      }
    });

    return () => {
      unsubscribeDoc();
      unsubscribeStore();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [editor, user?.email]);

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

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const point = editor.screenToPage({ x: e.clientX, y: e.clientY });
      const shape = editor.getShapeAtPoint(point);
      if (shape) {
        editor.deleteShapes([shape.id]);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    el.addEventListener('contextmenu', handleContextMenu, { capture: true });
    
    return () => {
      el.removeEventListener('wheel', handleWheel, { capture: true });
      el.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
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
          /* Remove text stroke/shadow and force text color to pure white */
          .tl-text-content,
          .tl-text,
          .tl-text-input,
          .tl-text-shape-wrapper,
          textarea.tl-text-input,
          .tl-svg-container text {
            -webkit-text-stroke: 0px transparent !important;
            text-shadow: none !important;
            color: #ffffff !important;
            caret-color: #ffffff !important;
            fill: #ffffff !important;
            -webkit-text-fill-color: #ffffff !important;
            text-align: left !important;
          }
        `}
      </style>
      <div className="animate-in fade-in duration-500 flex flex-col h-full w-full min-h-[70vh]">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-300 to-gray-500">
            Black Board
          </h1>
          <p className="text-theme-muted mt-2">Shared interactive canvas for the entire team in real time.</p>
        </div>

        {/* Live Team Sync Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 w-fit">
          {syncStatus === 'saving' ? (
            <>
              <Loader2 className="w-4 h-4 text-nyghto-orange animate-spin" />
              <span className="text-xs font-semibold text-nyghto-orange">Syncing changes...</span>
            </>
          ) : syncStatus === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-xs font-semibold text-blue-400">Loading Cloud Board...</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-green-400">Live Synced (All Members)</span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 w-full flex gap-4">
        {/* Main Canvas Container */}
        <div ref={containerRef} className="flex-1 rounded-2xl overflow-hidden shadow-2xl relative z-10 isolate bg-black border border-white/10" style={{ minHeight: '600px' }}>
          <Tldraw 
            darkMode={true} 
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
