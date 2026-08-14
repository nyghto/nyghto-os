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
}

const HARDCODED_TEAM_MEMBERS: TeamMember[] = [
  { id: 'u1', name: 'RINSHAN', role: 'CEO', initial: 'R', color: 'bg-nyghto-orange', phone: '+91 9539202847', email: 'salurinshan9539@gmail.com', avatarImage: '/rinshan.jpg' },
  { id: 'u2', name: 'AMAL', role: 'CTO', initial: 'A', color: 'bg-blue-500', phone: '+91 7012028379', email: 'amaldas.co@gmail.com', avatarImage: '/amal.jpg' },
  { id: 'u3', name: 'SHAHAL', role: 'CPO', initial: 'S', color: 'bg-green-500', phone: '+91 8075911860', email: 'shahalmuhammed404@gmail.com', avatarImage: '/shahal.jpg' },
];

interface TeamContextType {
  teamMembers: TeamMember[];
  updateMemberAvatar: (id: string, avatarImage: string) => void;
}

const TeamContext = createContext<TeamContextType>({ 
  teamMembers: HARDCODED_TEAM_MEMBERS,
  updateMemberAvatar: () => {} 
});

export const useTeam = () => useContext(TeamContext);

export const TeamProvider = ({ children }: { children: React.ReactNode }) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(HARDCODED_TEAM_MEMBERS);

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
