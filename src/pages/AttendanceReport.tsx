import React, { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTeam } from '../contexts/TeamContext';

export default function AttendanceReport() {
  const { teamMembers } = useTeam();
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [displayMonth, setDisplayMonth] = useState(new Date().getMonth());
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [selectedMember, setSelectedMember] = useState<any>(null);
  
  useEffect(() => {
    const unsubAttendance = onSnapshot(collection(db, 'attendance'), snapshot => {
      setAttendanceRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubAttendance();
  }, []);

  const firstDay = new Date(displayYear, displayMonth, 1).getDay();
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  const monthName = new Date(displayYear, displayMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  
  let totalSundays = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    if (new Date(displayYear, displayMonth, i).getDay() === 0) totalSundays++;
  }
  const maxMarksForMonth = (daysInMonth - totalSundays) * 10;

  const calculateScore = (memberId: string) => {
    let totalMarks = 0;
    let leavesTaken = 0;
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const record = attendanceRecords.find(r => r.userId === memberId && r.date === dateStr);
      const status = record?.status || 'None';
      const isSunday = new Date(displayYear, displayMonth, i).getDay() === 0;

      if (!isSunday && status !== 'Off Day') {
        if (status === 'Present') totalMarks += 10;
        else if (status === 'Half Day') totalMarks += 5;
        else if (status === 'Absent') leavesTaken++;
      }
    }
    
    const freeLeaves = Math.min(leavesTaken, 2);
    totalMarks += (freeLeaves * 10);
    
    return totalMarks;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 text-theme-text">Attendance Report</h1>
          <p className="text-theme-muted">Monthly attendance overview for the team.</p>
        </div>
      </div>

      <div className="glass-card p-6 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-theme-text">Monthly Summary</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(y => y - 1); }
                else setDisplayMonth(m => m - 1);
              }}
              className="p-1.5 text-theme-muted hover:text-theme-text hover:bg-theme-border rounded transition-colors"
            >
              &lt;
            </button>
            <div className="flex items-center gap-2 px-2">
              <Calendar className="w-5 h-5 text-nyghto-orange" />
              <span className="text-sm font-medium text-theme-text w-32 text-center">{monthName}</span>
            </div>
            <button 
              onClick={() => {
                if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(y => y + 1); }
                else setDisplayMonth(m => m + 1);
              }}
              className="p-1.5 text-theme-muted hover:text-theme-text hover:bg-theme-border rounded transition-colors"
            >
              &gt;
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMembers.map(member => {
            const score = calculateScore(member.id);
            const percentage = maxMarksForMonth > 0 ? Math.round((score / maxMarksForMonth) * 100) : 0;
            
            return (
              <div 
                key={member.id} 
                onClick={() => setSelectedMember(member)}
                className="p-5 bg-theme-bg/50 rounded-xl border border-theme-border flex items-center justify-between hover:border-nyghto-orange/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  {member.avatarImage ? (
                    <img src={member.avatarImage} alt={member.name} className="w-12 h-12 rounded-full object-cover shadow-sm border-2 border-theme-border group-hover:border-nyghto-orange transition-colors" />
                  ) : (
                    <div className={`w-12 h-12 rounded-full ${member.color} flex items-center justify-center text-white font-bold text-xl shadow-sm border-2 border-theme-border group-hover:border-nyghto-orange transition-colors`}>
                      {member.initial}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-theme-text group-hover:text-nyghto-orange transition-colors">{member.name}</h4>
                    <div className="text-sm text-theme-muted mt-1">{score} / {maxMarksForMonth} Marks</div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-xl font-bold ${percentage >= 80 ? 'text-green-500' : percentage >= 50 ? 'text-nyghto-yellow' : 'text-red-500'}`}>
                    {percentage}%
                  </span>
                  <span className="text-[10px] text-theme-muted uppercase tracking-wider font-medium">Score</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Member Calendar Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setSelectedMember(null)}>
          <div className="bg-theme-card w-full max-w-md flex flex-col rounded-2xl border border-theme-border shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-theme-border">
              <div className="flex items-center gap-3">
                {selectedMember.avatarImage ? (
                  <img src={selectedMember.avatarImage} alt={selectedMember.name} className="w-10 h-10 rounded-full object-cover shadow-sm border border-theme-border" />
                ) : (
                  <div className={`w-10 h-10 rounded-full ${selectedMember.color} flex items-center justify-center text-white font-bold text-sm shadow-sm border border-theme-border`}>
                    {selectedMember.initial}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-theme-text">{selectedMember.name}'s Attendance</h2>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-2 text-theme-muted hover:text-theme-text rounded-full hover:bg-theme-border transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-theme-text">{monthName}</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(y => y - 1); }
                      else setDisplayMonth(m => m - 1);
                    }}
                    className="p-1 text-theme-muted hover:text-theme-text hover:bg-theme-border rounded transition-colors"
                  >
                    &lt;
                  </button>
                  <button 
                    onClick={() => {
                      if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(y => y + 1); }
                      else setDisplayMonth(m => m + 1);
                    }}
                    className="p-1 text-theme-muted hover:text-theme-text hover:bg-theme-border rounded transition-colors"
                  >
                    &gt;
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-theme-muted font-medium">
                <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-2"></div>
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const dateStr = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const record = attendanceRecords.find(r => r.userId === selectedMember.id && r.date === dateStr);
                  const status = record?.status || 'None';
                  
                  let styleClass = 'text-theme-text hover:bg-theme-border font-medium';
                  if (status === 'Present') styleClass = 'bg-green-500/20 text-green-500 border border-green-500/30 font-bold';
                  else if (status === 'Half Day') styleClass = 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 font-bold';
                  else if (status === 'Absent') styleClass = 'bg-red-500/20 text-red-500 border border-red-500/30 font-bold';
                  else if (status === 'Off Day') styleClass = 'bg-gray-500/20 text-gray-500 border border-gray-500/30 font-bold';

                  return (
                    <div 
                      key={day} 
                      className={`p-2 rounded-full flex items-center justify-center transition-colors ${styleClass}`} 
                      title={status !== 'None' ? status : 'No record'}
                    >
                      {day}
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 flex gap-3 text-xs justify-center text-theme-muted bg-theme-bg p-3 rounded-lg border border-theme-border flex-wrap">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/30"></div> Present</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/30"></div> Half Day</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/30"></div> Absent</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-gray-500/20 border border-gray-500/30"></div> Off Day</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
