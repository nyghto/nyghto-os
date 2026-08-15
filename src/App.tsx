import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, CheckSquare, Users, BarChart3, Settings, Bell, Search, LogOut, Sun, Moon, X, Palette, PenTool, ArrowLeftRight, Check } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme, THEME_COLORS } from './contexts/ThemeContext';
import type { ThemeColorName } from './contexts/ThemeContext';
import { TeamProvider } from './contexts/TeamContext';
import { auth, db } from './lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { hasAdminAccess, isCoreFounder, getUserRole, getUserName, getUserAvatar } from './utils/permissions';
import type { Activity } from './types';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Team from './pages/Team';
import Analytics from './pages/Analytics';
import AttendanceReport from './pages/AttendanceReport';
import Whiteboard from './pages/Whiteboard';
import Login from './pages/Login';
import { motion, AnimatePresence } from 'framer-motion';

const FOUNDER_ACCOUNTS = [
  { email: 'team.nyghto@gmail.com', name: 'Nyghto Admin', role: 'Super Admin', avatar: null },
  { email: 'salurinshan9539@gmail.com', name: 'Salu Rinshan', role: 'CEO', avatar: '/rinshan.jpg' },
  { email: 'amaldas.co@gmail.com', name: 'Amal Das', role: 'CTO', avatar: '/amal.jpg' },
  { email: 'shahalmuhammed404@gmail.com', name: 'Shahal Muhammed', role: 'CPO', avatar: '/shahal.jpg' },
];

