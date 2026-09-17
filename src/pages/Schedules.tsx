import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, Clock, Plus, Video, CheckCircle2, 
  AlertCircle, ChevronLeft, ChevronRight, Users, Trash2, Edit3, 
  ExternalLink, FileText, Bell, Sparkles, X, Check, Filter,
  Globe, MapPin, MessageCircle, Building2, Navigation, Link as LinkIcon,
  UserCheck, Lock, CheckCircle
} from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp, query, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTeam } from '../contexts/TeamContext';
import { hasAdminAccess, isSuperAdmin, getUserName } from '../utils/permissions';
import type { Schedule } from '../types';

const getLocalDateStr = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  return dateStr;
};

export default function Schedules() {
  const { user, userData } = useAuth();
  const { teamMembers } = useTeam();
  // STRICT ADMIN CHECK: Only Super Admin (team.nyghto@gmail.com) can schedule, edit, delete, or close events
  const isMainAdmin = isSuperAdmin(user?.email);
  const currentUserName = getUserName(user?.email, userData?.name);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'online' | 'offline'>('all');
  const [filterDateTab, setFilterDateTab] = useState<'today' | 'tomorrow' | 'upcoming' | 'all'>('upcoming');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // Admin Delete Password Modal State
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null);
  const [deletePassInput, setDeletePassInput] = useState('');
  const [deletePassError, setDeletePassError] = useState('');
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<Schedule['type']>('meeting');
  const [date, setDate] = useState(getLocalDateStr());
  const [time, setTime] = useState('10:00');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Schedule['priority']>('Medium');
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);

  // Online / Offline states
  const [mode, setMode] = useState<'online' | 'offline'>('online');
  const [onlinePlatform, setOnlinePlatform] = useState<Schedule['onlinePlatform']>('google_meet');
  const [meetLink, setMeetLink] = useState('');
  const [offlineVenue, setOfflineVenue] = useState<'office' | 'other'>('office');
  const [offlineLocationName, setOfflineLocationName] = useState('');
  const [offlineLocationLink, setOfflineLocationLink] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Firestore Realtime Subscription
  useEffect(() => {
    const q = query(collection(db, 'schedules'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Schedule[];
      setSchedules(items);
    });

    return () => unsub();
  }, []);

  const todayStr = getLocalDateStr();
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = getLocalDateStr(tomorrowObj);

  // Quick preset dates helper
  const setQuickDate = (target: 'today' | 'tomorrow') => {
    if (target === 'today') setDate(todayStr);
    if (target === 'tomorrow') setDate(tomorrowStr);
  };

  const resetForm = () => {
    setTitle('');
    setType('meeting');
    setDate(todayStr);
    setTime('10:00');
    setDescription('');
    setPriority('Medium');
    setSelectedAttendees([]);
    setMode('online');
    setOnlinePlatform('google_meet');
    setMeetLink('');
    setOfflineVenue('office');
    setOfflineLocationName('');
    setOfflineLocationLink('');
    setEditingSchedule(null);
  };

  const handleOpenAdd = () => {
    if (!isMainAdmin) {
      alert("Permission Denied: Only admins can schedule events.");
      return;
    }
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sch: Schedule) => {
    if (!isMainAdmin) {
      alert("Permission Denied: Only admins can edit scheduled events.");
      return;
    }
    setEditingSchedule(sch);
    setTitle(sch.title || '');
    setType(sch.type || 'meeting');
    setDate(sch.date || todayStr);
    setTime(sch.time || '10:00');
    setDescription(sch.description || '');
    setPriority(sch.priority || 'Medium');
    setSelectedAttendees(sch.attendees || []);
    setMode(sch.mode || (sch.meetLink ? 'online' : 'online'));
    setOnlinePlatform(sch.onlinePlatform || 'google_meet');
    setMeetLink(sch.meetLink || '');
    setOfflineVenue(sch.offlineVenue || 'office');
    setOfflineLocationName(sch.offlineLocationName || '');
    setOfflineLocationLink(sch.offlineLocationLink || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMainAdmin) {
      alert("Permission Denied: Only admins can schedule events.");
      return;
    }
    if (!title.trim() || !date) return;

    setIsSubmitting(true);
    try {
      const rawPayload: any = {
        title: title.trim(),
        type,
        date,
        time: time || '10:00',
        description: description.trim() || '',
        priority: priority || 'Medium',
        attendees: selectedAttendees || [],
        mode,
        onlinePlatform: mode === 'online' ? (onlinePlatform || 'google_meet') : null,
        meetLink: mode === 'online' ? meetLink.trim() : '',
        offlineVenue: mode === 'offline' ? (offlineVenue || 'office') : null,
        offlineLocationName: mode === 'offline' ? (offlineVenue === 'office' ? 'Nyghto Office HQ' : offlineLocationName.trim()) : '',
        offlineLocationLink: mode === 'offline' ? (offlineVenue === 'other' ? offlineLocationLink.trim() : '') : ''
      };

      // Strip any undefined keys so Firestore doesn't throw unsupported field value errors
      const payload: Record<string, any> = {};
      Object.keys(rawPayload).forEach(key => {
        if (rawPayload[key] !== undefined) {
          payload[key] = rawPayload[key];
        }
      });

      if (editingSchedule) {
        await updateDoc(doc(db, 'schedules', editingSchedule.id), {
          ...payload,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'schedules'), {
          ...payload,
          status: 'scheduled',
          createdBy: currentUserName,
          createdByEmail: user?.email || '',
          createdAt: serverTimestamp()
        });

        // Add activity log
        await addDoc(collection(db, 'activities'), {
          text: `${currentUserName} scheduled ${mode} ${type}: "${title.trim()}" for ${formatDisplayDate(date)}`,
          type: 'general',
          iconColor: 'text-nyghto-orange',
          createdAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error("Error saving schedule:", err);
      alert("Failed to save schedule: " + (err as any)?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSchedule = async (sch: Schedule) => {
    if (!isMainAdmin) {
      alert("Only admins can close or reopen scheduled events.");
      return;
    }
    try {
      const isCurrentlyClosed = sch.status === 'completed';
      const nextStatus = isCurrentlyClosed ? 'scheduled' : 'completed';
      await updateDoc(doc(db, 'schedules', sch.id), {
        status: nextStatus,
        closedBy: isCurrentlyClosed ? null : currentUserName,
        closedAt: isCurrentlyClosed ? null : serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error closing schedule:", err);
    }
  };

  const handleToggleAttended = async (sch: Schedule) => {
    if (!user?.email) return;
    const userEmailClean = user.email.toLowerCase().trim();
    const hasAttended = sch.attendedBy?.includes(userEmailClean);

    try {
      if (hasAttended) {
        // Unmark attendance: remove email and user object
        const updatedUsers = (sch.attendedUsers || []).filter(u => u.email.toLowerCase().trim() !== userEmailClean);
        await updateDoc(doc(db, 'schedules', sch.id), {
          attendedBy: arrayRemove(userEmailClean),
          attendedUsers: updatedUsers,
          updatedAt: serverTimestamp()
        });
      } else {
        // Mark attendance: add email and user info
        const newAttendee = {
          email: userEmailClean,
          name: currentUserName,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        const updatedUsers = [...(sch.attendedUsers || []).filter(u => u.email.toLowerCase().trim() !== userEmailClean), newAttendee];

        await updateDoc(doc(db, 'schedules', sch.id), {
          attendedBy: arrayUnion(userEmailClean),
          attendedUsers: updatedUsers,
          updatedAt: serverTimestamp()
        });

        // Add activity log
        await addDoc(collection(db, 'activities'), {
          text: `${currentUserName} attended scheduled event: "${sch.title}"`,
          type: 'general',
          iconColor: 'text-emerald-400',
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Error toggling attendance:", err);
      alert("Could not update attendance: " + (err as any)?.message);
    }
  };

  const promptDeleteSchedule = (sch: Schedule) => {
    if (!isMainAdmin) {
      alert("Only admins can delete scheduled events.");
      return;
    }
    setDeletingSchedule(sch);
    setDeletePassInput('');
    setDeletePassError('');
  };

  const confirmDeleteScheduleWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingSchedule || !isMainAdmin) return;

    setDeletePassError('');
    setIsDeletingLoading(true);

    try {
      let expectedPass = '9999';

      // Check admin_config deletePin from database
      const adminDoc = await getDoc(doc(db, 'settings', 'admin_config'));
      if (adminDoc.exists() && adminDoc.data().deletePin) {
        expectedPass = adminDoc.data().deletePin.toString().trim();
      }

      if (deletePassInput.trim() !== expectedPass) {
        setDeletePassError('Incorrect Admin Delete Password! Event was not deleted.');
        setIsDeletingLoading(false);
        return;
      }

      // Password verified! Delete the schedule
      await deleteDoc(doc(db, 'schedules', deletingSchedule.id));

      await addDoc(collection(db, 'activities'), {
        text: `${currentUserName} deleted schedule: "${deletingSchedule.title}"`,
        type: 'general',
        iconColor: 'text-red-400',
        createdAt: serverTimestamp()
      });

      setDeletingSchedule(null);
      setDeletePassInput('');
    } catch (err: any) {
      console.error("Error deleting schedule:", err);
      setDeletePassError(err.message || 'Failed to delete schedule');
    } finally {
      setIsDeletingLoading(false);
    }
  };

  // Filtered schedules
  const filteredSchedules = schedules.filter(sch => {
    // Filter by type
    if (filterType !== 'all' && sch.type !== filterType) return false;

    // Filter by online / offline
    if (filterMode !== 'all') {
      const isSchOffline = sch.mode === 'offline';
      if (filterMode === 'offline' && !isSchOffline) return false;
      if (filterMode === 'online' && isSchOffline) return false;
    }

    // Filter by date range tab
    if (filterDateTab === 'today') {
      return sch.date === todayStr;
    }
    if (filterDateTab === 'tomorrow') {
      return sch.date === tomorrowStr;
    }
    if (filterDateTab === 'upcoming') {
      return sch.date >= todayStr;
    }
    return true;
  });

  const getTypeBadge = (t: Schedule['type']) => {
    switch (t) {
      case 'meeting':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30"><Video className="w-3.5 h-3.5" /> Meeting</span>;
      case 'update':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"><Sparkles className="w-3.5 h-3.5" /> Update</span>;
      case 'report':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30"><FileText className="w-3.5 h-3.5" /> Report</span>;
      case 'deadline':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30"><AlertCircle className="w-3.5 h-3.5" /> Deadline</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-300 border border-gray-500/30"><Clock className="w-3.5 h-3.5" /> Other</span>;
    }
  };

  const getPriorityBadge = (p?: string) => {
    switch (p) {
      case 'Urgent':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">Urgent</span>;
      case 'High':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">High</span>;
      case 'Medium':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Medium</span>;
      case 'Low':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Low</span>;
      default:
        return null;
    }
  };

  const getOnlinePlatformLabel = (platform?: string) => {
    switch (platform) {
      case 'whatsapp': return { name: 'WhatsApp Call/Group', icon: MessageCircle, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      case 'google_meet': return { name: 'Google Meet', icon: Video, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
      case 'zoom': return { name: 'Zoom Meeting', icon: Video, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };
      case 'teams': return { name: 'Microsoft Teams', icon: Video, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' };
      default: return { name: 'Online Meeting', icon: Globe, color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' };
    }
  };

  const todayCount = schedules.filter(s => s.date === todayStr && s.status !== 'completed').length;
  const tomorrowCount = schedules.filter(s => s.date === tomorrowStr && s.status !== 'completed').length;
  const upcomingCount = schedules.filter(s => s.date >= todayStr && s.status !== 'completed').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CalendarIcon className="w-7 h-7 text-nyghto-orange" />
            Schedules & Agendas
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Plan meetings, next-day updates, report submissions, and online/offline locations.
          </p>
        </div>

        {isMainAdmin && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-nyghto-orange hover:bg-orange-600 text-white font-medium shadow-lg shadow-nyghto-orange/20 transition-all cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            Schedule Event
          </button>
        )}
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div 
          onClick={() => setFilterDateTab('today')}
          className={`p-4 rounded-xl glass-card border transition-all cursor-pointer ${
            filterDateTab === 'today' ? 'border-nyghto-orange bg-nyghto-orange/10' : 'border-white/5 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">Today's Schedule</span>
            <div className="p-2 rounded-lg bg-nyghto-orange/20 text-nyghto-orange">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{todayCount}</span>
            <span className="text-xs text-gray-400">active events</span>
          </div>
        </div>

        <div 
          onClick={() => setFilterDateTab('tomorrow')}
          className={`p-4 rounded-xl glass-card border transition-all cursor-pointer ${
            filterDateTab === 'tomorrow' ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">Next Day (Tomorrow)</span>
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{tomorrowCount}</span>
            <span className="text-xs text-gray-400">planned updates/meetings</span>
          </div>
        </div>

        <div 
          onClick={() => setFilterDateTab('upcoming')}
          className={`p-4 rounded-xl glass-card border transition-all cursor-pointer ${
            filterDateTab === 'upcoming' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">Total Upcoming</span>
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{upcomingCount}</span>
            <span className="text-xs text-gray-400">upcoming events</span>
          </div>
        </div>
      </div>

      {/* Filter and Date Tabs Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 rounded-xl glass-card border border-white/5">
        {/* Date Scope Pills */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5 overflow-x-auto">
          {[
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'today', label: 'Today' },
            { id: 'tomorrow', label: 'Tomorrow' },
            { id: 'all', label: 'All History' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterDateTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                filterDateTab === tab.id
                  ? 'bg-nyghto-orange text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Mode filter & Type filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Online / Offline Filter */}
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${filterMode === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              All Modes
            </button>
            <button
              onClick={() => setFilterMode('online')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${filterMode === 'online' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              <Globe className="w-3 h-3" />
              Online
            </button>
            <button
              onClick={() => setFilterMode('offline')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${filterMode === 'offline' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
            >
              <MapPin className="w-3 h-3" />
              Offline
            </button>
          </div>

          {/* Type Filter dropdown */}
          <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
            <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#12141a]">All Types</option>
              <option value="meeting" className="bg-[#12141a]">Meetings</option>
              <option value="update" className="bg-[#12141a]">Updates</option>
              <option value="report" className="bg-[#12141a]">Reports</option>
              <option value="deadline" className="bg-[#12141a]">Deadlines</option>
              <option value="other" className="bg-[#12141a]">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Schedule Items List */}
      <div className="space-y-3">
        {filteredSchedules.length === 0 ? (
          <div className="glass-card border border-white/5 rounded-2xl p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-nyghto-orange/10 flex items-center justify-center text-nyghto-orange mb-3">
              <CalendarIcon className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">No schedules found</h3>
            <p className="text-gray-400 text-sm mt-1 max-w-sm mx-auto">
              There are no matching schedules for this filter.
            </p>
            {isMainAdmin && (
              <button
                onClick={handleOpenAdd}
                className="mt-4 px-4 py-2 bg-nyghto-orange hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Schedule an Event
              </button>
            )}
          </div>
        ) : (
          filteredSchedules.map((sch) => {
            const isToday = sch.date === todayStr;
            const isTomorrow = sch.date === tomorrowStr;
            const isCompleted = sch.status === 'completed';
            const isOffline = sch.mode === 'offline';
            const onlineInfo = getOnlinePlatformLabel(sch.onlinePlatform);
            const PlatformIcon = onlineInfo.icon;

            return (
              <div
                key={sch.id}
                className={`glass-card rounded-xl p-4 sm:p-5 border transition-all ${
                  isCompleted 
                    ? 'opacity-60 border-white/5 bg-black/30' 
                    : isToday 
                    ? 'border-nyghto-orange/40 bg-nyghto-orange/[0.03] shadow-[0_0_15px_rgba(255,107,0,0.05)]' 
                    : isTomorrow
                    ? 'border-blue-500/30 bg-blue-500/[0.02]'
                    : 'border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 flex-1">
                    {/* Admin Close Schedule toggle on the left */}
                    {isMainAdmin ? (
                      <button
                        onClick={() => handleCloseSchedule(sch)}
                        className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-500 border-emerald-400 text-black'
                            : 'border-white/20 hover:border-nyghto-orange bg-black/40 text-transparent hover:text-white/40'
                        }`}
                        title={isCompleted ? 'Admin: Reopen this schedule' : 'Admin: Mark completed & close schedule'}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    ) : (
                      <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center border shrink-0 ${
                        isCompleted ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'border-white/10 bg-white/5 text-gray-500'
                      }`}>
                        {isCompleted ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      </div>
                    )}

                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getTypeBadge(sch.type)}
                        {getPriorityBadge(sch.priority)}

                        {/* Online or Offline Badge */}
                        {isOffline ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <MapPin className="w-3.5 h-3.5" />
                            Offline
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${onlineInfo.color}`}>
                            <PlatformIcon className="w-3.5 h-3.5" />
                            {onlineInfo.name}
                          </span>
                        )}

                        {/* Closed/Completed Status Badge */}
                        {isCompleted ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-600/30 text-gray-300 border border-gray-500/30">
                            CLOSED / COMPLETED
                          </span>
                        ) : isToday ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-nyghto-orange text-white animate-pulse">
                            TODAY
                          </span>
                        ) : isTomorrow ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">
                            TOMORROW
                          </span>
                        ) : null}

                        <span className="text-xs text-gray-400 font-mono">
                          {formatDisplayDate(sch.date)} {sch.time ? `• ${sch.time}` : ''}
                        </span>
                      </div>

                      <h3 className={`text-base font-bold transition-all ${isCompleted ? 'line-through text-gray-400' : 'text-white'}`}>
                        {sch.title}
                      </h3>

                      {sch.description && (
                        <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                          {sch.description}
                        </p>
                      )}

                      {/* Online Meeting Link or Offline Location Banner */}
                      {!isOffline && sch.meetLink && (
                        <div className="pt-1">
                          <a
                            href={sch.meetLink.startsWith('http') ? sch.meetLink : `https://${sch.meetLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-semibold border border-blue-500/30 transition-all shadow-sm"
                          >
                            <PlatformIcon className="w-4 h-4" />
                            Join {onlineInfo.name}
                            <ExternalLink className="w-3 h-3 ml-0.5" />
                          </a>
                        </div>
                      )}

                      {isOffline && (
                        <div className="pt-1 flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 text-xs font-medium border border-emerald-500/20">
                            {sch.offlineVenue === 'office' ? (
                              <>
                                <Building2 className="w-4 h-4 text-emerald-400" />
                                <span>Venue: <strong>Nyghto Office HQ</strong></span>
                              </>
                            ) : (
                              <>
                                <MapPin className="w-4 h-4 text-emerald-400" />
                                <span>Location: <strong>{sch.offlineLocationName || 'Offline Location'}</strong></span>
                              </>
                            )}
                          </div>

                          {sch.offlineLocationLink && (
                            <a
                              href={sch.offlineLocationLink.startsWith('http') ? sch.offlineLocationLink : `https://${sch.offlineLocationLink}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium border border-white/10 transition-all"
                            >
                              <Navigation className="w-3.5 h-3.5 text-nyghto-orange" />
                              View Map / Link
                              <ExternalLink className="w-3 h-3 ml-0.5" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Employee Attendance Button & Attended List */}
                      <div className="pt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/5">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Mark Attended button */}
                          {user?.email && (
                            <button
                              type="button"
                              onClick={() => handleToggleAttended(sch)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                sch.attendedBy?.includes(user.email.toLowerCase().trim())
                                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-sm'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              }`}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              {sch.attendedBy?.includes(user.email.toLowerCase().trim())
                                ? 'Attended ✓'
                                : 'Mark as Attended'}
                            </button>
                          )}

                          {/* Attended Count Badge */}
                          {sch.attendedBy && sch.attendedBy.length > 0 && (
                            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              {sch.attendedBy.length} {sch.attendedBy.length === 1 ? 'member' : 'members'} attended
                            </span>
                          )}
                        </div>

                        {/* Admin Close Button */}
                        {isMainAdmin && (
                          <button
                            type="button"
                            onClick={() => handleCloseSchedule(sch)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                              isCompleted
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                            }`}
                          >
                            <Lock className="w-3 h-3" />
                            {isCompleted ? 'Reopen Schedule' : 'Close Schedule'}
                          </button>
                        )}
                      </div>

                      {/* Who Attended (Names & Badges) */}
                      {sch.attendedBy && sch.attendedBy.length > 0 && (
                        <div className="pt-2 flex flex-wrap items-center gap-1.5 bg-black/20 p-2.5 rounded-lg border border-white/5">
                          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            Attended By:
                          </span>
                          {sch.attendedBy.map((attEmail) => {
                            // Find details from attendedUsers or teamMembers
                            const recordedUser = sch.attendedUsers?.find(u => u.email.toLowerCase().trim() === attEmail.toLowerCase().trim());
                            const teamMember = teamMembers.find(m => m.email?.toLowerCase().trim() === attEmail.toLowerCase().trim());
                            const displayName = recordedUser?.name || teamMember?.name || getUserName(attEmail) || attEmail.split('@')[0];

                            return (
                              <span
                                key={attEmail}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                <strong className="font-semibold text-white">{displayName}</strong>
                                {recordedUser?.time && (
                                  <span className="text-[10px] text-emerald-400/70 font-mono">({recordedUser.time})</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Attendees & Author Info */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 pt-1">
                        {sch.createdBy && (
                          <span>Created by: <strong className="text-gray-300">{sch.createdBy}</strong></span>
                        )}

                        {sch.attendees && sch.attendees.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-gray-500" />
                            <span>Assigned: {sch.attendees.join(', ')}</span>
                          </div>
                        )}

                        {sch.closedBy && (
                          <span className="text-gray-500">Closed by: {sch.closedBy}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Admin Actions: Edit & Delete */}
                  {isMainAdmin && (
                    <div className="flex items-center gap-1 self-end sm:self-start shrink-0">
                      <button
                        onClick={() => handleOpenEdit(sch)}
                        className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                        title="Edit Schedule (Admin Only)"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => promptDeleteSchedule(sch)}
                        className="p-1.5 text-red-400/80 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer"
                        title="Delete Schedule (Admin Only)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#12141a] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-nyghto-orange/20 text-nyghto-orange">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
                </h3>
              </div>
              <button
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Schedule Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'meeting', label: 'Meeting', icon: Video },
                    { id: 'update', label: 'Update', icon: Sparkles },
                    { id: 'report', label: 'Report', icon: FileText },
                    { id: 'deadline', label: 'Deadline', icon: AlertCircle },
                  ].map(item => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setType(item.id as any)}
                      className={`p-2 rounded-lg flex flex-col items-center gap-1 text-xs font-semibold border transition-all cursor-pointer ${
                        type === item.id
                          ? 'bg-nyghto-orange text-white border-nyghto-orange'
                          : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/20'
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ONLINE OR OFFLINE SECTION */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-3">
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
                  Location Mode (Online or Offline) *
                </label>
                
                {/* Online / Offline Switch */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('online')}
                    className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold border transition-all cursor-pointer ${
                      mode === 'online'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                        : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    Online Meeting
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('offline')}
                    className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold border transition-all cursor-pointer ${
                      mode === 'offline'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                        : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    Offline (In-Person)
                  </button>
                </div>

                {/* IF ONLINE: Choose Platform & Meeting Link */}
                {mode === 'online' && (
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                        Select Platform
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'google_meet', label: 'Google Meet', icon: Video },
                          { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                          { id: 'zoom', label: 'Zoom', icon: Video },
                        ].map(plat => (
                          <button
                            type="button"
                            key={plat.id}
                            onClick={() => setOnlinePlatform(plat.id as any)}
                            className={`p-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium border transition-all cursor-pointer ${
                              onlinePlatform === plat.id
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                                : 'bg-black/30 text-gray-400 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <plat.icon className="w-3.5 h-3.5" />
                            {plat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                        {onlinePlatform === 'whatsapp' ? 'WhatsApp Call / Group Link' : 'Meeting / Video Call Link'}
                      </label>
                      <input
                        type="text"
                        placeholder={onlinePlatform === 'whatsapp' ? 'https://chat.whatsapp.com/... or phone number' : 'https://meet.google.com/...'}
                        value={meetLink}
                        onChange={(e) => setMeetLink(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* IF OFFLINE: Choose Office or Other */}
                {mode === 'offline' && (
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                        Where is the offline meet?
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setOfflineVenue('office')}
                          className={`p-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium border transition-all cursor-pointer ${
                            offlineVenue === 'office'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                              : 'bg-black/30 text-gray-400 border-white/5 hover:border-white/20'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          Office (Nyghto HQ)
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfflineVenue('other')}
                          className={`p-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium border transition-all cursor-pointer ${
                            offlineVenue === 'other'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                              : 'bg-black/30 text-gray-400 border-white/5 hover:border-white/20'
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Other Location
                        </button>
                      </div>
                    </div>

                    {/* When 'other' is selected: Normal location name + Location Link (Maps) */}
                    {offlineVenue === 'other' && (
                      <div className="space-y-2.5 p-3 rounded-lg bg-black/30 border border-white/5 animate-in fade-in">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                            Location Name (e.g. School, Park, Cafe) *
                          </label>
                          <input
                            type="text"
                            required={mode === 'offline' && offlineVenue === 'other'}
                            placeholder="e.g. Central City Park, Green Valley School, Starbucks"
                            value={offlineLocationName}
                            onChange={(e) => setOfflineLocationName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                            Location Link / Google Maps URL
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="https://maps.google.com/?q=..."
                              value={offlineLocationLink}
                              onChange={(e) => setOfflineLocationLink(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-xs"
                            />
                            <LinkIcon className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Title / Topic *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next-day sprint sync & task discussion"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-nyghto-orange text-sm"
                />
              </div>

              {/* Date & Quick Buttons */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Date & Time *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQuickDate('today')}
                      className="px-2 py-0.5 text-[10px] font-bold rounded bg-white/10 hover:bg-white/20 text-gray-300 cursor-pointer"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickDate('tomorrow')}
                      className="px-2 py-0.5 text-[10px] font-bold rounded bg-nyghto-orange/20 hover:bg-nyghto-orange/30 text-nyghto-orange border border-nyghto-orange/30 cursor-pointer"
                    >
                      Tomorrow (Next Day)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-nyghto-orange text-sm"
                  />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-nyghto-orange text-sm"
                  />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Priority
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Low', 'Medium', 'High', 'Urgent'] as const).map(p => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        priority === p
                          ? 'bg-nyghto-orange text-white border-nyghto-orange'
                          : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/20'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Agenda / Description / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Key discussion points, expected deliverables, or report format..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-nyghto-orange text-sm resize-none"
                />
              </div>

              {/* Attendees selection */}
              {teamMembers && teamMembers.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Attendees / Assigned Members
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 bg-black/30 border border-white/10 rounded-lg">
                    {teamMembers.map(m => {
                      const isSelected = selectedAttendees.includes(m.name);
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedAttendees(prev => prev.filter(x => x !== m.name));
                            } else {
                              setSelectedAttendees(prev => [...prev, m.name]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-nyghto-orange text-white border-nyghto-orange'
                              : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/20'
                          }`}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-nyghto-orange hover:bg-orange-600 rounded-lg shadow-lg shadow-nyghto-orange/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingSchedule ? 'Save Changes' : 'Schedule Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Delete Password Confirmation Modal */}
      {deletingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#12141a] border border-red-500/30 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 relative">
            <button
              onClick={() => { setDeletingSchedule(null); setDeletePassInput(''); setDeletePassError(''); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center mb-3 shadow-lg">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Delete Schedule Confirmation</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-[240px]">
                Enter Admin Delete Password to delete <b className="text-white font-medium">"{deletingSchedule.title}"</b>.
              </p>
            </div>

            {deletePassError && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium leading-relaxed">
                {deletePassError}
              </div>
            )}

            <form onSubmit={confirmDeleteScheduleWithPassword} className="space-y-4">
              <div>
                <input
                  type="password"
                  autoFocus
                  required
                  value={deletePassInput}
                  onChange={(e) => {
                    setDeletePassInput(e.target.value);
                    setDeletePassError('');
                  }}
                  placeholder="Enter Delete Password (••••)"
                  className="w-full text-center text-base tracking-[0.2em] font-mono py-2.5 bg-black/60 border border-white/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-inner"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setDeletingSchedule(null); setDeletePassInput(''); setDeletePassError(''); }}
                  className="w-1/2 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-colors border border-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!deletePassInput || isDeletingLoading}
                  className="w-1/2 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeletingLoading ? 'Deleting...' : 'Delete Event'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
