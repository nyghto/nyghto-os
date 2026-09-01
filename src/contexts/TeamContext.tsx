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
  duty?: string; // Legacy string
  duties?: string[]; // Array of multiple duties e.g. ["Social Media Controller", "Ads Running", "Financial Control"]
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
  { id: 'u1', name: 'RINSHAN', role: 'CEO', duties: ['Nyra OS Operator'], initial: 'R', color: 'bg-nyghto-orange', phone: '+91 9539202847', email: 'salurinshan9539@gmail.com', avatarImage: '/rinshan.jpg' },
  { id: 'u2', name: 'AMAL', role: 'CTO', duties: ['Social Media Controller'], initial: 'A', color: 'bg-blue-500', phone: '+91 7012028379', email: 'amaldas.co@gmail.com', avatarImage: '/amal.jpg' },
  { id: 'u3', name: 'SHAHAL', role: 'CPO', duties: [], initial: 'S', color: 'bg-green-500', phone: '+91 8075911860', email: 'shahalmuhammed404@gmail.com', avatarImage: '/shahal.jpg' },
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

        const rawDuties = Array.isArray(data.duties) 
          ? data.duties 
          : (data.duty !== undefined ? (data.duty ? [data.duty] : []) : undefined);

        return {
          id: memberId,
          name: name.toUpperCase(),
          role: data.role || 'Employee',
          duty: rawDuties && rawDuties.length > 0 ? rawDuties[0] : undefined,
          duties: rawDuties,
          initial: name.charAt(0).toUpperCase() || 'M',
          color: bgClass,
          phone: data.phone || '+91 0000000000',
          email: email,
          avatarImage: data.avatarImage || undefined,
          customColorKey: colorKey
        };
      });

      // Map authorized_emails overrides onto BASE_FOUNDERS, and append extra dynamic members
      const updatedFounders = BASE_FOUNDERS.map(f => {
        const foundDoc = snapshot.docs.find(d => d.data().email?.toLowerCase() === f.email.toLowerCase());
        if (foundDoc) {
          const data = foundDoc.data();
          const colorKey = data.color || 'emerald';
          const docDuties = Array.isArray(data.duties) 
            ? data.duties 
            : (data.duty !== undefined ? (data.duty ? [data.duty] : []) : f.duties);

          return {
            ...f,
            name: (data.name || f.name).toUpperCase(),
            role: data.role || f.role,
            duty: docDuties && docDuties.length > 0 ? docDuties[0] : undefined,
            duties: docDuties,
            color: COLOR_MAP[colorKey] || f.color,
            customColorKey: colorKey
          };
        }
        return f;
      });

      const combined = [...updatedFounders];
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