function Sidebar() {
  const location = useLocation();
  const { user, userData, logout, switchedEmail, effectiveEmail, effectiveRole, effectiveName, effectiveAvatar, switchAccount } = useAuth();
  const [isSwitchMenuOpen, setIsSwitchMenuOpen] = useState(false);
  
  const role = effectiveRole || getUserRole(user?.email, userData?.role);
  const name = effectiveName || getUserName(user?.email, userData?.name);
  const avatar = effectiveAvatar || getUserAvatar(user?.email);
  
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: FolderKanban, label: 'Projects', path: '/projects' },
    { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
    { icon: Users, label: 'Team & Reports', path: '/team' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: CheckSquare, label: 'Attendance Report', path: '/attendance-report' },
    { icon: PenTool, label: 'Black Board', path: '/whiteboard' },
  ];

  return (
    <div className="w-64 h-screen glass-card rounded-none border-y-0 border-l-0 flex flex-col p-4 fixed left-0 top-0 z-50">
      <div className="flex items-center gap-3 mb-10 px-2 mt-4">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-nyghto-orange to-nyghto-yellow flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(255,107,0,0.5)]">
          N
        </div>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-theme-text to-theme-muted">
          Nyghto OS
        </span>
      </div>
      
      <nav className="flex flex-col gap-2 flex-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                isActive 
                  ? 'bg-gradient-to-r from-nyghto-orange/20 to-transparent text-nyghto-orange border-l-[3px] border-nyghto-orange shadow-[inset_4px_0_10px_rgba(255,107,0,0.1)]' 
                  : 'text-theme-muted hover:text-theme-text hover:bg-theme-border border-l-[3px] border-transparent hover:translate-x-1'
              }`}
            >
              <item.icon className={`w-5 h-5 transition-all duration-300 ${isActive ? 'text-nyghto-orange drop-shadow-[0_0_8px_rgba(255,107,0,0.5)]' : 'group-hover:text-nyghto-orange group-hover:scale-110'}`} />
              <span className="font-medium tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="mt-auto pt-3 flex flex-col gap-2">
        {/* Switch Account Option for the 4 Core Founders */}
        {isCoreFounder(user?.email) && (
          <div className="relative">
            <button
              onClick={() => setIsSwitchMenuOpen(!isSwitchMenuOpen)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                switchedEmail 
                  ? 'bg-nyghto-orange/15 text-nyghto-orange border-nyghto-orange/40 shadow-[0_0_10px_rgba(255,107,0,0.15)]' 
                  : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-3.5 h-3.5 text-nyghto-orange" />
                <span>Switch Acc</span>
              </div>
              <span className="text-[10px] text-nyghto-orange font-bold uppercase tracking-wider">
                {switchedEmail ? 'Active' : '4 Gmails'}
              </span>
            </button>

            {isSwitchMenuOpen && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-[#151520] border border-white/20 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1.5 mb-1 border-b border-white/10 flex items-center justify-between">
                  <span>Switch Account</span>
                  <button onClick={() => setIsSwitchMenuOpen(false)} className="text-gray-400 hover:text-white p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
                  {FOUNDER_ACCOUNTS.map(founder => {
                    const isSelected = effectiveEmail?.toLowerCase() === founder.email.toLowerCase();
                    return (
                      <button
                        key={founder.email}
                        onClick={() => {
                          switchAccount(founder.email);
                          setIsSwitchMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                          isSelected 
                            ? 'bg-nyghto-orange/20 border border-nyghto-orange/50 text-white' 
                            : 'hover:bg-white/5 text-gray-300 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {founder.avatar ? (
                            <img src={founder.avatar} alt={founder.name} className="w-6 h-6 rounded-full object-cover shrink-0 border border-white/10" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-nyghto-orange/20 text-nyghto-orange flex items-center justify-center font-bold text-[10px] shrink-0 border border-nyghto-orange/30">
                              {founder.name.charAt(0)}
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <div className="text-xs font-bold truncate text-white">{founder.name}</div>
                            <div className="text-[10px] text-nyghto-orange font-semibold">{founder.role}</div>
                          </div>
                        </div>

                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-nyghto-orange shrink-0 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {switchedEmail && (
                  <button
                    onClick={() => {
                      switchAccount(null);
                      setIsSwitchMenuOpen(false);
                    }}
                    className="w-full text-center text-[11px] text-gray-400 hover:text-white py-1.5 mt-1 pt-1.5 border-t border-white/10 transition-colors"
                  >
                    Reset to Logged-in Account
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-theme-border pt-3">
          <div className="flex items-center justify-between px-2 hover:bg-theme-border p-2 rounded-lg transition-all duration-300 group">
            <div className="flex items-center gap-3 overflow-hidden">
              {avatar ? (
                <img
                  src={avatar}
                  alt={name}
                  className="w-9 h-9 rounded-full object-cover border border-nyghto-orange/40 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-theme-bg flex items-center justify-center text-nyghto-orange border border-theme-border uppercase shadow-sm font-bold shrink-0">
                  {name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="overflow-hidden">
                <div className="text-sm font-medium text-theme-text truncate">{name}</div>
                <div className="text-xs font-semibold text-nyghto-orange uppercase tracking-wide">{role}</div>
              </div>
            </div>
            <button 
              onClick={() => logout()}
              className="text-theme-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Header() {
  const { user } = useAuth();
  const { theme, toggleTheme, accentColor, setAccentColor } = useTheme();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);

  React.useEffect(() => {
    const q = query(collection(db, 'activities'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Activity[]);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteActivity = async (activityId: string) => {
    try {
      await deleteDoc(doc(db, 'activities', activityId));
    } catch (error) {
      console.error("Error deleting activity:", error);
    }
  };

  return (
    <header className="h-20 border-b border-theme-border glass-card rounded-none flex items-center justify-between px-8 sticky top-0 z-40 bg-theme-bg/80 backdrop-blur-xl transition-colors duration-300">
      <div className="relative w-96">
        <Search className="w-5 h-5 text-theme-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input 
          type="text" 
          placeholder="Search projects, tasks, or clients..." 
          className="w-full bg-theme-card border border-theme-border rounded-xl py-2 pl-10 pr-4 text-sm text-theme-text placeholder-theme-muted focus:outline-none focus:border-nyghto-orange transition-colors"
        />
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleTheme}
          className="relative p-2 text-theme-muted hover:text-theme-text transition-colors rounded-full hover:bg-theme-border"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <div className="relative">
          <button 
            onClick={() => { setIsPaletteOpen(!isPaletteOpen); setIsNotificationsOpen(false); }}
            className="relative p-2 text-theme-muted hover:text-theme-text transition-colors rounded-full hover:bg-theme-border"
            title="Change Accent Color"
          >
            <Palette className="w-5 h-5" />
          </button>
          {isPaletteOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-theme-card border border-theme-border rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2 border-b border-theme-border flex justify-between items-center mb-2">
                <h3 className="font-bold text-sm text-theme-text">Theme Color</h3>
              </div>
              <div className="grid grid-cols-5 gap-2 px-4 py-2">
                {(Object.keys(THEME_COLORS) as ThemeColorName[]).map((colorName) => (
                  <button
                    key={colorName}
                    onClick={() => { setAccentColor(colorName); setIsPaletteOpen(false); }}
                    className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${accentColor === colorName ? 'ring-2 ring-white ring-offset-2 ring-offset-theme-card' : ''}`}
                    style={{ backgroundColor: THEME_COLORS[colorName].primary }}
                    title={colorName.charAt(0).toUpperCase() + colorName.slice(1)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button 
            onClick={() => { setIsNotificationsOpen(!isNotificationsOpen); setIsPaletteOpen(false); }}
            className="relative p-2 text-theme-muted hover:text-theme-text transition-colors rounded-full hover:bg-theme-border"
          >
            <Bell className="w-5 h-5" />
            {activities.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-nyghto-orange rounded-full"></span>
            )}
          </button>
          
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-theme-card border border-theme-border rounded-xl shadow-2xl py-2 z-50">
              <div className="px-4 py-2 border-b border-theme-border flex justify-between items-center">
                <h3 className="font-bold text-sm text-theme-text">Notifications</h3>
                <button 
                  onClick={() => setIsNotificationsOpen(false)}
                  className="p-1 text-theme-muted hover:text-theme-text rounded hover:bg-theme-border transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                {activities.length > 0 ? (
                  activities.map((activity) => (
                    <div key={activity.id} className="px-4 py-3 hover:bg-theme-border transition-colors border-b border-theme-border/50 last:border-0 cursor-pointer flex justify-between items-start group">
                      <div>
                        <p className="text-xs font-medium text-theme-text line-clamp-2">
                          {activity.text.replace(/shahalmuhammed\s*404/gi, 'Nighto')}
                        </p>
                        <p className="text-[10px] text-theme-muted mt-1">
                          {activity.createdAt ? new Date(activity.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteActivity(activity.id); }}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity p-0.5 ml-2"
                        title="Delete notification"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-theme-muted">
                    No new notifications.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [scrollProgress, setScrollProgress] = useState(0);

  // Track window scroll
  useEffect(() => {
    const handleWindowScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const scrollHeight = docHeight - winHeight;
      
      if (scrollHeight > 0) {
        setScrollProgress((scrollTop / scrollHeight) * 100);
      } else {
        setScrollProgress(0);
      }
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    handleWindowScroll();
    
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, []);

  return (
    <>
      {/* Background Watermark */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[-1] overflow-hidden select-none">
        <h1 className="text-[18vw] font-black text-white/10 tracking-tighter mix-blend-overlay">nyghto</h1>
      </div>
      
      <div className="min-h-screen flex bg-transparent text-theme-text transition-colors duration-300 relative z-0">
        <Sidebar />
        <div className="flex-1 ml-64 flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 p-8 overflow-y-auto overflow-x-hidden relative scroll-smooth">
            {/* Scroll Progress Bar ONLY for Whiteboard */}
            {location.pathname === '/whiteboard' && (
              <div className="fixed right-0 top-0 bottom-0 w-1.5 bg-theme-border/50 z-50">
                <div 
                  className="w-full bg-nyghto-orange transition-all duration-150 ease-out shadow-[0_0_10px_rgba(255,107,0,0.5)]"
                  style={{ height: `${scrollProgress}%` }}
                />
              </div>
            )}
            
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="h-full flex flex-col"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-nyghto-orange"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Layout><Projects /></Layout></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Layout><Tasks /></Layout></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute><Layout><Team /></Layout></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
            <Route path="/attendance-report" element={<ProtectedRoute><Layout><AttendanceReport /></Layout></ProtectedRoute>} />
            <Route path="/whiteboard" element={<ProtectedRoute><Layout><Whiteboard /></Layout></ProtectedRoute>} />
            
            <Route path="*" element={
              <ProtectedRoute>
                <Layout>
                  <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-theme-card flex items-center justify-center border border-theme-border shadow-sm">
                      <LayoutDashboard className="w-8 h-8 text-nyghto-orange" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-theme-text">Under Construction</h2>
                      <p className="text-theme-muted mt-2">This page is being built right now.</p>
                    </div>
                  </div>
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
