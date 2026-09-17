import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, CheckSquare, Users, BarChart3, Settings, Bell, Search, LogOut, Sun, Moon, X, Palette, PenTool, Key, Lock, CheckCircle2, ShieldCheck, Trash2, Award, Calendar } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme, THEME_COLORS } from './contexts/ThemeContext';
import type { ThemeColorName } from './contexts/ThemeContext';
import { TeamProvider } from './contexts/TeamContext';
import { auth, db } from './lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, deleteDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { hasAdminAccess, isSuperAdmin, getUserRole, getUserName, getUserAvatar } from './utils/permissions';
import type { Activity } from './types';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Team from './pages/Team';
import Analytics from './pages/Analytics';
import AttendanceReport from './pages/AttendanceReport';
import Whiteboard from './pages/Whiteboard';
import Schedules from './pages/Schedules';
import Login from './pages/Login';
import { motion, AnimatePresence } from 'framer-motion';

function Sidebar() {
  const location = useLocation();
  const { user, userData, logout } = useAuth();
  
  const role = getUserRole(user?.email, userData?.role);
  const name = getUserName(user?.email, userData?.name);
  const avatar = getUserAvatar(user?.email);

  // Password Change State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTargetTab, setPasswordTargetTab] = useState<'login' | 'delete'>('login');
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [isSavingPass, setIsSavingPass] = useState(false);
  
  const isSuper = isSuperAdmin(user?.email);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: FolderKanban, label: 'Projects', path: '/projects' },
    { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
    { icon: Calendar, label: 'Schedules', path: '/schedules' },
    { icon: Users, label: 'Team & Reports', path: '/team' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: CheckSquare, label: 'Attendance Report', path: '/attendance-report' },
    { icon: PenTool, label: 'Black Board', path: '/whiteboard' },
  ];

  const handleUpdateUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setPassError('');
    setPassSuccess('');

    const emailClean = user.email.toLowerCase().trim();
    const oldClean = oldPasswordInput.trim();
    const newClean = newPasswordInput.trim();
    const confirmClean = confirmPasswordInput.trim();

    // Default password fallbacks
    const defaultPasswords: Record<string, string> = {
      'amaldas.co@gmail.com': 'amal123',
      'salurinshan9539@gmail.com': 'rinshan123',
      'shahalmuhammed404@gmail.com': 'shahal123',
      'team.nyghto@gmail.com': '1111'
    };

    setIsSavingPass(true);
    try {
      if (isSuper && passwordTargetTab === 'delete') {
        // Handle Admin Delete Password Change
        const adminDoc = await getDoc(doc(db, 'settings', 'admin_config'));
        let expectedOld = '9999';
        if (adminDoc.exists() && adminDoc.data().deletePin) {
          expectedOld = adminDoc.data().deletePin.toString().trim();
        }

        if (oldClean !== expectedOld) {
          setPassError('Old Delete Password is incorrect! Please enter current delete password.');
          setIsSavingPass(false);
          return;
        }

        if (newClean.length < 4) {
          setPassError('New Delete Password must be at least 4 characters/digits.');
          setIsSavingPass(false);
          return;
        }

        if (newClean !== confirmClean) {
          setPassError('New password and confirmation password do not match.');
          setIsSavingPass(false);
          return;
        }

        await setDoc(doc(db, 'settings', 'admin_config'), {
          deletePin: newClean,
          deletePinUpdatedAt: serverTimestamp(),
          updatedByName: name,
          updatedByEmail: emailClean
        }, { merge: true });

        setPassSuccess('Admin Delete Password updated successfully!');
      } else {
        // Handle User / Admin Login Password Change
        const passDocRef = doc(db, 'user_passwords', emailClean);
        const passSnap = await getDoc(passDocRef);
        
        let expectedOld = defaultPasswords[emailClean] || '1111';
        if (passSnap.exists() && passSnap.data().password) {
          expectedOld = passSnap.data().password.toString().trim();
        } else if (emailClean === 'team.nyghto@gmail.com') {
          const adminDoc = await getDoc(doc(db, 'settings', 'admin_config'));
          if (adminDoc.exists() && adminDoc.data().adminPin) {
            expectedOld = adminDoc.data().adminPin.toString().trim();
          }
        }

        if (oldClean !== expectedOld) {
          setPassError('Old password is incorrect! Please enter your current active password.');
          setIsSavingPass(false);
          return;
        }

        if (newClean.length < 4) {
          setPassError('New password must be at least 4 characters.');
          setIsSavingPass(false);
          return;
        }

        if (newClean !== confirmClean) {
          setPassError('New password and confirmation password do not match.');
          setIsSavingPass(false);
          return;
        }

        // Save new password to user_passwords collection
        await setDoc(passDocRef, {
          email: emailClean,
          password: newClean,
          updatedAt: serverTimestamp(),
          updatedByName: name
        }, { merge: true });

        // If Super Admin, also update settings/admin_config adminPin
        if (emailClean === 'team.nyghto@gmail.com') {
          await setDoc(doc(db, 'settings', 'admin_config'), {
            adminPin: newClean,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }

        setPassSuccess('Login password updated successfully!');
      }

      setOldPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPassSuccess('');
      }, 2000);
    } catch (err: any) {
      console.error("Error updating password:", err);
      setPassError(err.message || 'Failed to update password');
    } finally {
      setIsSavingPass(false);
    }
  };

  return (
    <>
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
        
        <div className="mt-auto pt-4 flex flex-col gap-2">
          <div className="border-t border-theme-border pt-4">
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
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  to="/team"
                  className="text-theme-muted hover:text-yellow-400 p-1 transition-colors"
                  title="View My Points & Leaderboard"
                >
                  <Award className="w-4 h-4" />
                </Link>
                <button 
                  onClick={() => {
                    setIsPasswordModalOpen(true);
                    setOldPasswordInput('');
                    setNewPasswordInput('');
                    setConfirmPasswordInput('');
                    setPassError('');
                    setPassSuccess('');
                  }}
                  className="text-theme-muted hover:text-nyghto-orange p-1 transition-colors"
                  title="Change Password"
                >
                  <Key className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => logout()}
                  className="text-theme-muted hover:text-red-400 p-1 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setIsPasswordModalOpen(false)}>
          <div className="glass-card w-full max-w-md p-6 relative border border-nyghto-orange/40 shadow-[0_0_40px_rgba(255,107,0,0.25)] rounded-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ${passwordTargetTab === 'login' ? 'bg-nyghto-orange/20 border border-nyghto-orange/30 text-nyghto-orange' : 'bg-red-500/20 border border-red-500/30 text-red-400'}`}>
                {passwordTargetTab === 'login' ? <Lock className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {isSuper ? (passwordTargetTab === 'login' ? 'Admin Login Password' : 'Admin Delete Action Password') : 'Change My Password'}
                </h3>
                <p className="text-xs text-gray-400">Account: <span className="text-nyghto-orange font-mono">{user?.email}</span></p>
              </div>
            </div>

            {/* If Super Admin, show tabs to switch between Login Password & Delete Password */}
            {isSuper && (
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordTargetTab('login');
                    setOldPasswordInput('');
                    setNewPasswordInput('');
                    setConfirmPasswordInput('');
                    setPassError('');
                    setPassSuccess('');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    passwordTargetTab === 'login' 
                      ? 'bg-nyghto-orange text-white shadow-md' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Login Password</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPasswordTargetTab('delete');
                    setOldPasswordInput('');
                    setNewPasswordInput('');
                    setConfirmPasswordInput('');
                    setPassError('');
                    setPassSuccess('');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    passwordTargetTab === 'delete' 
                      ? 'bg-red-600 text-white shadow-md' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Password</span>
                </button>
              </div>
            )}

            {passError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium leading-relaxed">
                {passError}
              </div>
            )}

            {passSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium leading-relaxed flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateUserPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Current (Old) Password *
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={oldPasswordInput}
                  onChange={(e) => {
                    setOldPasswordInput(e.target.value);
                    setPassError('');
                  }}
                  placeholder="Enter current old password"
                  className="w-full bg-nyghto-dark/90 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-nyghto-orange font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={newPasswordInput}
                  onChange={(e) => {
                    setNewPasswordInput(e.target.value);
                    setPassError('');
                  }}
                  placeholder="Enter new password (min 4 characters)"
                  className="w-full bg-nyghto-dark/90 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-nyghto-orange font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPasswordInput}
                  onChange={(e) => {
                    setConfirmPasswordInput(e.target.value);
                    setPassError('');
                  }}
                  placeholder="Re-enter new password to confirm"
                  className="w-full bg-nyghto-dark/90 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-nyghto-orange font-mono"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPass || !oldPasswordInput || !newPasswordInput || !confirmPasswordInput}
                  className="flex-1 btn-primary py-2.5 text-xs font-bold rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSavingPass ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
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
          <main className="flex-1 px-5 py-5 lg:px-7 lg:py-6 overflow-y-auto overflow-x-hidden relative scroll-smooth">
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
            <Route path="/schedules" element={<ProtectedRoute><Layout><Schedules /></Layout></ProtectedRoute>} />
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
