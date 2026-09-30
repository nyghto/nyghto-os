import React, { useState, useEffect } from 'react';
import { 
  Lock, Trash2, Key, ShieldCheck, MapPin, Navigation, 
  Palette, Sun, Moon, CheckCircle2, AlertCircle, RefreshCw,
  Building, User, Shield
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, THEME_COLORS } from '../contexts/ThemeContext';
import type { ThemeColorName } from '../contexts/ThemeContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { isSuperAdmin, getUserRole, getUserName, getUserAvatar } from '../utils/permissions';
import { getOfficeLocation, saveOfficeLocation } from '../utils/geoAttendance';
import type { OfficeLocation } from '../utils/geoAttendance';

export default function Settings() {
  const { user, userData } = useAuth();
  const { theme, toggleTheme, accentColor, setAccentColor } = useTheme();

  const isSuper = isSuperAdmin(user?.email);
  const role = getUserRole(user?.email, userData?.role);
  const name = getUserName(user?.email, userData?.name);
  const avatar = getUserAvatar(user?.email);
  const userEmail = user?.email || '';

  // Tab state
  const [activeTab, setActiveTab] = useState<'security' | 'appearance' | 'office'>('security');

  // Password / PIN Form State
  const [passwordTarget, setPasswordTarget] = useState<'login' | 'delete'>('login');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [isSavingPass, setIsSavingPass] = useState(false);

  // Admin Config info
  const [adminConfig, setAdminConfig] = useState<{ deletePin?: string; adminPin?: string }>({});

  // Office Location State (Super Admin)
  const [officeData, setOfficeData] = useState<OfficeLocation | null>(null);
  const [officeName, setOfficeName] = useState('');
  const [officeLat, setOfficeLat] = useState('');
  const [officeLng, setOfficeLng] = useState('');
  const [officeRadius, setOfficeRadius] = useState(100);
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);
  const [officeSaving, setOfficeSaving] = useState(false);
  const [officeMessage, setOfficeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load Admin Config for super admins
  useEffect(() => {
    if (!isSuper) return;
    const unsub = onSnapshot(doc(db, 'settings', 'admin_config'), (snap) => {
      if (snap.exists()) {
        setAdminConfig(snap.data() as any);
      }
    });
    return () => unsub();
  }, [isSuper]);

  // Load Office Location
  useEffect(() => {
    getOfficeLocation().then((loc) => {
      if (loc) {
        setOfficeData(loc);
        setOfficeName(loc.name || 'Nyghto HQ');
        setOfficeLat(loc.latitude.toString());
        setOfficeLng(loc.longitude.toString());
        setOfficeRadius(loc.radius || 100);
      }
    });
  }, []);

  // Handle Password or Delete PIN Update
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    const emailClean = userEmail.toLowerCase().trim();
    const oldClean = oldPassword.trim();
    const newClean = newPassword.trim();
    const confirmClean = confirmPassword.trim();

    if (!oldClean || !newClean || !confirmClean) {
      setPassError('Please fill out all password fields.');
      return;
    }

    if (newClean.length < 4) {
      setPassError('New password must be at least 4 characters/digits.');
      return;
    }

    if (newClean !== confirmClean) {
      setPassError('New password and confirmation do not match.');
      return;
    }

    setIsSavingPass(true);

    try {
      if (isSuper && passwordTarget === 'delete') {
        // Changing Admin Delete PIN
        let expectedOld = '9999';
        const adminDoc = await getDoc(doc(db, 'settings', 'admin_config'));
        if (adminDoc.exists() && adminDoc.data().deletePin) {
          expectedOld = adminDoc.data().deletePin.toString().trim();
        }

        if (oldClean !== expectedOld) {
          setPassError('Current Delete Password is incorrect!');
          setIsSavingPass(false);
          return;
        }

        await setDoc(doc(db, 'settings', 'admin_config'), {
          deletePin: newClean,
          deletePinUpdatedAt: serverTimestamp(),
          updatedByName: name,
          updatedByEmail: emailClean
        }, { merge: true });

        await addDoc(collection(db, 'activities'), {
          text: `${name} updated the Admin Delete Action Security Password`,
          type: 'report',
          iconColor: 'text-red-500',
          createdAt: serverTimestamp()
        });

        setPassSuccess('Admin Delete Password has been successfully updated!');
      } else {
        // Changing User / Admin Login Password
        const defaultPasswords: Record<string, string> = {
          'amaldas.co@gmail.com': 'amal123',
          'salurinshan9539@gmail.com': 'rinshan123',
          'shahalmuhammed404@gmail.com': 'shahal123',
          'team.nyghto@gmail.com': '1111'
        };

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
          setPassError('Current password is incorrect! Please verify and try again.');
          setIsSavingPass(false);
          return;
        }

        // Save into user_passwords
        await setDoc(passDocRef, {
          email: emailClean,
          password: newClean,
          updatedAt: serverTimestamp(),
          updatedByName: name
        }, { merge: true });

        // If Super Admin account, sync with settings/admin_config
        if (emailClean === 'team.nyghto@gmail.com') {
          await setDoc(doc(db, 'settings', 'admin_config'), {
            adminPin: newClean,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }

        await addDoc(collection(db, 'activities'), {
          text: `${name} updated their login password`,
          type: 'report',
          iconColor: 'text-nyghto-orange',
          createdAt: serverTimestamp()
        });

        setPassSuccess('Login password has been updated successfully!');
      }

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Error changing password:', err);
      setPassError(err.message || 'Failed to update password');
    } finally {
      setIsSavingPass(false);
    }
  };

  // 1-Click GPS Capture
  const handleCaptureOfficeLocation = () => {
    if (!navigator.geolocation) {
      setOfficeMessage({ type: 'error', text: 'Geolocation is not supported by your browser.' });
      return;
    }
    setIsCapturingGPS(true);
    setOfficeMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficeLat(pos.coords.latitude.toFixed(6));
        setOfficeLng(pos.coords.longitude.toFixed(6));
        setIsCapturingGPS(false);
        setOfficeMessage({ 
          type: 'success', 
          text: `Coordinates captured successfully (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})! Click "Save Location" below to apply.` 
        });
      },
      (err) => {
        setIsCapturingGPS(false);
        setOfficeMessage({ type: 'error', text: `GPS error: ${err.message}. Please enable location permissions.` });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Save Office Location
  const handleSaveOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(officeLat);
    const lng = parseFloat(officeLng);

    if (isNaN(lat) || isNaN(lng)) {
      setOfficeMessage({ type: 'error', text: 'Please enter valid numerical latitude and longitude.' });
      return;
    }

    setOfficeSaving(true);
    setOfficeMessage(null);

    try {
      await saveOfficeLocation(
        {
          name: officeName.trim() || 'Nyghto HQ',
          latitude: lat,
          longitude: lng,
          radius: officeRadius || 100,
        },
        name
      );

      setOfficeData({
        name: officeName.trim() || 'Nyghto HQ',
        latitude: lat,
        longitude: lng,
        radius: officeRadius || 100,
        updatedBy: name
      });

      setOfficeMessage({ type: 'success', text: 'Office GPS geofence updated successfully!' });
    } catch (err: any) {
      setOfficeMessage({ type: 'error', text: err.message || 'Failed to save location.' });
    } finally {
      setOfficeSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme-border pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-theme-text tracking-tight flex items-center gap-3">
            System Settings
          </h1>
          <p className="text-sm text-theme-muted mt-1">
            Manage your credentials, delete authorization passwords, system theme, and office parameters.
          </p>
        </div>

        {/* Profile Tag */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl glass-card border border-theme-border self-start sm:self-auto">
          {avatar ? (
            <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover border border-nyghto-orange/40" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-theme-bg flex items-center justify-center text-nyghto-orange font-bold border border-theme-border">
              {name?.charAt(0) || 'U'}
            </div>
          )}
          <div className="leading-tight">
            <div className="text-sm font-semibold text-theme-text">{name}</div>
            <div className="text-xs text-nyghto-orange font-medium flex items-center gap-1">
              <Shield className="w-3 h-3" />
              <span>{role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-theme-border pb-2 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => { setActiveTab('security'); setPassError(''); setPassSuccess(''); }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'security'
              ? 'bg-nyghto-orange text-white shadow-md'
              : 'text-theme-muted hover:text-theme-text hover:bg-theme-border'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Security & Passwords</span>
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'appearance'
              ? 'bg-nyghto-orange text-white shadow-md'
              : 'text-theme-muted hover:text-theme-text hover:bg-theme-border'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Appearance & Theme</span>
        </button>

        {isSuper && (
          <button
            onClick={() => setActiveTab('office')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'office'
                ? 'bg-nyghto-orange text-white shadow-md'
                : 'text-theme-muted hover:text-theme-text hover:bg-theme-border'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Office GPS Geofence</span>
          </button>
        )}
      </div>

      {/* Security Tab Content */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Info Card */}
          <div className="md:col-span-1 space-y-4">
            <div className="glass-card p-5 border border-theme-border space-y-3">
              <h3 className="font-bold text-base text-theme-text flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-nyghto-orange" />
                Password Protection
              </h3>
              <p className="text-xs text-theme-muted leading-relaxed">
                Protect your account and administrative operations with strong passwords.
              </p>

              <div className="pt-3 border-t border-theme-border space-y-2 text-xs">
                <div className="flex justify-between items-center py-1">
                  <span className="text-theme-muted">Logged In User:</span>
                  <span className="font-semibold text-theme-text truncate max-w-[150px]">{userEmail}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-theme-muted">Access Level:</span>
                  <span className="font-semibold text-nyghto-orange uppercase">{role}</span>
                </div>
                {isSuper && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-theme-muted">Active Delete PIN:</span>
                    <span className="font-mono text-emerald-400 bg-white/5 px-2 py-0.5 rounded">
                      {adminConfig.deletePin || '9999 (default)'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card p-5 border border-theme-border bg-theme-bg/50">
              <h4 className="text-xs font-bold text-theme-text uppercase tracking-wider mb-2">Notice</h4>
              <p className="text-xs text-theme-muted leading-relaxed">
                The <b>Delete Action Password</b> is required whenever deleting projects, tasks, or schedules to prevent accidental data loss across your team.
              </p>
            </div>
          </div>

          {/* Form Card */}
          <div className="md:col-span-2 glass-card p-6 border border-theme-border space-y-6">
            {/* Target Password Selector (Super Admin only) */}
            {isSuper ? (
              <div>
                <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">
                  Select Password to Change
                </label>
                <div className="grid grid-cols-2 gap-3 bg-theme-bg/60 p-1.5 rounded-xl border border-theme-border">
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordTarget('login');
                      setOldPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPassError('');
                      setPassSuccess('');
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      passwordTarget === 'login'
                        ? 'bg-nyghto-orange text-white shadow'
                        : 'text-theme-muted hover:text-theme-text'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>My Login Password</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPasswordTarget('delete');
                      setOldPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPassError('');
                      setPassSuccess('');
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      passwordTarget === 'delete'
                        ? 'bg-red-500 text-white shadow'
                        : 'text-theme-muted hover:text-theme-text'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Action Password</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 pb-3 border-b border-theme-border">
                <div className="w-10 h-10 rounded-xl bg-nyghto-orange/20 border border-nyghto-orange/30 flex items-center justify-center text-nyghto-orange">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-theme-text">Change Your Login Password</h3>
                  <p className="text-xs text-theme-muted">Enter your current password and choose a new one.</p>
                </div>
              </div>
            )}

            {/* Alert Messages */}
            {passError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-theme-text uppercase tracking-wider mb-1.5">
                  Current (Old) {passwordTarget === 'delete' ? 'Delete Password' : 'Password'} *
                </label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => {
                    setOldPassword(e.target.value);
                    setPassError('');
                  }}
                  placeholder={passwordTarget === 'delete' ? 'Default is 9999' : 'Enter current password'}
                  className="w-full bg-theme-bg border border-theme-border rounded-xl p-3 text-sm text-theme-text focus:outline-none focus:border-nyghto-orange font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text uppercase tracking-wider mb-1.5">
                  New {passwordTarget === 'delete' ? 'Delete PIN / Password' : 'Password'} *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPassError('');
                  }}
                  placeholder="Enter new password (min 4 characters)"
                  className="w-full bg-theme-bg border border-theme-border rounded-xl p-3 text-sm text-theme-text focus:outline-none focus:border-nyghto-orange font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text uppercase tracking-wider mb-1.5">
                  Confirm New {passwordTarget === 'delete' ? 'Delete Password' : 'Password'} *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPassError('');
                  }}
                  placeholder="Re-enter new password to confirm"
                  className="w-full bg-theme-bg border border-theme-border rounded-xl p-3 text-sm text-theme-text focus:outline-none focus:border-nyghto-orange font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingPass || !oldPassword || !newPassword || !confirmPassword}
                  className="w-full sm:w-auto px-6 py-3 btn-primary text-xs font-bold rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSavingPass ? 'Updating...' : `Save New ${passwordTarget === 'delete' ? 'Delete PIN' : 'Password'}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appearance Tab Content */}
      {activeTab === 'appearance' && (
        <div className="glass-card p-6 border border-theme-border space-y-6">
          <div>
            <h3 className="text-base font-bold text-theme-text mb-1">Color Theme & Mode</h3>
            <p className="text-xs text-theme-muted">Customize the interface mode and brand accent color.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-theme-border bg-theme-bg/50 space-y-3">
              <span className="text-xs font-bold text-theme-text uppercase tracking-wider">Display Mode</span>
              <div className="flex gap-3">
                <button
                  onClick={() => { if (theme !== 'dark') toggleTheme(); }}
                  className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                    theme === 'dark'
                      ? 'border-nyghto-orange bg-nyghto-orange/20 text-nyghto-orange'
                      : 'border-theme-border text-theme-muted hover:text-theme-text'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>Dark Mode</span>
                </button>

                <button
                  onClick={() => { if (theme !== 'light') toggleTheme(); }}
                  className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                    theme === 'light'
                      ? 'border-nyghto-orange bg-nyghto-orange/20 text-nyghto-orange'
                      : 'border-theme-border text-theme-muted hover:text-theme-text'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  <span>Light Mode</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-theme-border bg-theme-bg/50 space-y-3">
              <span className="text-xs font-bold text-theme-text uppercase tracking-wider">Accent Color</span>
              <div className="flex items-center gap-3">
                {(Object.keys(THEME_COLORS) as ThemeColorName[]).map((colorName) => (
                  <button
                    key={colorName}
                    onClick={() => setAccentColor(colorName)}
                    className={`w-9 h-9 rounded-full transition-transform hover:scale-110 flex items-center justify-center ${
                      accentColor === colorName ? 'ring-2 ring-white ring-offset-2 ring-offset-theme-card' : ''
                    }`}
                    style={{ backgroundColor: THEME_COLORS[colorName].primary }}
                    title={colorName.charAt(0).toUpperCase() + colorName.slice(1)}
                  >
                    {accentColor === colorName && <CheckCircle2 className="w-4 h-4 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Office GPS Geofence Tab (Super Admin Only) */}
      {activeTab === 'office' && isSuper && (
        <div className="glass-card p-6 border border-theme-border space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-theme-text mb-1 flex items-center gap-2">
                <Building className="w-5 h-5 text-nyghto-orange" />
                Office GPS & Geofence Coordinates
              </h3>
              <p className="text-xs text-theme-muted">
                Define the headquarters GPS coordinates and boundary radius for automated team attendance check-in.
              </p>
            </div>
          </div>

          {/* Quick Capture Box */}
          <div className="p-4 rounded-xl bg-nyghto-orange/10 border border-nyghto-orange/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-white mb-0.5">Are you currently sitting at the office?</div>
              <div className="text-xs text-gray-300">Capture your current GPS location with high accuracy in one tap.</div>
            </div>
            <button
              type="button"
              onClick={handleCaptureOfficeLocation}
              disabled={isCapturingGPS}
              className="py-2.5 px-4 rounded-xl bg-nyghto-orange hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2 whitespace-nowrap disabled:opacity-50 shrink-0"
            >
              <Navigation className={`w-4 h-4 ${isCapturingGPS ? 'animate-spin' : ''}`} />
              <span>{isCapturingGPS ? 'Locating...' : '📍 Auto-Capture GPS'}</span>
            </button>
          </div>

          {/* Message notification */}
          {officeMessage && (
            <div className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
              officeMessage.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {officeMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{officeMessage.text}</span>
            </div>
          )}

          {/* Location Form */}
          <form onSubmit={handleSaveOffice} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-theme-text uppercase tracking-wider mb-1.5">
                Office / Location Name *
              </label>
              <input
                type="text"
                required
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                placeholder="e.g. Nyghto HQ, Calicut"
                className="w-full bg-theme-bg border border-theme-border rounded-xl p-3 text-sm text-theme-text focus:outline-none focus:border-nyghto-orange"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-theme-text uppercase tracking-wider mb-1.5">
                  Latitude *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={officeLat}
                  onChange={(e) => setOfficeLat(e.target.value)}
                  placeholder="e.g. 11.2588"
                  className="w-full bg-theme-bg border border-theme-border rounded-xl p-3 text-sm text-theme-text focus:outline-none focus:border-nyghto-orange font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text uppercase tracking-wider mb-1.5">
                  Longitude *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={officeLng}
                  onChange={(e) => setOfficeLng(e.target.value)}
                  placeholder="e.g. 75.7804"
                  className="w-full bg-theme-bg border border-theme-border rounded-xl p-3 text-sm text-theme-text focus:outline-none focus:border-nyghto-orange font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-text uppercase tracking-wider mb-1.5">
                Geofence Radius (Meters)
              </label>
              <input
                type="number"
                min="20"
                max="5000"
                value={officeRadius}
                onChange={(e) => setOfficeRadius(parseInt(e.target.value) || 100)}
                placeholder="100"
                className="w-full max-w-xs bg-theme-bg border border-theme-border rounded-xl p-3 text-sm text-theme-text focus:outline-none focus:border-nyghto-orange font-mono"
              />
              <p className="text-[11px] text-theme-muted mt-1">Recommended: 100 meters</p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={officeSaving || !officeLat || !officeLng}
                className="px-6 py-3 btn-primary text-xs font-bold rounded-xl shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                <span>{officeSaving ? 'Saving...' : 'Save Office Coordinates'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
