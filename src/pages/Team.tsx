import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, FileText, CheckCircle2, Clock, AlertCircle, Users, X, MoreVertical, Eye, Trash2, Pencil, ShieldCheck, UserPlus, Mail, Lock } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTeam } from '../contexts/TeamContext';
import { hasAdminAccess, isSuperAdmin, isCoreFounder, CORE_EMAILS, getUserRole, getUserName, getUserAvatar } from '../utils/permissions';
import type { Report } from '../types';

const COLOR_PRESETS = [
  { id: 'orange', name: 'Orange', bg: 'bg-nyghto-orange/20', text: 'text-nyghto-orange', border: 'border-nyghto-orange/30', dot: '#ff6b00' },
  { id: 'blue', name: 'Blue', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', dot: '#3b82f6' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: '#10b981' },
  { id: 'purple', name: 'Purple', bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', dot: '#a855f7' },
  { id: 'yellow', name: 'Yellow', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', dot: '#eab308' },
  { id: 'rose', name: 'Rose', bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30', dot: '#f43f5e' },
  { id: 'cyan', name: 'Cyan', bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', dot: '#06b6d4' },
  { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30', dot: '#6366f1' },
];

export default function Team() {
  const { userData, user } = useAuth();
  const { teamMembers, updateMemberAvatar } = useTeam();
  const isMainAdmin = isSuperAdmin(user?.email);
  const currentRole = getUserRole(user?.email, userData?.role);
  const currentName = getUserName(user?.email, userData?.name);
  const currentAvatar = getUserAvatar(user?.email);

  const [tab, setTab] = useState('Daily Reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editTasksDone, setEditTasksDone] = useState('');
  
  // Attendance State
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().getMonth());
  const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear());
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [teamStatus, setTeamStatus] = useState<Record<string, string>>({});
  const [offDayContextMenu, setOffDayContextMenu] = useState<{ x: number; y: number; day: number } | null>(null);
  
  // Authorized Emails (Whitelist) State
  const [authorizedEmails, setAuthorizedEmails] = useState<any[]>([]);
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Employee');
  const [newColor, setNewColor] = useState('emerald');
  const [editingAuthEmail, setEditingAuthEmail] = useState<any | null>(null);
  const [editAuthName, setEditAuthName] = useState('');
  const [editAuthRole, setEditAuthRole] = useState('');
  const [editAuthColor, setEditAuthColor] = useState('emerald');

  // Form State
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [hours, setHours] = useState('8');
  const [tasksDone, setTasksDone] = useState('1');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const handleClick = () => setOffDayContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribeReports = onSnapshot(q, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Report[];
      setReports(reportsData);
    });

    const unsubscribeAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      setAttendanceRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubscribeTeamStatus = onSnapshot(collection(db, 'teamStatus'), (snapshot) => {
      const statuses: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        statuses[doc.id] = doc.data();
      });
      setTeamStatus(statuses);
    });

    const unsubscribeAuthEmails = onSnapshot(collection(db, 'authorized_emails'), (snapshot) => {
      const emailsList = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setAuthorizedEmails(emailsList);
    });

    return () => {
      unsubscribeReports();
      unsubscribeAttendance();
      unsubscribeTeamStatus();
      unsubscribeAuthEmails();
    };
  }, []);

  const handleAddAuthorizedEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMainAdmin) return;
    const emailClean = newEmail.toLowerCase().trim();
    if (!emailClean) return;

    if (CORE_EMAILS.includes(emailClean)) {
      alert("This email is already one of the default core founder accounts!");
      return;
    }

    if (authorizedEmails.some(a => a.email?.toLowerCase() === emailClean)) {
      alert("This email is already on the authorized whitelist!");
      return;
    }

    try {
      await addDoc(collection(db, 'authorized_emails'), {
        email: emailClean,
        name: newName.trim() || emailClean.split('@')[0],
        role: newRole.trim() || 'Employee',
        color: newColor || 'emerald',
        addedBy: currentName,
        addedByEmail: user?.email || '',
        createdAt: serverTimestamp()
      });

      const colorObj = COLOR_PRESETS.find(c => c.id === newColor) || COLOR_PRESETS[2];

      await addDoc(collection(db, 'activities'), {
        text: `${currentName} granted workspace access to ${emailClean} (${newRole.trim() || 'Employee'})`,
        type: 'general',
        iconColor: colorObj.text,
        createdAt: serverTimestamp()
      });

      setNewEmail('');
      setNewName('');
      setNewRole('Employee');
      setNewColor('emerald');
      setIsAddingEmail(false);
    } catch (err) {
      console.error("Error adding authorized email:", err);
    }
  };

  const handleRevokeAccess = async (docId: string, email: string) => {
    if (!isMainAdmin) return;
    if (window.confirm(`Are you sure you want to revoke access for "${email}"? They will be immediately blocked from accessing Nyghto OS.`)) {
      try {
        await deleteDoc(doc(db, 'authorized_emails', docId));
        await addDoc(collection(db, 'activities'), {
          text: `${currentName} revoked access for ${email}`,
          type: 'general',
          iconColor: 'text-red-400',
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Error revoking access:", err);
      }
    }
  };

  const handleUpdateAuthorizedEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMainAdmin || !editingAuthEmail) return;

    try {
      await updateDoc(doc(db, 'authorized_emails', editingAuthEmail.id), {
        name: editAuthName.trim() || editingAuthEmail.name,
        role: editAuthRole.trim() || 'Employee',
        color: editAuthColor || 'emerald',
        updatedAt: serverTimestamp(),
        updatedBy: currentName
      });

      setEditingAuthEmail(null);
    } catch (err) {
      console.error("Error updating authorized email:", err);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hours || !tasksDone || !date) return;

    try {
      await addDoc(collection(db, 'reports'), {
        employeeId: user?.uid || userData?.id || 'unknown',
        employeeEmail: user?.email || '',
        employeeName: currentName,
        employeeAvatar: currentName.charAt(0) || 'U',
        role: currentRole,
        title: reportTitle.trim() || 'Work Progress Report',
        description: reportDescription.trim() || '',
        date,
        status: 'Submitted',
        hours: parseFloat(hours),
        durationDays: parseFloat(hours) >= 8 ? parseFloat((parseFloat(hours) / 8).toFixed(1)) : 1,
        tasksDone: parseInt(tasksDone),
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'activities'), {
        text: `${currentName} (${currentRole}) submitted report: "${reportTitle.trim() || 'Work Report'}" (${hours}h)`,
        type: 'report',
        iconColor: 'text-nyghto-yellow',
        createdAt: serverTimestamp()
      });

      setIsSubmitting(false);
      setReportTitle('');
      setReportDescription('');
      setHours('8');
      setTasksDone('1');
    } catch (error) {
      console.error("Error submitting report:", error);
    }
  };

  const handleUpdateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;
    try {
      await updateDoc(doc(db, 'reports', editingReport.id), {
        title: editTitle.trim() || 'Work Progress Report',
        description: editDescription.trim() || '',
        hours: parseFloat(editHours),
        durationDays: parseFloat(editHours) >= 8 ? parseFloat((parseFloat(editHours) / 8).toFixed(1)) : 1,
        tasksDone: parseInt(editTasksDone)
      });
      setEditingReport(null);
    } catch (error) {
      console.error("Error updating report:", error);
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setActiveDropdown(null);
    } catch (error) {
      console.error("Error deleting report:", error);
    }
  };

  const cycleAttendance = async (userId: string, day: number) => {
    // Only Main Admin (team.nyghto@gmail.com) can mark/cycle attendance
    if (!isMainAdmin) return;

    // Format date as YYYY-MM-DD
    const dateStr = `${attendanceYear}-${String(attendanceMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const docId = `${dateStr}_${userId}`;
    
    // Find current status
    const currentRecord = attendanceRecords.find(r => r.userId === userId && r.date === dateStr);
    const currentStatus = currentRecord?.status || 'None';

    // PERMANENT OFF DAY CHECK: If already Off Day, it cannot be changed!
    if (currentStatus === 'Off Day') {
      return;
    }
    
    // Cycle: None -> Present -> Half Day -> Absent -> None
    let nextStatus = 'Present';
    if (currentStatus === 'Present') nextStatus = 'Half Day';
    else if (currentStatus === 'Half Day') nextStatus = 'Absent';
    else if (currentStatus === 'Absent') nextStatus = 'None';

    try {
      if (nextStatus === 'None') {
        await deleteDoc(doc(db, 'attendance', docId));
      } else {
        await setDoc(doc(db, 'attendance', docId), {
          userId,
          date: dateStr,
          status: nextStatus,
          updatedAt: serverTimestamp(),
          updatedBy: currentName || 'Admin'
        });
      }
    } catch (error) {
      console.error("Error updating attendance:", error);
    }
  };

  const markAllAsPermanentOffDay = async (day: number) => {
    if (!isMainAdmin) return;

    const dateStr = `${attendanceYear}-${String(attendanceMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    try {
      const promises = teamMembers.map(member => {
        const docId = `${dateStr}_${member.id}`;
        return setDoc(doc(db, 'attendance', docId), {
          userId: member.id,
          date: dateStr,
          status: 'Off Day',
          updatedAt: serverTimestamp(),
          updatedBy: currentName || 'Admin'
        });
      });
      await Promise.all(promises);
    } catch (error) {
      console.error("Error setting permanent off day:", error);
    }
  };

  const toggleAllOffDay = async (day: number) => {
    const dateStr = `${attendanceYear}-${String(attendanceMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Check if everyone is already marked as 'Off Day' for this date
    const allOffDay = teamMembers.every(member => {
      const record = attendanceRecords.find(r => r.userId === member.id && r.date === dateStr);
      return record?.status === 'Off Day';
    });

    try {
      const promises = teamMembers.map(member => {
        const docId = `${dateStr}_${member.id}`;
        if (allOffDay) {
          // If all are off day, clear it
          return deleteDoc(doc(db, 'attendance', docId));
        } else {
          // Otherwise mark all as off day
          return setDoc(doc(db, 'attendance', docId), {
            userId: member.id,
            date: dateStr,
            status: 'Off Day',
            updatedAt: serverTimestamp(),
            updatedBy: userData?.name || 'User'
          });
        }
      });
      await Promise.all(promises);
    } catch (error) {
      console.error("Error toggling off day:", error);
    }
  };

  const isMemberActive = (memberId: string) => {
    const data = teamStatus[memberId];
    if (!data) return false;
    if (data.status === 'Active') {
      if (data.lastActive) {
        return (Date.now() - data.lastActive) < 90000;
      }
      return true;
    }
    return false;
  };


  const totalReports = reports.length;
  // Calculate average submission rate or pending - since we don't know total employees easily, we'll simplify.
  const submittedReports = reports.filter(r => r.status === 'Submitted').length;
  
  // Days in month logic
  const daysInMonth = new Date(attendanceYear, attendanceMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName = new Date(attendanceYear, attendanceMonth).toLocaleString('default', { month: 'long' });
  
  let totalSundays = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    if (new Date(attendanceYear, attendanceMonth, i).getDay() === 0) totalSundays++;
  }
  const maxMarksForMonth = (daysInMonth - totalSundays) * 10;

  const calculateScore = (memberId: string) => {
    let totalMarks = 0;
    let leavesTaken = 0;
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${attendanceYear}-${String(attendanceMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const record = attendanceRecords.find(r => r.userId === memberId && r.date === dateStr);
      const status = record?.status || 'None';
      const isSunday = new Date(attendanceYear, attendanceMonth, i).getDay() === 0;

      if (!isSunday && status !== 'Off Day') {
        if (status === 'Present') totalMarks += 10;
        else if (status === 'Half Day') totalMarks += 5;
        else if (status === 'Absent') leavesTaken++;
      }
    }
    
    // First 2 leaves give +10 marks. Any extra leaves give 0 marks (no penalty).
    const freeLeaves = Math.min(leavesTaken, 2);
    totalMarks += (freeLeaves * 10);
    
    return totalMarks;
  };
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10" onClick={() => setActiveDropdown(null)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Team & Reports</h1>
          <p className="text-gray-400">Manage your team, view daily work reports, and control workspace access.</p>
        </div>
        <div className="flex items-center gap-3">
          {isMainAdmin && (
            <button 
              onClick={() => setIsAddingEmail(true)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-sm"
            >
              <UserPlus className="w-4 h-4 text-nyghto-orange" />
              Add Allowed Gmail
            </button>
          )}
          <button 
            onClick={() => setIsSubmitting(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Submit My Report
          </button>
        </div>
      </div>

      {/* Big Tab Boxes */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isMainAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-4`}>
        {[
          { id: 'Daily Reports', icon: FileText, desc: 'View & submit daily logs' },
          { id: 'Team Members', icon: Users, desc: 'Manage your team profiles' },
          { id: 'Attendance', icon: CheckCircle2, desc: 'Track daily presence' },
          ...(isMainAdmin ? [{ id: 'Access Whitelist', icon: ShieldCheck, desc: 'Manage allowed Gmails' }] : [])
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`p-3 rounded-lg flex items-center gap-3 text-left transition-all ${
              tab === t.id 
                ? 'bg-nyghto-orange/10 border-nyghto-orange/50 border shadow-[0_0_10px_rgba(255,107,0,0.1)]' 
                : 'glass-card border-transparent hover:border-white/20'
            }`}
          >
            <div className={`p-2 rounded-md transition-colors ${tab === t.id ? 'bg-nyghto-orange text-white' : 'bg-white/5 text-gray-400'}`}>
              <t.icon className="w-5 h-5" />
            </div>
            <div>
              <div className={`font-bold text-sm ${tab === t.id ? 'text-white' : 'text-gray-300'}`}>{t.id}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{t.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="glass-card p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search reports or team..." 
              className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-nyghto-orange transition-colors"
            />
          </div>
          <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {tab === 'Daily Reports' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="glass-card p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-nyghto-orange/20 flex items-center justify-center text-nyghto-orange">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">{submittedReports}</div>
                <div className="text-sm text-gray-400">Reports Submitted</div>
              </div>
            </div>
            <div className="glass-card p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-nyghto-yellow/20 flex items-center justify-center text-nyghto-yellow">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalReports}</div>
                <div className="text-sm text-gray-400">Total Records</div>
              </div>
            </div>
            <div className="glass-card p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {(() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const todayReports = reports.filter(r => r.date === todayStr);
                    const uniqueSubmitters = new Set(todayReports.map(r => r.employeeId)).size;
                    const totalTeam = teamMembers.length;
                    return totalTeam > 0 ? `${Math.round((uniqueSubmitters / totalTeam) * 100)}%` : '0%';
                  })()}
                </div>
                <div className="text-sm text-gray-400">Today's Submission Rate</div>
              </div>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-gray-400">
                  <tr>
                    <th className="px-6 py-4 font-medium rounded-tl-xl">Employee</th>
                    <th className="px-6 py-4 font-medium">Work Report / Topic</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Duration</th>
                    <th className="px-6 py-4 font-medium">Tasks Done</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right rounded-tr-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {getUserAvatar(report.employeeEmail) ? (
                            <img 
                              src={getUserAvatar(report.employeeEmail)!} 
                              alt={report.employeeName} 
                              className="w-8 h-8 rounded-full object-cover border border-nyghto-orange/40 shadow-sm" 
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-800 border border-nyghto-border flex items-center justify-center font-medium">
                              {report.employeeAvatar || report.employeeName?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-white group-hover:text-nyghto-orange transition-colors">{report.employeeName}</div>
                            <div className="text-xs font-semibold text-nyghto-orange uppercase tracking-wide">{getUserRole(report.employeeEmail, report.role)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <button
                          onClick={() => setViewingReport(report)}
                          className="text-left group/title block"
                        >
                          <div className="font-medium text-white group-hover/title:text-nyghto-orange transition-colors flex items-center gap-1.5 line-clamp-1">
                            <span>{report.title || 'Work Progress Report'}</span>
                            <Eye className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                          </div>
                          {report.description ? (
                            <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">{report.description}</div>
                          ) : (
                            <div className="text-[11px] text-gray-500 italic">Click to view details</div>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{report.date}</td>
                      <td className="px-6 py-4 font-medium whitespace-nowrap">
                        {report.hours > 0 ? (
                          <span>
                            {report.hours}h {report.hours >= 8 ? <span className="text-xs text-nyghto-orange font-semibold">({(report.hours / 8).toFixed(1)}d)</span> : ''}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-300">{report.tasksDone > 0 ? report.tasksDone : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                          report.status === 'Submitted' 
                            ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                            : 'bg-yellow-500/10 text-nyghto-yellow border-yellow-500/20'
                        }`}>
                          {report.status === 'Submitted' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingReport(report)}
                            title="View Report Details"
                            className="p-2 text-gray-400 hover:text-nyghto-orange hover:bg-nyghto-orange/10 rounded-lg transition-colors border border-transparent hover:border-nyghto-orange/20"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingReport(report);
                              setEditTitle(report.title || '');
                              setEditDescription(report.description || '');
                              setEditHours(report.hours.toString());
                              setEditTasksDone(report.tasksDone.toString());
                            }}
                            title="Edit Report"
                            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/20"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this report?")) {
                                deleteReport(report.id);
                              }
                            }}
                            title="Delete Report"
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        No reports submitted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'Team Members' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMembers.map(member => {
            const active = isMemberActive(member.id);
            return (
              <div key={member.id} className="glass-card p-6 flex flex-col items-center text-center hover:border-nyghto-orange/30 transition-colors relative group">
                {/* Automatic Live Status Badge */}
                <div 
                  className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm transition-all"
                  style={{
                    backgroundColor: active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                    borderColor: active ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    color: active ? '#4ade80' : '#9ca3af'
                  }}
                >
                  <span className={`w-2 h-2 rounded-full ${active ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                  <span>{active ? 'Active' : 'Inactive'}</span>
                </div>

                <div className="relative mb-4 mt-2">
                  {member.avatarImage ? (
                    <img src={member.avatarImage} alt={member.name} className="w-20 h-20 rounded-full object-cover shadow-lg ring-2 ring-white/10" />
                  ) : (
                    <div className={`w-20 h-20 rounded-full ${member.color} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}>
                      {member.initial}
                    </div>
                  )}
                  {/* Status dot on avatar */}
                  <span className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-[#121218] flex items-center justify-center ${
                    active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-gray-500'
                  }`}>
                    {active && <span className="w-2 h-2 bg-white rounded-full animate-ping opacity-75" />}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mb-0.5">{member.name}</h3>
                <p className="text-sm text-nyghto-orange font-medium mb-4">{member.role}</p>
                
                <div className="flex gap-2 w-full mt-2">
                  <button 
                    onClick={() => setSelectedProfile(member)}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-white/10"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'Attendance' && (
        <div className="glass-card p-6 flex flex-col max-h-[800px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Attendance ({monthName} {attendanceYear})</h3>
              <p className="text-sm text-gray-400">Click a cell to cycle: Present → Half Day → Absent → Clear (Right click Date for Off Day)</p>
            </div>
            <div className="flex items-center gap-3">
              {!isMainAdmin ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg text-xs font-semibold">
                  <span>🔒</span>
                  <span>View-Only Mode (Main Admin only)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-xs font-semibold">
                  <span>⚡</span>
                  <span>Main Admin Access</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    if (attendanceMonth === 0) { setAttendanceMonth(11); setAttendanceYear(y => y - 1); }
                    else setAttendanceMonth(m => m - 1);
                  }}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >&lt;</button>
                <div className="font-bold w-32 text-center text-white">{monthName} {attendanceYear}</div>
                <button 
                  onClick={() => {
                    if (attendanceMonth === 11) { setAttendanceMonth(0); setAttendanceYear(y => y + 1); }
                    else setAttendanceMonth(m => m + 1);
                  }}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >&gt;</button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto flex-1 custom-scrollbar pb-4 border border-white/10 rounded-xl">
            <table className="w-full text-center text-sm border-collapse">
              <thead className="bg-white/5 text-gray-300">
                <tr>
                  <th className="px-4 py-3 font-semibold border-b border-r border-white/10 w-24">Date</th>
                  {teamMembers.map(member => (
                    <th key={member.id} className="px-4 py-3 font-semibold border-b border-white/10 min-w-[120px]">
                      <div className="flex flex-col items-center gap-1">
                        {member.avatarImage ? (
                          <img src={member.avatarImage} alt={member.name} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className={`w-6 h-6 rounded-full ${member.color} text-white flex items-center justify-center text-xs font-bold`}>{member.initial}</div>
                        )}
                        {member.name}
                        <div className="text-[10px] bg-nyghto-orange/20 text-nyghto-orange px-2 py-0.5 rounded-full mt-1 border border-nyghto-orange/30">
                          {calculateScore(member.id)} / {maxMarksForMonth}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {daysArray.map(day => {
                  const dateStr = `${attendanceYear}-${String(attendanceMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateStr === new Date().toISOString().split('T')[0];
                  
                  return (
                    <tr key={day} className={`hover:bg-white/5 transition-colors ${isToday ? 'bg-nyghto-orange/5' : ''}`}>
                      <td 
                        className={`px-4 py-2 border-r border-white/10 font-medium sticky left-0 bg-nyghto-dark/95 backdrop-blur-sm ${
                          isMainAdmin ? 'cursor-context-menu' : 'cursor-default'
                        } ${isToday ? 'text-nyghto-orange' : 'text-gray-400'}`}
                        onContextMenu={(e) => {
                          if (!isMainAdmin) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setOffDayContextMenu({ x: e.clientX, y: e.clientY, day });
                        }}
                        title={isMainAdmin ? "Right click to open Off Day menu" : undefined}
                      >
                        {day} {monthName.substring(0, 3)}
                      </td>
                      {teamMembers.map(member => {
                        const record = attendanceRecords.find(r => r.userId === member.id && r.date === dateStr);
                        const status = record?.status || 'None';
                        const isOffDay = status === 'Off Day';
                        
                        let display = '-';
                        let classes = 'text-gray-500 bg-transparent border-transparent hover:border-white/20 hover:bg-white/5';
                        
                        if (status === 'Present') {
                          display = 'P';
                          classes = 'bg-green-500/20 text-green-400 border-green-500/30 font-bold shadow-[0_0_8px_rgba(34,197,94,0.3)]';
                        } else if (status === 'Half Day') {
                          display = 'HD';
                          classes = 'bg-yellow-500/20 text-nyghto-yellow border-yellow-500/30 font-bold';
                        } else if (status === 'Absent') {
                          display = 'A';
                          classes = 'bg-red-500/20 text-red-400 border-red-500/30 font-bold';
                        } else if (status === 'Off Day') {
                          display = 'O';
                          classes = 'bg-gray-500/20 text-gray-400 border-gray-500/30 font-bold';
                        }
                        
                        return (
                          <td key={member.id} className="px-4 py-2 border-white/10">
                            <button 
                              disabled={!isMainAdmin || isOffDay}
                              onClick={() => isMainAdmin && !isOffDay && cycleAttendance(member.id, day)}
                              className={`w-10 h-8 rounded border transition-all ${classes} ${
                                !isMainAdmin 
                                  ? 'cursor-default' 
                                  : isOffDay 
                                    ? 'cursor-not-allowed opacity-80' 
                                    : 'cursor-pointer'
                              }`}
                              title={
                                !isMainAdmin 
                                  ? `Status: ${status} (Only main admin can edit attendance)`
                                  : isOffDay 
                                    ? 'Off Day (Permanent - Cannot be changed)' 
                                    : `Click to change status (Currently: ${status})`
                              }
                            >
                              {display}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 flex gap-4 text-xs justify-center text-gray-400 bg-white/5 p-3 rounded-lg flex-wrap">
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/30 flex items-center justify-center text-[10px] text-green-400 font-bold">P</div> = Present</div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-[10px] text-nyghto-yellow font-bold">HD</div> = Half Day</div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/30 flex items-center justify-center text-[10px] text-red-400 font-bold">A</div> = Absent</div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-gray-500/20 border border-gray-500/30 flex items-center justify-center text-[10px] text-gray-400 font-bold">O</div> = Off Day (Permanent)</div>
          </div>
        </div>
      )}

      {tab === 'Access Whitelist' && isMainAdmin && (
        <div className="space-y-6 animate-in fade-in">
          <div className="glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-nyghto-orange" />
                <h3 className="text-xl font-bold text-white">Workspace Access & Whitelist</h3>
              </div>
              <p className="text-sm text-gray-400 mt-1 max-w-xl">
                Only whitelisted Google accounts can access Nyghto OS. If anyone else attempts to log in, their access is blocked automatically.
              </p>
            </div>
            {isMainAdmin && (
              <button
                onClick={() => setIsAddingEmail(true)}
                className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                Add Allowed Gmail
              </button>
            )}
          </div>

          {/* Section 1: Core Founder Accounts (Protected) */}
          <div className="glass-card p-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-nyghto-yellow" />
              Core Founder Accounts (Permanent Access)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { email: 'team.nyghto@gmail.com', name: 'Nyghto Admin', role: 'Super Admin', avatar: null },
                { email: 'salurinshan9539@gmail.com', name: 'Salu Rinshan', role: 'CEO', avatar: '/rinshan.jpg' },
                { email: 'amaldas.co@gmail.com', name: 'Amal Das', role: 'CTO', avatar: '/amal.jpg' },
                { email: 'shahalmuhammed404@gmail.com', name: 'Shahal Muhammed', role: 'CPO', avatar: '/shahal.jpg' }
              ].map(founder => (
                <div key={founder.email} className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {founder.avatar ? (
                      <img src={founder.avatar} alt={founder.name} className="w-10 h-10 rounded-full object-cover border border-nyghto-orange/40" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-theme-bg flex items-center justify-center text-nyghto-orange font-bold border border-theme-border">
                        {founder.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-white text-sm">{founder.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{founder.email}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold text-nyghto-orange uppercase px-2 py-0.5 bg-nyghto-orange/10 border border-nyghto-orange/20 rounded-md">
                      {founder.role}
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">Permanent</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Manually Added Whitelist Accounts */}
          <div className="glass-card p-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4 text-green-400" />
              Invited & Allowed Gmail Accounts ({authorizedEmails.length})
            </h4>

            {authorizedEmails.length === 0 ? (
              <div className="p-8 text-center bg-white/5 rounded-xl border border-white/10">
                <p className="text-gray-400 text-sm">No additional Gmail accounts added yet.</p>
                <p className="text-xs text-gray-500 mt-1">Click "Add Allowed Gmail" above to whitelist any new team member or employee.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {authorizedEmails.map(item => {
                  const colorObj = COLOR_PRESETS.find(c => c.id === item.color) || COLOR_PRESETS[2];
                  return (
                    <div key={item.id} className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between group hover:border-white/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${colorObj.bg} ${colorObj.text} flex items-center justify-center font-bold border ${colorObj.border} shadow-sm`}>
                          {item.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">{item.name}</div>
                          <div className="text-xs text-gray-300 font-mono">{item.email}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">Added by: {item.addedBy || 'Admin'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${colorObj.bg} ${colorObj.text} ${colorObj.border}`}>
                          {item.role || 'Employee'}
                        </span>
                        {hasAdminAccess(user?.email) && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingAuthEmail(item);
                                setEditAuthName(item.name || '');
                                setEditAuthRole(item.role || 'Employee');
                                setEditAuthColor(item.color || 'emerald');
                              }}
                              title="Edit Member Role & Details"
                              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRevokeAccess(item.id, item.email)}
                              title="Revoke access"
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Allowed Gmail Modal */}
      {isAddingEmail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setIsAddingEmail(false)}>
          <div className="glass-card w-full max-w-lg p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-nyghto-orange" />
                <h3 className="font-bold text-white text-lg">Add Allowed Gmail & Role</h3>
              </div>
              <button onClick={() => setIsAddingEmail(false)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAuthorizedEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Gmail Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="example@gmail.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1">This user will immediately be allowed to sign in with Google.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm"
                />
              </div>

              {/* Custom Role Input & Quick Presets */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Assigned Role (Custom or Preset) *
                  </label>
                </div>

                {/* Quick Role Preset Pills */}
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {[
                    'Employee',
                    'Developer',
                    'UI/UX Designer',
                    'Product Manager',
                    'Marketing',
                    'Video Editor',
                    'Sales',
                    'Intern'
                  ].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewRole(r)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                        newRole.toLowerCase() === r.toLowerCase()
                          ? 'bg-nyghto-orange text-white border-nyghto-orange font-bold shadow-[0_0_8px_rgba(255,107,0,0.3)]'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {/* Direct Custom Role text input */}
                <input
                  type="text"
                  required
                  placeholder="Type any custom role (e.g. Lead Flutter Developer, AI Engineer, HR...)"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm"
                />
              </div>

              {/* Custom Color Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Select Badge & Profile Color
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {COLOR_PRESETS.map(c => {
                    const isSelected = newColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setNewColor(c.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                          isSelected
                            ? `${c.bg} ${c.border} ring-2 ring-white/40 scale-105`
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full mb-1 shadow-sm" style={{ backgroundColor: c.dot }} />
                        <span className={`text-[10px] font-semibold ${isSelected ? c.text : 'text-gray-400'}`}>
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Card */}
              {newRole && (
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const colorObj = COLOR_PRESETS.find(c => c.id === newColor) || COLOR_PRESETS[2];
                      return (
                        <>
                          <div className={`w-8 h-8 rounded-full ${colorObj.bg} ${colorObj.text} flex items-center justify-center text-xs font-bold border ${colorObj.border}`}>
                            {newName ? newName.charAt(0).toUpperCase() : (newEmail ? newEmail.charAt(0).toUpperCase() : 'U')}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{newName || newEmail || 'New Member'}</div>
                            <div className="text-[10px] text-gray-400">{newEmail || 'user@gmail.com'}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  {(() => {
                    const colorObj = COLOR_PRESETS.find(c => c.id === newColor) || COLOR_PRESETS[2];
                    return (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${colorObj.bg} ${colorObj.text} ${colorObj.border}`}>
                        {newRole}
                      </span>
                    );
                  })()}
                </div>
              )}

              <div className="pt-3 border-t border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingEmail(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Grant Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Allowed Member Modal */}
      {editingAuthEmail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setEditingAuthEmail(null)}>
          <div className="glass-card w-full max-w-lg p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-nyghto-orange" />
                <h3 className="font-bold text-white text-lg">Edit Member Role & Details</h3>
              </div>
              <button onClick={() => setEditingAuthEmail(null)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAuthorizedEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Gmail Address
                </label>
                <input
                  type="text"
                  disabled
                  value={editingAuthEmail.email}
                  className="w-full bg-nyghto-dark/50 border border-white/5 rounded-lg py-2 px-3 text-gray-400 cursor-not-allowed text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={editAuthName}
                  onChange={e => setEditAuthName(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm"
                />
              </div>

              {/* Custom Role Input & Quick Presets */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Assigned Custom Role *
                </label>

                {/* Quick Role Preset Pills */}
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {[
                    'Employee',
                    'Developer',
                    'UI/UX Designer',
                    'Product Manager',
                    'Marketing',
                    'Video Editor',
                    'Sales',
                    'Intern'
                  ].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setEditAuthRole(r)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                        editAuthRole.toLowerCase() === r.toLowerCase()
                          ? 'bg-nyghto-orange text-white border-nyghto-orange font-bold shadow-[0_0_8px_rgba(255,107,0,0.3)]'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {/* Direct Custom Role text input */}
                <input
                  type="text"
                  required
                  placeholder="Type any custom role (e.g. Lead Flutter Developer, AI Engineer...)"
                  value={editAuthRole}
                  onChange={e => setEditAuthRole(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm"
                />
              </div>

              {/* Custom Color Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Badge & Profile Color
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {COLOR_PRESETS.map(c => {
                    const isSelected = editAuthColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setEditAuthColor(c.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                          isSelected
                            ? `${c.bg} ${c.border} ring-2 ring-white/40 scale-105`
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full mb-1 shadow-sm" style={{ backgroundColor: c.dot }} />
                        <span className={`text-[10px] font-semibold ${isSelected ? c.text : 'text-gray-400'}`}>
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Card */}
              {editAuthRole && (
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const colorObj = COLOR_PRESETS.find(c => c.id === editAuthColor) || COLOR_PRESETS[2];
                      return (
                        <>
                          <div className={`w-8 h-8 rounded-full ${colorObj.bg} ${colorObj.text} flex items-center justify-center text-xs font-bold border ${colorObj.border}`}>
                            {editAuthName ? editAuthName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{editAuthName || 'Member'}</div>
                            <div className="text-[10px] text-gray-400">{editingAuthEmail.email}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  {(() => {
                    const colorObj = COLOR_PRESETS.find(c => c.id === editAuthColor) || COLOR_PRESETS[2];
                    return (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${colorObj.bg} ${colorObj.text} ${colorObj.border}`}>
                        {editAuthRole}
                      </span>
                    );
                  })()}
                </div>
              )}

              <div className="pt-3 border-t border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingAuthEmail(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm flex items-center gap-1.5"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Off Day Right Click Context Menu */}
      {offDayContextMenu && (
        <div 
          className="fixed z-50 bg-[#1a1a20] border border-white/20 shadow-2xl rounded-xl p-1.5 min-w-[150px] animate-in fade-in zoom-in-95"
          style={{ top: `${offDayContextMenu.y}px`, left: `${offDayContextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const dateStr = `${attendanceYear}-${String(attendanceMonth + 1).padStart(2, '0')}-${String(offDayContextMenu.day).padStart(2, '0')}`;
            const isAlreadyOffDay = teamMembers.every(member => {
              const record = attendanceRecords.find(r => r.userId === member.id && r.date === dateStr);
              return record?.status === 'Off Day';
            });

            if (isAlreadyOffDay) {
              return (
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 flex items-center gap-2">
                  <span>🔒 Off Day (Locked)</span>
                </div>
              );
            }

            return (
              <button
                onClick={() => {
                  markAllAsPermanentOffDay(offDayContextMenu.day);
                  setOffDayContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-nyghto-orange hover:bg-nyghto-orange/10 rounded-lg transition-colors text-left cursor-pointer"
              >
                <span>🏖️ Off Day</span>
              </button>
            );
          })()}
        </div>
      )}

      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-white">Submit Work Report</h2>
              <button 
                onClick={() => setIsSubmitting(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Submitter Profile Info Banner */}
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl mb-4">
              {currentAvatar ? (
                <img src={currentAvatar} alt={currentName} className="w-10 h-10 rounded-full object-cover border border-nyghto-orange/40 shadow-sm" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-theme-bg flex items-center justify-center text-nyghto-orange font-bold border border-theme-border">
                  {currentName?.charAt(0) || 'U'}
                </div>
              )}
              <div>
                <div className="font-bold text-white text-sm">{currentName}</div>
                <div className="text-xs font-bold text-nyghto-orange uppercase tracking-wider">{currentRole}</div>
              </div>
            </div>
            
            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Work Title / Topic</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Dashboard UI Updates & Backend APIs"
                  value={reportTitle}
                  onChange={e => setReportTitle(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
                <input 
                  type="date" 
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm" 
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-400">Duration / Working Days</label>
                  <span className="text-xs text-nyghto-orange font-semibold">
                    {parseFloat(hours) >= 8 ? `${(parseFloat(hours) / 8).toFixed(1)} Days (${hours}h)` : `${hours || 0} hrs`}
                  </span>
                </div>
                {/* Day Presets */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { label: '1 Day', h: '8' },
                    { label: '2 Days', h: '16' },
                    { label: '5 Days', h: '40' },
                    { label: '10 Days', h: '80' },
                    { label: '20 Days', h: '160' },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setHours(preset.h)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                        hours === preset.h
                          ? 'bg-nyghto-orange text-white border-nyghto-orange shadow-[0_0_10px_rgba(255,107,0,0.4)]'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input 
                  type="number" 
                  step="0.5"
                  min="0.5"
                  required
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                  placeholder="Hours (e.g. 8 for 1 day, 80 for 10 days, 160 for 20 days)"
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Tasks Completed (Count)</label>
                <input 
                  type="number" 
                  min="0"
                  required
                  value={tasksDone}
                  onChange={e => setTasksDone(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Work Description & Details (What was done)</label>
                <textarea 
                  rows={3}
                  placeholder="Describe key achievements, completed milestones, or notes..."
                  value={reportDescription}
                  onChange={e => setReportDescription(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm resize-none" 
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-white/10">
                <button 
                  type="button"
                  onClick={() => setIsSubmitting(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary text-sm"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Report Modal */}
      {editingReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Edit Report</h2>
              <button 
                onClick={() => setEditingReport(null)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateReport} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Work Title / Topic</label>
                <input 
                  type="text" 
                  required
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm" 
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-400">Duration / Working Days</label>
                  <span className="text-xs text-nyghto-orange font-semibold">
                    {parseFloat(editHours) >= 8 ? `${(parseFloat(editHours) / 8).toFixed(1)} Days (${editHours}h)` : `${editHours || 0} hrs`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { label: '1 Day', h: '8' },
                    { label: '2 Days', h: '16' },
                    { label: '5 Days', h: '40' },
                    { label: '10 Days', h: '80' },
                    { label: '20 Days', h: '160' },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setEditHours(preset.h)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                        editHours === preset.h
                          ? 'bg-nyghto-orange text-white border-nyghto-orange shadow-[0_0_10px_rgba(255,107,0,0.4)]'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input 
                  type="number" 
                  step="0.5"
                  min="0.5"
                  required
                  value={editHours}
                  onChange={e => setEditHours(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Tasks Completed</label>
                <input 
                  type="number" 
                  min="0"
                  required
                  value={editTasksDone}
                  onChange={e => setEditTasksDone(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Work Description & Details</label>
                <textarea 
                  rows={3}
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm resize-none" 
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-white/10">
                <button 
                  type="button"
                  onClick={() => setEditingReport(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary text-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Report Details Modal */}
      {viewingReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setViewingReport(null)}>
          <div className="glass-card w-full max-w-lg p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                {getUserAvatar(viewingReport.employeeEmail) ? (
                  <img src={getUserAvatar(viewingReport.employeeEmail)!} alt={viewingReport.employeeName} className="w-10 h-10 rounded-full object-cover border border-nyghto-orange/40 shadow-sm" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-theme-bg flex items-center justify-center text-nyghto-orange font-bold border border-theme-border">
                    {viewingReport.employeeName?.charAt(0) || 'U'}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-white text-base">{viewingReport.employeeName}</h3>
                  <div className="text-xs font-bold text-nyghto-orange uppercase tracking-wider">{getUserRole(viewingReport.employeeEmail, viewingReport.role)}</div>
                </div>
              </div>
              <button onClick={() => setViewingReport(null)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Report Title / Work Topic</span>
                <h4 className="text-lg font-bold text-white mt-0.5">{viewingReport.title || 'Work Progress Report'}</h4>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 bg-white/5 border border-white/10 rounded-xl text-center">
                <div>
                  <div className="text-xs text-gray-400">Date</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{viewingReport.date}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Duration</div>
                  <div className="text-sm font-semibold text-nyghto-orange mt-0.5">
                    {viewingReport.hours}h ({viewingReport.hours >= 8 ? `${(viewingReport.hours / 8).toFixed(1)}d` : `${viewingReport.hours}h`})
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Tasks Completed</div>
                  <div className="text-sm font-semibold text-green-400 mt-0.5">{viewingReport.tasksDone}</div>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Work Summary & Details</span>
                <div className="mt-1.5 p-4 bg-nyghto-dark/80 border border-white/10 rounded-xl text-sm text-gray-200 whitespace-pre-wrap leading-relaxed min-h-[100px]">
                  {viewingReport.description || 'No detailed description was provided for this report.'}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-between items-center gap-3">
              <button 
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete this report?")) {
                    deleteReport(viewingReport.id);
                    setViewingReport(null);
                  }
                }}
                className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Report
              </button>

              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const r = viewingReport;
                    setViewingReport(null);
                    setEditingReport(r);
                    setEditTitle(r.title || '');
                    setEditDescription(r.description || '');
                    setEditHours(r.hours.toString());
                    setEditTasksDone(r.tasksDone.toString());
                  }}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button 
                  onClick={() => setViewingReport(null)} 
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* View Profile Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm p-6 relative border border-white/20">
            <button 
              onClick={() => setSelectedProfile(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center mb-6 mt-4">
              {selectedProfile.avatarImage ? (
                <img src={selectedProfile.avatarImage} alt={selectedProfile.name} className="w-24 h-24 rounded-full object-cover mb-4 shadow-lg ring-4 ring-white/10" />
              ) : (
                <div className={`w-24 h-24 rounded-full ${selectedProfile.color} flex items-center justify-center text-4xl font-bold text-white mb-4 shadow-lg ring-4 ring-white/10`}>
                  {selectedProfile.initial}
                </div>
              )}
              <h2 className="text-2xl font-bold text-white tracking-wide">{selectedProfile.name}</h2>
              <p className="text-nyghto-orange font-medium mt-1">{selectedProfile.role}</p>
            </div>
            
            <div className="space-y-3">
              <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center justify-between">
                <div className="text-xs text-gray-400">Email Address</div>
                <div className="text-sm font-medium text-white">{selectedProfile.email}</div>
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center justify-between">
                <div className="text-xs text-gray-400">Phone Number</div>
                <div className="text-sm font-medium text-white">{selectedProfile.phone}</div>
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center justify-between">
                <div className="text-xs text-gray-400">Live Status</div>
                {(() => {
                  const active = isMemberActive(selectedProfile.id);
                  return (
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${active ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                      <span className={`text-sm font-semibold ${active ? 'text-green-400' : 'text-gray-400'}`}>
                        {active ? 'Active Now' : 'Inactive'}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
