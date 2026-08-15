import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { CORE_EMAILS, getUserRole, getUserName } from '../utils/permissions';

interface UserData {
  role: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  unauthorizedError: string | null;
  clearUnauthorizedError: () => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  userData: null, 
  loading: true,
  unauthorizedError: null,
  clearUnauthorizedError: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorizedError, setUnauthorizedError] = useState<string | null>(null);

  const clearUnauthorizedError = () => setUnauthorizedError(null);

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
          await signOut(auth);
          setUser(null);
          setUserData(null);
          setUnauthorizedError(`Access Denied: "${email}" is not authorized. Please ask an administrator to add your Gmail to the workspace whitelist.`);
          setLoading(false);
          return;
        }

        setUnauthorizedError(null);
        setUser(currentUser);

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

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading, unauthorizedError, clearUnauthorizedError }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
