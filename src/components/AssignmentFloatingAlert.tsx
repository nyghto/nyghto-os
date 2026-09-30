import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckSquare, Briefcase, ArrowRight, X, Sparkles, 
  Clock, Shield, ArrowUpRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTeam } from '../contexts/TeamContext';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { Activity } from '../types';

export function AssignmentFloatingAlert() {
  const { user, userData } = useAuth();
  const { teamMembers } = useTeam();
  const navigate = useNavigate();

  const [activeItem, setActiveItem] = useState<Activity | null>(null);

  const userEmail = (user?.email || '').toLowerCase().trim();
  const currentMember = teamMembers.find(
    m => m.email?.toLowerCase().trim() === userEmail
  );
  const currentMemberId = currentMember?.id || '';
  const currentMemberName = (currentMember?.name || userData?.name || '').toLowerCase().trim();

  useEffect(() => {
    if (!userEmail) return;

    // Listen to recent activities to find newly added task or project for this user
    const q = query(collection(db, 'activities'), orderBy('createdAt', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Activity[];

      const unacknowledged = activities.find(act => {
        if (act.type !== 'task' && act.type !== 'project') return false;

        const seenList = act.seenBy || [];
        if (seenList.includes(userEmail)) return false;

        const localSeen = localStorage.getItem(`nyghto_seen_activity_${userEmail}_${act.id}`);
        if (localSeen) return false;

        // Match target:
        if (act.targetUserEmail && act.targetUserEmail.toLowerCase().trim() === userEmail) {
          return true;
        }

        if (act.targetUserId && currentMemberId) {
          const ids = act.targetUserId.split(',').map(s => s.trim().toLowerCase());
          if (ids.includes(currentMemberId.toLowerCase())) {
            return true;
          }
        }

        if (act.targetUserName && currentMemberName) {
          const names = act.targetUserName.split(',').map(s => s.trim().toLowerCase());
          if (names.includes(currentMemberName)) {
            return true;
          }
        }

        if (currentMemberName && (
          act.text.toLowerCase().includes(`assigned to ${currentMemberName}`) ||
          act.text.toLowerCase().includes(`assigned to: ${currentMemberName}`)
        )) {
          return true;
        }

        return false;
      });

      if (unacknowledged) {
        setActiveItem(unacknowledged);
      } else {
        setActiveItem(null);
      }
    });

    return () => unsubscribe();
  }, [userEmail, currentMemberId, currentMemberName]);

  const handleDismiss = async () => {
    if (!activeItem) return;
    const itemId = activeItem.id;
    localStorage.setItem(`nyghto_seen_activity_${userEmail}_${itemId}`, 'true');
    setActiveItem(null);

    try {
      await updateDoc(doc(db, 'activities', itemId), {
        seenBy: arrayUnion(userEmail)
      });
    } catch (e) {
      console.error("Error updating seen state:", e);
    }
  };

  const handleOpenItem = () => {
    if (!activeItem) return;
    const type = activeItem.type;
    handleDismiss();
    if (type === 'task') {
      navigate('/tasks');
    } else {
      navigate('/projects');
    }
  };

  if (!activeItem) return null;

  const isTask = activeItem.type === 'task';
  const itemName = activeItem.assignedEntityName || (isTask ? 'New Task' : 'New Project');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          // Sleek, shorter modal card (~540px width max, auto height)
          className={`w-full max-w-[540px] rounded-2xl overflow-hidden relative border shadow-[0_20px_60px_rgba(0,0,0,0.6)] bg-[#121316] ${
            isTask 
              ? 'border-orange-500/30' 
              : 'border-blue-500/30'
          }`}
        >
          {/* Accent top hairline strip */}
          <div className={`h-1.5 w-full ${
            isTask 
              ? 'bg-gradient-to-r from-nyghto-orange via-amber-400 to-yellow-500' 
              : 'bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500'
          }`} />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute right-4 top-4 text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors z-10"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content Container */}
          <div className="p-6 space-y-4">
            {/* Header info row */}
            <div className="flex items-start gap-3.5 pr-8">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                isTask 
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25' 
                  : 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
              }`}>
                {isTask ? <CheckSquare className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isTask 
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' 
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    New {isTask ? 'Task' : 'Project'}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Just assigned to you
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mt-1 leading-snug line-clamp-2">
                  {itemName}
                </h3>
              </div>
            </div>

            {/* Description card */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-gray-300 space-y-2">
              <p className="leading-relaxed font-medium text-gray-200">
                {activeItem.text}
              </p>
              
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-nyghto-orange" />
                  <span className="font-mono text-gray-300">{userEmail}</span>
                </span>
                <span className="flex items-center gap-1 text-gray-400 font-mono">
                  <Clock className="w-3 h-3" />
                  Real-time
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDismiss}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Dismiss
              </button>

              <button
                type="button"
                onClick={handleOpenItem}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5 transition-all ${
                  isTask 
                    ? 'bg-nyghto-orange hover:bg-orange-600' 
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                <span>View {isTask ? 'Task' : 'Project'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
