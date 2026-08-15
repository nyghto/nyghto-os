import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  initial: string;
  color: string;
  phone: string;
  email: string;
  avatarImage?: string; // Base64 image
  customColorKey?: string;
}

const COLOR_MAP: Record<string, string> = {
  orange: 'bg-nyghto-orange',
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  purple: 'bg-purple-500',
  yellow: 'bg-yellow-500',
  rose: 'bg-rose-500',
  cyan: 'bg-cyan-500',
  indigo: 'bg-indigo-500',
};

const BASE_FOUNDERS: TeamMember[] = [
  { id: 'u1', name: 'SALU RINSHAN', role: 'CEO', initial: 'S', color: 'bg-nyghto-orange', phone: '+91 9539202847', email: 'salurinshan9539@gmail.com', avatarImage: '/rinshan.jpg' },
  { id: 'u2', name: 'AMAL DAS', role: 'CTO', initial: 'A', color: 'bg-blue-500', phone: '+91 7012028379', email: 'amaldas.co@gmail.com', avatarImage: '/amal.jpg' },
  { id: 'u3', name: 'SHAHAL MUHAMMED', role: 'CPO', initial: 'S', color: 'bg-green-500', phone: '+91 8075911860', email: 'shahalmuhammed404@gmail.com', avatarImage: '/shahal.jpg' },
];

interface TeamContextType {
  teamMembers: TeamMember[];
  updateMemberAvatar: (id: string, avatarImage: string) => void;
}

const TeamContext = createContext<TeamContextType>({ 
  teamMembers: BASE_FOUNDERS,
  updateMemberAvatar: () => {} 
});

export const useTeam = () => useContext(TeamContext);

export const TeamProvider = ({ children }: { children: React.ReactNode }) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(BASE_FOUNDERS);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'authorized_emails'), (snapshot) => {
      const dynamicMembers: TeamMember[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const email = data.email || '';
        const name = data.name || email.split('@')[0] || 'Member';
        const colorKey = data.color || 'emerald';
        const bgClass = COLOR_MAP[colorKey] || 'bg-emerald-500';
        const memberId = email ? email.toLowerCase().trim().replace(/[@.]/g, '_') : docSnap.id;

        return {
          id: memberId,
          name: name.toUpperCase(),
          role: data.role || 'Employee',
          initial: name.charAt(0).toUpperCase() || 'M',
          color: bgClass,
          phone: data.phone || '+91 0000000000',
          email: email,
          avatarImage: data.avatarImage || undefined,
          customColorKey: colorKey
        };
      });

      // Combine base founders + dynamic members without duplicates
      const combined = [...BASE_FOUNDERS];
      dynamicMembers.forEach(dm => {
        if (!combined.some(f => f.email.toLowerCase() === dm.email.toLowerCase())) {
          combined.push(dm);
        }
      });

      setTeamMembers(combined);
    });

    return () => unsubscribe();
  }, []);

  const updateMemberAvatar = (id: string, avatarImage: string) => {
    setTeamMembers(prev => 
      prev.map(member => 
        member.id === id ? { ...member, avatarImage } : member
      )
    );
  };

  return (
    <TeamContext.Provider value={{ teamMembers, updateMemberAvatar }}>
      {children}
    </TeamContext.Provider>
  );
};
