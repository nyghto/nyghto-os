import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { Clock, Send, CheckCircle2, XCircle, ArrowRight, UserCheck, AlertTriangle, ShieldCheck, Lock, X } from 'lucide-react';
import { isSuperAdmin, hasAdminAccess } from '../utils/permissions';

export default function Login() {
  const { unauthorizedError, clearUnauthorizedError, pendingUser, clearPendingUser, requestAccess } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected'>('idle');
  const [sendingRequest, setSendingRequest] = useState(false);

  // Admin PIN Protection State (PIN: 1111)
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState('');
  const [pendingAdminUser, setPendingAdminUser] = useState<any>(null);

  const navigate = useNavigate();

  const [adminPin, setAdminPin] = useState('1111');
  const [customPasswords, setCustomPasswords] = useState<Record<string, string>>({});

  // Load live Admin PIN & custom user passwords from Firestore safely
  useEffect(() => {
    const unsubAdmin = onSnapshot(doc(db, 'settings', 'admin_config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.adminPin) {
          setAdminPin(data.adminPin.toString().trim());
        }
      }
    }, (error) => {
      // Safely fallback if Firestore rules block unauthenticated reads
      console.warn("Notice: Using default admin config:", error.message);
    });

    const unsubUserPasswords = onSnapshot(collection(db, 'user_passwords'), (snapshot) => {
      const passMap: Record<string, string> = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.email && data.password) {
          passMap[data.email.toLowerCase().trim()] = data.password.toString().trim();
        }
      });
      setCustomPasswords(passMap);
    }, (error) => {
      // Safely fallback if Firestore rules block unauthenticated reads
      console.warn("Notice: Using default user credentials:", error.message);
    });

    return () => {
      unsubAdmin();
      unsubUserPasswords();
    };
  }, []);

  // Listen to access request status if pendingUser is set
  useEffect(() => {
    if (!pendingUser?.email) {
      setRequestStatus('idle');
      return;
    }

    const q = query(collection(db, 'access_requests'), where('email', '==', pendingUser.email.toLowerCase().trim()));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        if (data.status === 'approved') {
          setRequestStatus('approved');
        } else if (data.status === 'rejected') {
          setRequestStatus('rejected');
        } else {
          setRequestStatus('pending');
        }
      } else {
        setRequestStatus('idle');
      }
    });

    return () => unsubscribe();
  }, [pendingUser]);

  // Default & Dynamic Passwords Map
  const DEFAULT_PASSWORDS: Record<string, string> = {
    'amaldas.co@gmail.com': 'amal123',
    'salurinshan9539@gmail.com': 'rinshan123',
    'shahalmuhammed404@gmail.com': 'shahal123',
    'team.nyghto@gmail.com': '1111'
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setAdminPasswordError('');
    clearUnauthorizedError();
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userEmail = result.user?.email?.toLowerCase().trim() || '';

      // All team users (or admins) are prompted for their security password
      setPendingAdminUser(result.user);
      setShowAdminPasswordModal(true);
      setAdminPasswordInput('');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = adminPasswordInput.trim();
    const email = pendingAdminUser?.email?.toLowerCase().trim() || '';

    // Determine expected password for this specific user:
    let expectedPassword = customPasswords[email] || DEFAULT_PASSWORDS[email];
    if (email === 'team.nyghto@gmail.com') {
      expectedPassword = customPasswords[email] || adminPin || '1111';
    }

    // If no specific password configured, default to '1111'
    if (!expectedPassword) {
      expectedPassword = customPasswords[email] || adminPin || '1111';
    }

    if (cleanInput === expectedPassword) {
      setShowAdminPasswordModal(false);
      setPendingAdminUser(null);
      navigate('/');
    } else {
      setAdminPasswordError(`Incorrect password for ${email}! Please enter your valid password.`);
    }
  };

  const handleCancelAdminLogin = async () => {
    setShowAdminPasswordModal(false);
    setPendingAdminUser(null);
    setAdminPasswordInput('');
    setAdminPasswordError('');
    await signOut(auth);
  };

  const handleSendRequest = async () => {
    if (!pendingUser) return;
    setSendingRequest(true);
    try {
      await requestAccess(pendingUser);
      setRequestStatus('pending');
    } catch (err: any) {
      setError("Failed to send request: " + err.message);
    } finally {
      setSendingRequest(false);
    }
  };

  const activeError = error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-bg px-4 py-8">
      <div className="glass-card p-8 w-full max-w-md border border-white/10 shadow-2xl relative">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded mx-auto mb-4 bg-gradient-to-br from-nyghto-orange to-nyghto-yellow flex items-center justify-center font-bold text-white text-xl shadow-[0_0_15px_rgba(255,107,0,0.5)]">
            N
          </div>
          <h2 className="text-2xl font-bold text-theme-text">Nyghto OS</h2>
          <p className="text-theme-muted text-sm mt-1">Enterprise Workspace & Collaboration</p>
        </div>

        {activeError && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium leading-relaxed animate-in fade-in">
            {activeError}
          </div>
        )}

        {/* If user logged in with an un-whitelisted Gmail, show the Request Access Card */}
        {pendingUser ? (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
              {pendingUser.photoURL ? (
                <img src={pendingUser.photoURL} alt={pendingUser.name} className="w-12 h-12 rounded-full object-cover border border-white/20" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-nyghto-orange/20 text-nyghto-orange border border-nyghto-orange/30 flex items-center justify-center font-bold text-lg">
                  {pendingUser.name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="overflow-hidden flex-1">
                <div className="text-sm font-bold text-white truncate">{pendingUser.name}</div>
                <div className="text-xs text-gray-400 font-mono truncate">{pendingUser.email}</div>
              </div>
            </div>

            {requestStatus === 'approved' ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Access Approved!</span>
                </div>
                <p className="text-xs text-gray-300">
                  The Super Admin has accepted your request. Click below to enter Nyghto OS.
                </p>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium"
                >
                  <ArrowRight className="w-4 h-4" /> Enter Workspace
                </button>
              </div>
            ) : requestStatus === 'pending' ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-sm">
                  <Clock className="w-5 h-5 animate-spin" />
                  <span>Request Sent to Admin!</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Your access request is waiting for review. As soon as the Super Admin (<span className="text-nyghto-orange font-mono">team.nyghto@gmail.com</span>) clicks <b>Accept</b>, you will gain instant access.
                </p>
                <div className="text-[11px] text-gray-500 flex items-center justify-center gap-1.5 pt-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Listening for live approval...</span>
                </div>
              </div>
            ) : requestStatus === 'rejected' ? (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-sm">
                  <XCircle className="w-5 h-5" />
                  <span>Access Request Declined</span>
                </div>
                <p className="text-xs text-gray-400">
                  Your previous request was declined. You can resubmit an access request.
                </p>
                <button
                  onClick={handleSendRequest}
                  disabled={sendingRequest}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-2 text-sm"
                >
                  <Send className="w-4 h-4" /> Resubmit Access Request
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl text-xs text-gray-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    This account is not yet on the team whitelist. You can send an access request to the Super Admin now.
                  </span>
                </div>

                <button
                  onClick={handleSendRequest}
                  disabled={sendingRequest}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold shadow-lg"
                >
                  <Send className="w-4 h-4" />
                  {sendingRequest ? 'Sending Request...' : 'Send Access Request to Admin'}
                </button>
              </div>
            )}

            <button
              onClick={() => {
                clearPendingUser();
                clearUnauthorizedError();
              }}
              className="w-full text-center text-xs text-gray-400 hover:text-white py-2 transition-colors"
            >
              Use a different Google account
            </button>
          </div>
        ) : (
          <div>
            <button 
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 flex items-center justify-center gap-3 py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-md"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {loading ? 'Processing...' : 'Continue with Google'}
            </button>
          </div>
        )}

      </div>

      {/* Admin Password Verification Modal */}
      {showAdminPasswordModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="glass-card w-full max-w-sm p-6 relative border border-nyghto-orange/40 shadow-[0_0_30px_rgba(255,107,0,0.2)] animate-in zoom-in-95 rounded-2xl">
            <button
              onClick={handleCancelAdminLogin}
              className="absolute right-4 top-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Cancel"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-nyghto-orange/20 border border-nyghto-orange/30 text-nyghto-orange flex items-center justify-center mb-3 shadow-lg">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Security Password</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-[260px]">
                Enter your security password to access the Nyghto OS workspace.
              </p>
              {pendingAdminUser && (
                <div className="mt-2 text-[11px] text-nyghto-orange font-mono bg-nyghto-orange/10 px-2.5 py-1 rounded border border-nyghto-orange/20">
                  {pendingAdminUser.email}
                </div>
              )}
            </div>

            {adminPasswordError && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium animate-shake">
                {adminPasswordError}
              </div>
            )}

            <form onSubmit={handleVerifyAdminPassword} className="space-y-4">
              <div>
                <input
                  type="password"
                  autoFocus
                  maxLength={30}
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    setAdminPasswordError('');
                  }}
                  placeholder="Enter password"
                  className="w-full text-center text-lg tracking-[0.2em] font-mono py-3 bg-nyghto-dark/90 border border-white/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-nyghto-orange focus:ring-1 focus:ring-nyghto-orange shadow-inner"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancelAdminLogin}
                  className="w-1/2 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!adminPasswordInput}
                  className="w-1/2 btn-primary py-2.5 text-xs font-bold rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
