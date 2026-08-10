import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, FileText, CheckCircle2, Clock, AlertCircle, Users, X, MoreVertical } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Report } from '../types';

const TEAM_MEMBERS = [
  { id: 'u1', name: 'RINSHAN', role: 'CEO', initial: 'R', color: 'bg-nyghto-orange', phone: '+91 9539202847' },
  { id: 'u2', name: 'AMAL', role: 'CTO', initial: 'A', color: 'bg-blue-500', phone: '+91 7012028379' },
  { id: 'u3', name: 'SHAHAL', role: 'CPO', initial: 'S', color: 'bg-green-500', phone: '+91 8075911860' },
];

export default function Team() {
  const { userData } = useAuth();
  const [tab, setTab] = useState('Daily Reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editTasksDone, setEditTasksDone] = useState('');
  
  // Attendance State
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().getMonth());
  const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear());
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [teamStatus, setTeamStatus] = useState<Record<string, string>>({});
  
  // Form State
  const [hours, setHours] = useState('');
  const [tasksDone, setTasksDone] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

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
      const statuses: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        statuses[doc.id] = doc.data().status;
      });
      setTeamStatus(statuses);
    });

    return () => {
      unsubscribeReports();
      unsubscribeAttendance();
      unsubscribeTeamStatus();
    };
  }, []);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hours || !tasksDone || !date) return;

    try {
      await addDoc(collection(db, 'reports'), {
        employeeId: userData?.id || 'unknown',
        employeeName: userData?.name || 'User',
        employeeAvatar: userData?.initial || 'U',
        role: userData?.role || 'Team Member',
        date,
        status: 'Submitted',
        hours: parseFloat(hours),
        tasksDone: parseInt(tasksDone),
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'activities'), {
        text: `${userData?.name || 'User'} submitted their daily report`,
        type: 'report',
        iconColor: 'text-nyghto-yellow',
        createdAt: serverTimestamp()
      });

      setIsSubmitting(false);
      setHours('');
      setTasksDone('');
    } catch (error) {
      console.error("Error submitting report:", error);
    }
  };

  const handleUpdateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;
    try {
      await updateDoc(doc(db, 'reports', editingReport.id), {
        hours: parseFloat(editHours),
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
    // Format date as YYYY-MM-DD
    const dateStr = `${attendanceYear}-${String(attendanceMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const docId = `${dateStr}_${userId}`;
    
    // Find current status
    const currentRecord = attendanceRecords.find(r => r.userId === userId && r.date === dateStr);
    const currentStatus = currentRecord?.status || 'None';
    
    // Cycle: None -> Present -> Half Day -> Absent -> Off Day -> None
    let nextStatus = 'Present';
    if (currentStatus === 'Present') nextStatus = 'Half Day';
    else if (currentStatus === 'Half Day') nextStatus = 'Absent';
    else if (currentStatus === 'Absent') nextStatus = 'Off Day';
    else if (currentStatus === 'Off Day') nextStatus = 'None';

    try {
      if (nextStatus === 'None') {
        await deleteDoc(doc(db, 'attendance', docId));
      } else {
        await setDoc(doc(db, 'attendance', docId), {
          userId,
          date: dateStr,
          status: nextStatus,
          updatedAt: serverTimestamp(),
          updatedBy: userData?.name || 'User'
        });
      }
    } catch (error) {
      console.error("Error updating attendance:", error);
    }
  };

  const updateMemberStatus = async (memberId: string, status: string) => {
    try {
      await setDoc(doc(db, 'teamStatus', memberId), { status }, { merge: true });
    } catch (error) {
      console.error("Error updating team status:", error);
    }
  };

  const totalReports = reports.length;
  // Calculate average submission rate or pending - since we don't know total employees easily, we'll simplify.
  const submittedReports = reports.filter(r => r.status === 'Submitted').length;
  
  // Days in month logic
  const daysInMonth = new Date(attendanceYear, attendanceMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName = new Date(attendanceYear, attendanceMonth).toLocaleString('default', { month: 'long' });
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10" onClick={() => setActiveDropdown(null)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Team & Reports</h1>
          <p className="text-gray-400">Manage your team and view daily work reports.</p>
        </div>
        <button 
          onClick={() => setIsSubmitting(true)}
          className="btn-primary flex items-center gap-2 w-fit"
        >
          <Plus className="w-5 h-5" /> Submit My Report
        </button>
      </div>

      {/* Big Tab Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {[
          { id: 'Daily Reports', icon: FileText, desc: 'View & submit daily logs' },
          { id: 'Team Members', icon: Users, desc: 'Manage your team profiles' },
          { id: 'Attendance', icon: CheckCircle2, desc: 'Track daily presence' }
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
                <div className="text-2xl font-bold">{totalReports > 0 ? '100%' : '0%'}</div>
                <div className="text-sm text-gray-400">Submission Rate</div>
              </div>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-gray-400">
                  <tr>
                    <th className="px-6 py-4 font-medium rounded-tl-xl">Employee</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Hours Logged</th>
                    <th className="px-6 py-4 font-medium">Tasks Done</th>
                    <th className="px-6 py-4 font-medium text-right rounded-tr-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-800 border border-nyghto-border flex items-center justify-center font-medium">
                            {report.employeeAvatar}
                          </div>
                          <div>
                            <div className="font-medium text-white group-hover:text-nyghto-orange transition-colors">{report.employeeName}</div>
                            <div className="text-xs text-gray-500">{report.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{report.date}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                          report.status === 'Submitted' 
                            ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                            : 'bg-yellow-500/10 text-nyghto-yellow border-yellow-500/20'
                        }`}>
                          {report.status === 'Submitted' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium">{report.hours > 0 ? `${report.hours}h` : '-'}</td>
                      <td className="px-6 py-4 text-gray-300">{report.tasksDone > 0 ? report.tasksDone : '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-block text-left">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown === report.id ? null : report.id);
                            }}
                            className="p-1 text-gray-500 hover:text-white transition-colors"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          {activeDropdown === report.id && (
                            <div className="absolute right-0 mt-2 bg-nyghto-dark border border-white/10 shadow-xl rounded-lg w-32 py-1 z-10">
                              <button
                                onClick={() => {
                                  setEditingReport(report);
                                  setEditHours(report.hours.toString());
                                  setEditTasksDone(report.tasksDone.toString());
                                  setActiveDropdown(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors"
                              >
                                Edit Report
                              </button>
                              <button
                                onClick={() => deleteReport(report.id)}
                                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-white/5 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
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
          {TEAM_MEMBERS.map(member => (
            <div key={member.id} className="glass-card p-6 flex flex-col items-center text-center hover:border-nyghto-orange/30 transition-colors">
              <div className={`w-20 h-20 rounded-full ${member.color} flex items-center justify-center text-2xl font-bold text-white mb-4 shadow-lg`}>
                {member.initial}
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{member.name}</h3>
              <p className="text-sm text-gray-400 mb-4">{member.role}</p>
              
              <div className="flex gap-2 w-full mt-2">
                <button 
                  onClick={() => setSelectedProfile(member)}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-white/10"
                >
                  View Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Attendance' && (
        <div className="glass-card p-6 flex flex-col max-h-[800px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-white">Monthly Register</h3>
              <p className="text-sm text-gray-400">Click a cell to cycle: Present → Half Day → Absent → Off Day → Clear</p>
            </div>
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
          
          <div className="overflow-x-auto flex-1 custom-scrollbar pb-4 border border-white/10 rounded-xl">
            <table className="w-full text-center text-sm border-collapse">
              <thead className="bg-white/5 text-gray-300 sticky top-0 z-10 shadow-md">
                <tr>
                  <th className="px-4 py-3 font-semibold border-b border-r border-white/10 sticky left-0 bg-nyghto-dark/95 backdrop-blur-sm z-20 w-24">Date</th>
                  {TEAM_MEMBERS.map(member => (
                    <th key={member.id} className="px-4 py-3 font-semibold border-b border-white/10 min-w-[120px]">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-6 h-6 rounded-full ${member.color} text-white flex items-center justify-center text-xs font-bold`}>{member.initial}</div>
                        {member.name}
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
                      <td className={`px-4 py-2 border-r border-white/10 font-medium sticky left-0 bg-nyghto-dark/95 backdrop-blur-sm ${isToday ? 'text-nyghto-orange' : 'text-gray-400'}`}>
                        {day} {monthName.substring(0, 3)}
                      </td>
                      {TEAM_MEMBERS.map(member => {
                        const record = attendanceRecords.find(r => r.userId === member.id && r.date === dateStr);
                        const status = record?.status || 'None';
                        
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
                              onClick={() => cycleAttendance(member.id, day)}
                              className={`w-10 h-8 rounded border transition-all ${classes}`}
                              title={`Click to change status (Currently: ${status})`}
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
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-gray-500/20 border border-gray-500/30 flex items-center justify-center text-[10px] text-gray-400 font-bold">O</div> = Off Day</div>
          </div>
        </div>
      )}

      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Submit Daily Report</h2>
              <button 
                onClick={() => setIsSubmitting(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
                <input 
                  type="date" 
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Hours Logged</label>
                  <input 
                    type="number" 
                    step="0.5"
                    min="0"
                    max="24"
                    required
                    value={hours}
                    onChange={e => setHours(e.target.value)}
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Tasks Completed</label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    value={tasksDone}
                    onChange={e => setTasksDone(e.target.value)}
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsSubmitting(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
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
          <div className="glass-card w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Edit Report</h2>
              <button 
                onClick={() => setEditingReport(null)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateReport} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Hours Logged</label>
                  <input 
                    type="number" 
                    step="0.5"
                    min="0"
                    max="24"
                    required
                    value={editHours}
                    onChange={e => setEditHours(e.target.value)}
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
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
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setEditingReport(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </form>
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
              <div className={`w-24 h-24 rounded-full ${selectedProfile.color} flex items-center justify-center text-4xl font-bold text-white mb-4 shadow-lg ring-4 ring-white/10`}>
                {selectedProfile.initial}
              </div>
              <h2 className="text-2xl font-bold text-white tracking-wide">{selectedProfile.name}</h2>
              <p className="text-nyghto-orange font-medium mt-1">{selectedProfile.role}</p>
            </div>
            
            <div className="space-y-3">
              <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center justify-between">
                <div className="text-xs text-gray-400">Email Address</div>
                <div className="text-sm font-medium text-white">{selectedProfile.name.toLowerCase()}@nyghto.com</div>
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center justify-between">
                <div className="text-xs text-gray-400">Phone Number</div>
                <div className="text-sm font-medium text-white">{selectedProfile.phone}</div>
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center justify-between">
                <div className="text-xs text-gray-400">Status</div>
                <select 
                  value={teamStatus[selectedProfile.id] || 'Active'}
                  onChange={(e) => updateMemberStatus(selectedProfile.id, e.target.value)}
                  className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer text-right appearance-none"
                  style={{
                    color: (teamStatus[selectedProfile.id] || 'Active') === 'Active' ? '#4ade80' : 
                           ((teamStatus[selectedProfile.id] === 'On Leave') ? '#facc15' : '#f87171')
                  }}
                >
                  <option value="Active" className="text-theme-text bg-theme-bg">Active</option>
                  <option value="On Leave" className="text-theme-text bg-theme-bg">On Leave</option>
                  <option value="Inactive" className="text-theme-text bg-theme-bg">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
