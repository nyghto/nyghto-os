import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { CORE_EMAILS, getUserRole, getUserName } from '../utils/permissions';

export const getMemberIdByEmail = (email: string | null | undefined): string => {
  if (!email) return 'unknown';
  const lower = email.toLowerCase().trim();
  if (lower === 'salurinshan9539@gmail.com') return 'u1';
  if (lower === 'amaldas.co@gmail.com') return 'u2';
  if (lower === 'shahalmuhammed404@gmail.com') return 'u3';
  return lower.replace(/[@.]/g, '_');
};

interface UserData {
  role: string;
  name: string;
}

export interface PendingUser {
  email: string;
  name: string;
  photoURL?: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  unauthorizedError: string | null;
  pendingUser: PendingUser | null;
  clearUnauthorizedError: () => void;
  clearPendingUser: () => void;
  requestAccess: (userObj: PendingUser) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  userData: null, 
  loading: true,
  unauthorizedError: null,
  pendingUser: null,
  clearUnauthorizedError: () => {},
  clearPendingUser: () => {},
  requestAccess: async () => {},
  logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorizedError, setUnauthorizedError] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);

  const clearUnauthorizedError = () => setUnauthorizedError(null);
  const clearPendingUser = () => setPendingUser(null);

  const requestAccess = async (userObj: PendingUser) => {
    const cleanEmail = userObj.email.toLowerCase().trim();
    if (!cleanEmail) return;

    try {
      const q = query(collection(db, 'access_requests'), where('email', '==', cleanEmail));
      const snap = await getDocs(q);

      if (!snap.empty) {
        // Update existing request
        await setDoc(doc(db, 'access_requests', snap.docs[0].id), {
          email: cleanEmail,
          name: userObj.name || cleanEmail.split('@')[0],
          photoURL: userObj.photoURL || '',
          status: 'pending',
          requestedAt: serverTimestamp()
        }, { merge: true });
      } else {
        // Create new request
        await addDoc(collection(db, 'access_requests'), {
          email: cleanEmail,
          name: userObj.name || cleanEmail.split('@')[0],
          photoURL: userObj.photoURL || '',
          status: 'pending',
          requestedAt: serverTimestamp()
        });
      }

      await addDoc(collection(db, 'activities'), {
        text: `${userObj.name || cleanEmail} requested access to Nyghto OS`,
        type: 'general',
        iconColor: 'text-amber-400',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error submitting access request:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const email = currentUser.email?.toLowerCase().trim() || '';
        const isCore = CORE_EMAILS.includes(email);
        let isAllowed = isCore;
        let assignedRole = isCore ? getUserRole(email) : 'Employee';
        let assignedName = isCore ? getUserName(email) : (currentUser.displayName || email.split('@')[0]);

        if (!isAllowed) {
          try {
            const q = query(collection(db, 'authorized_emails'), where('email', '==', email));
            const snap = await getDocs(q);
            if (!snap.empty) {
              isAllowed = true;
              const docData = snap.docs[0].data();
              if (docData.role) assignedRole = docData.role;
              if (docData.name) assignedName = docData.name;
            }
          } catch (err) {
            console.error("Error checking authorized email:", err);
          }
        }

        if (!isAllowed) {
          setPendingUser({
            email,
            name: currentUser.displayName || email.split('@')[0],
            photoURL: currentUser.photoURL || undefined
          });
          await signOut(auth);
          setUser(null);
          setUserData(null);
          setUnauthorizedError(`Access Pending: "${email}" is not currently in the authorized whitelist.`);
          setLoading(false);
          return;
        }

        setPendingUser(null);
        setUnauthorizedError(null);
        setUser(currentUser);

        // Automatic Presence: Set user as Active
        const memberId = getMemberIdByEmail(email);
        try {
          await setDoc(doc(db, 'teamStatus', memberId), {
            status: 'Active',
            lastActive: Date.now(),
            email,
            name: assignedName
          }, { merge: true });
        } catch (e) {
          console.error("Error setting presence:", e);
        }

        // Fetch or create user doc
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            setUserData(userSnap.data() as UserData);
          } else {
            const newUserData = { role: assignedRole, name: assignedName };
            await setDoc(userRef, newUserData);
            setUserData(newUserData);
          }
        } catch (err) {
          console.error("Error saving user doc:", err);
          setUserData({ role: assignedRole, name: assignedName });
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    // Heartbeat to keep status Active
    const heartbeatInterval = setInterval(() => {
      if (auth.currentUser?.email) {
        const currentEmail = auth.currentUser.email.toLowerCase().trim();
        const mid = getMemberIdByEmail(currentEmail);
        setDoc(doc(db, 'teamStatus', mid), {
          status: 'Active',
          lastActive: Date.now(),
          email: currentEmail
        }, { merge: true }).catch(() => {});
      }
    }, 20000);

    const handleBeforeUnload = () => {
      if (auth.currentUser?.email) {
        const currentEmail = auth.currentUser.email.toLowerCase().trim();
        const mid = getMemberIdByEmail(currentEmail);
        setDoc(doc(db, 'teamStatus', mid), {
          status: 'Inactive',
          lastActive: Date.now(),
          email: currentEmail
        }, { merge: true }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const logout = async () => {
    if (user?.email) {
      const mid = getMemberIdByEmail(user.email);
      try {
        await setDoc(doc(db, 'teamStatus', mid), {
          status: 'Inactive',
          lastActive: Date.now(),
          email: user.email
        }, { merge: true });
      } catch (e) {}
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, unauthorizedError, clearUnauthorizedError, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
