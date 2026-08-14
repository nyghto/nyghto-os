import React, { useState, useEffect } from 'react';
import { 
  Briefcase, CheckCircle, Clock, AlertTriangle, 
  Users, TrendingUp, DollarSign, Activity as ActivityIcon, Calendar, Plus, Target, CheckSquare
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTeam } from '../contexts/TeamContext';
import type { CalendarLog, Activity, Task, Project } from '../types';
import { X } from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { AIInsights } from '../components/AIInsights';

function StatCard({ icon: Icon, label, value, trend, trendUp }: any) {
  return (
    <div className="glass-card hover-scale p-6 flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="p-3 bg-theme-bg rounded-lg border border-theme-border shadow-sm">
          <Icon className="w-6 h-6 text-nyghto-orange" />
        </div>
        {trend && (
          <span className={`text-sm font-medium ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
            {trendUp ? '+' : '-'}{trend}%
          </span>
        )}
      </div>
      <div>
        <h3 className="text-theme-muted text-sm font-medium mb-1">{label}</h3>
        <div className="text-3xl font-bold text-theme-text">{value}</div>
      </div>
    </div>
  );
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'task': return CheckCircle;
    case 'project': return Briefcase;
    case 'client': return Users;
    case 'report': return ActivityIcon;
    default: return ActivityIcon;
  }
};

const formatTaskDate = (dateString: string) => {
  if (!dateString || dateString === 'Today') return dateString;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`;
  } catch (e) {
    return dateString;
  }
};

export default function Dashboard() {
  const { user, userData } = useAuth();
  const { teamMembers } = useTeam();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().getDate());
  const [newLog, setNewLog] = useState("");
  
  // Real data state
  const [logs, setLogs] = useState<CalendarLog[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAllActivity, setShowAllActivity] = useState(false);

  useEffect(() => {
    const unsubLogs = onSnapshot(query(collection(db, 'calendarLogs'), orderBy('createdAt', 'asc')), snapshot => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CalendarLog[]);
    });

    const unsubActivities = onSnapshot(query(collection(db, 'activities'), orderBy('createdAt', 'desc'), limit(50)), snapshot => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Activity[]);
    });

    const unsubTasks = onSnapshot(query(collection(db, 'tasks')), snapshot => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[]);
    });

    const unsubProjects = onSnapshot(query(collection(db, 'projects')), snapshot => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[]);
    });

    return () => {
      unsubLogs();
      unsubActivities();
      unsubTasks();
      unsubProjects();
    };
  }, []);

  const currentMonthIndex = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonthIndex, 1).getDay();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonthIndex - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonthIndex + 1, 1));

  const currentMonthLogs = logs.filter(log => log.date === selectedDate && log.month === currentMonthIndex + 1 && log.year === currentYear);
  const activeDays = new Set(logs.filter(log => log.month === currentMonthIndex + 1 && log.year === currentYear).map(log => log.date));

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.trim()) return;
    try {
      await addDoc(collection(db, 'calendarLogs'), {
        date: selectedDate,
        month: currentMonthIndex + 1,
        year: currentYear,
        text: newLog.trim(),
        color: "text-blue-500",
        createdBy: userData?.name || 'User',
        createdAt: serverTimestamp()
      });
      setNewLog("");
    } catch (error) {
      console.error("Error adding log: ", error);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    try {
      await deleteDoc(doc(db, 'calendarLogs', logId));
    } catch (error) {
      console.error("Error deleting log:", error);
    }
  };

  // Derived stats
  const activeProjects = projects.filter(p => p.status !== 'Completed').length;
  const completedProjects = projects.filter(p => p.status === 'Completed').length;
  const overdueTasks = tasks.filter(t => t.status !== 'Completed' && t.priority === 'Critical').length; // Simplifying overdue logic for demo
  const totalRevenue = projects.reduce((sum, p) => sum + (p.budget || 0), 0);

  // Derived Project Chart Data
  const projectChartData = [
    { name: 'Current', completed: completedProjects, pending: activeProjects }
  ];

  // Derived Revenue Data (By Day of Week from Projects)
  const revenueData = [
    { name: 'Mon', dayIndex: 1, value: 0 },
    { name: 'Tue', dayIndex: 2, value: 0 },
    { name: 'Wed', dayIndex: 3, value: 0 },
    { name: 'Thu', dayIndex: 4, value: 0 },
    { name: 'Fri', dayIndex: 5, value: 0 },
    { name: 'Sat', dayIndex: 6, value: 0 },
    { name: 'Sun', dayIndex: 0, value: 0 },
  ];

  projects.forEach(p => {
    if (p.budget) {
      let date = new Date(); // default to today if missing
      if (p.createdAt) {
        if (typeof p.createdAt === 'number') date = new Date(p.createdAt);
        else if ((p.createdAt as any).seconds) date = new Date((p.createdAt as any).seconds * 1000);
        else date = new Date(p.createdAt);
      }
      
      const day = date.getDay();
      const target = revenueData.find(r => r.dayIndex === day);
      if (target) {
        target.value += Number(p.budget);
      }
    }
  });

  // User identity for My Tasks Today
  const currentMember = teamMembers.find(m => m.email === user?.email);
  const isAdmin = user?.email === 'team.nyghto@gmail.com';

  // Derived Upcoming Tasks
  const upcomingTasks = tasks
    .filter(t => t.status !== 'Completed')
    .sort((a, b) => {
      const pMap = { Critical: 1, High: 2, Medium: 3, Low: 4 };
      return pMap[a.priority as keyof typeof pMap] - pMap[b.priority as keyof typeof pMap];
    })
    .slice(0, 5);

  const myPendingTasks = tasks.filter(t => (isAdmin || t.assigneeId === currentMember?.id) && t.status !== 'Completed');
  
  const totalTasksCount = tasks.length;
  
  // Motivational Quotes
  const quotes = [
    "Stay focused and never give up.",
    "The only way to do great work is to love what you do.",
    "Your limitation—it's only your imagination.",
    "Push yourself, because no one else is going to do it for you.",
    "Great things never come from comfort zones.",
    "Dream it. Wish it. Do it.",
    "Success doesn’t just find you. You have to go out and get it."
  ];
  const [dailyQuote, setDailyQuote] = useState(quotes[0]);
  useEffect(() => {
    setDailyQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

  const getGreeting = () => {
    const day = new Date().getDay();
    switch(day) {
      case 0: return { main: 'Relax, it\'s Sunday', sub: 'Enjoy your weekend!' };
      case 1: return { main: 'Happy Monday', sub: 'Let\'s start the week strong!' };
      case 2: return { main: 'Terrific Tuesday', sub: 'Keep the momentum going!' };
      case 3: return { main: 'Wonderful Wednesday', sub: 'Halfway through the week!' };
      case 4: return { main: 'Thrilling Thursday', sub: 'Almost there!' };
      case 5: return { main: 'Thank God it\'s Friday', sub: 'Finish up and relax!' };
      case 6: return { main: 'Super Saturday', sub: 'Enjoy your weekend!' };
      default: return { main: 'Welcome back', sub: 'Let\'s get things done!' };
    }
  };

  const displayName = currentMember 
    ? currentMember.name.charAt(0).toUpperCase() + currentMember.name.slice(1).toLowerCase() 
    : (isAdmin ? 'Nyghto' : 'User');

  const greeting = getGreeting();

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 text-theme-text">{greeting.main}, {displayName}! {greeting.sub}</h1>
          <p className="text-theme-muted">You have {myPendingTasks.length} pending tasks today.</p>
        </div>
      </div>
      
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Briefcase} label="Active Projects" value={activeProjects.toString()} trend="14" trendUp={true} />
        <StatCard icon={CheckCircle} label="Completed Projects" value={completedProjects.toString()} trend="8" trendUp={true} />
        <StatCard icon={AlertTriangle} label="Critical Tasks" value={overdueTasks.toString()} trend="12" trendUp={false} />
        
        {/* Motivational Quote */}
        <div className="glass-card p-6 flex flex-col items-center justify-center hover-scale text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-nyghto-orange/5 to-transparent pointer-events-none" />
          <h3 className="text-theme-muted text-xs font-bold uppercase tracking-widest mb-3 opacity-70">Daily Motivation</h3>
          <p className="text-sm font-medium text-theme-text italic leading-relaxed px-2">"{dailyQuote}"</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          <AIInsights tasks={tasks} projects={projects} teamMembers={teamMembers} />
        </div>

        {/* Revenue Chart */}
        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="text-lg font-bold mb-6 text-theme-text">Revenue Overview</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF6B00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#888" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                <YAxis 
                  stroke="var(--text-muted)" 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(value) => `$${value}`} 
                  domain={[0, (dataMax) => Math.max(4000, dataMax)]}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-glass)', borderRadius: '8px', color: 'var(--text-main)' }}
                  itemStyle={{ color: '#FF6B00' }}
                />
                <Area type="monotone" dataKey="value" stroke="#FF6B00" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-6 text-theme-text">Recent Activity</h3>
          <div className="space-y-6">
            {activities.length > 0 ? (
              activities.slice(0, 5).map((activity) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="flex gap-4">
                    <div className="mt-1"><Icon className={`w-5 h-5 ${activity.iconColor}`} /></div>
                    <div>
                      <p className="text-sm font-medium text-theme-text">{activity.text.replace(/shahalmuhammed\s*404/gi, 'Nighto')}</p>
                      <p className="text-xs text-theme-muted mt-1">
                        {activity.createdAt ? new Date(activity.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                      </p>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-theme-muted italic text-center py-4">No recent activity.</p>
            )}
          </div>
          <button 
            onClick={() => setShowAllActivity(true)}
            className="w-full mt-6 py-2 border border-theme-border bg-theme-bg rounded-lg text-sm text-theme-muted hover:text-theme-text hover:bg-theme-border transition-colors"
          >
            View All Activity
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Tasks Today */}
        <div className="glass-card p-6 lg:col-span-2 flex flex-col max-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-theme-text">My Tasks Today</h3>
              <p className="text-xs text-theme-muted">Tasks assigned to you that need attention.</p>
            </div>
            <Target className="w-5 h-5 text-nyghto-orange" />
          </div>
          <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-2">
            {myPendingTasks.length > 0 ? (
              myPendingTasks.map(task => {
                const assignee = teamMembers.find(m => m.id === task.assigneeId) || teamMembers[0];
                return (
                <div key={task.id} className="flex justify-between items-center p-4 bg-theme-bg/50 rounded-xl border border-theme-border hover:border-nyghto-orange/50 transition-colors">
                  <div className="flex items-center gap-4">
                    {assignee?.avatarImage ? (
                      <img 
                        src={assignee.avatarImage} 
                        alt={assignee.name} 
                        className="w-10 h-10 rounded-full object-cover shadow-sm border-2 border-theme-border"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-full ${assignee?.color || 'bg-nyghto-orange'} flex items-center justify-center text-white font-bold shadow-sm border-2 border-theme-border`}>
                        {assignee?.initial || 'U'}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-theme-text text-sm">{task.title}</h4>
                      <p className="text-xs text-theme-muted mt-0.5">{task.project}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold mb-1
                      ${task.priority === 'Critical' ? 'bg-red-500/20 text-red-500' : 
                        task.priority === 'High' ? 'bg-orange-500/20 text-orange-500' : 
                        task.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-600' : 
                        'bg-green-500/20 text-green-500'}`}>
                      {task.priority}
                    </span>
                    <span className="text-xs text-theme-muted font-medium">{formatTaskDate(task.dueDate)}</span>
                  </div>
                </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-theme-text font-bold">All caught up!</p>
                <p className="text-xs text-theme-muted mt-1">You have no pending tasks assigned to you.</p>
              </div>
            )}
          </div>
        </div>

        {/* Prioritized Tasks */}
        <div className="glass-card p-6 flex flex-col max-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-theme-text">Team Priorities</h3>
            <Clock className="w-5 h-5 text-theme-muted" />
          </div>
          <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-2">
            {upcomingTasks.length > 0 ? (
              upcomingTasks.map((item) => {
                const assignee = teamMembers.find(m => m.id === item.assigneeId) || teamMembers[0];
                return (
                <div key={item.id} className="flex justify-between items-center p-3 bg-theme-bg rounded-lg border border-theme-border hover:border-nyghto-orange/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    {assignee?.avatarImage ? (
                      <img 
                        src={assignee.avatarImage} 
                        alt={assignee.name} 
                        className="w-8 h-8 rounded-full object-cover shadow-sm border border-theme-border"
                        title={`Assigned to ${assignee.name}`}
                      />
                    ) : (
                      <div className={`w-8 h-8 rounded-full ${assignee?.color || 'bg-nyghto-orange'} flex items-center justify-center text-white font-bold shadow-sm text-xs border border-theme-border`} title={`Assigned to ${assignee?.name}`}>
                        {assignee?.initial || 'U'}
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium text-sm text-theme-text">{item.title}</h4>
                      <p className="text-xs text-theme-muted mt-0.5">{item.project}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[10px] px-2 py-0.5 rounded-full mb-1 inline-block font-medium
                      ${item.priority === 'Critical' ? 'bg-red-500/20 text-red-500' : 
                        item.priority === 'High' ? 'bg-orange-500/20 text-orange-500' : 
                        item.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-600' : 
                        'bg-green-500/20 text-green-500'}`}>
                      {item.priority}
                    </div>
                    <p className="text-[10px] text-theme-muted block">{formatTaskDate(item.dueDate)}</p>
                  </div>
                </div>
                );
              })
            ) : (
              <p className="text-sm text-theme-muted italic text-center py-4">No pending tasks.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Completion Chart */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-6 text-theme-text">Projects Status</h3>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#888" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-glass)', borderRadius: '8px', color: 'var(--text-main)' }}
                />
                <Legend wrapperStyle={{ color: 'var(--text-main)' }}/>
                <Bar dataKey="completed" fill="#FFC107" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" fill="#FF6B00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Custom Calendar with Interactive Logs connected to Firebase */}
        <div className="glass-card p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-theme-text">{monthName}</h3>
            <div className="flex gap-2">
              <button onClick={prevMonth} className="p-1 text-theme-muted hover:text-theme-text hover:bg-theme-border rounded transition-colors">&lt;</button>
              <button onClick={nextMonth} className="p-1 text-theme-muted hover:text-theme-text hover:bg-theme-border rounded transition-colors">&gt;</button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-theme-muted font-medium">
            <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2"></div>
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
              <div 
                key={day} 
                onClick={() => setSelectedDate(day)}
                className={`p-2 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                  selectedDate === day
                    ? 'bg-nyghto-orange text-white font-bold shadow-[0_0_10px_rgba(255,107,0,0.5)]' 
                    : activeDays.has(day)
                    ? 'bg-theme-border text-theme-text font-medium border border-nyghto-yellow/50'
                    : 'text-theme-text hover:bg-theme-border'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-theme-border flex-1 flex flex-col">
            <h4 className="text-sm font-bold text-theme-text mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-nyghto-orange" />
              Logs for {currentDate.toLocaleString('default', { month: 'short' })} {selectedDate}
            </h4>
            
            <div className="space-y-3 flex-1 mb-4 overflow-y-auto max-h-[150px] pr-1 custom-scrollbar">
              {currentMonthLogs.length > 0 ? (
                currentMonthLogs.map((log) => (
                  <div key={log.id} className="text-xs text-theme-muted flex justify-between items-start group">
                    <div className="flex gap-2">
                      <span className={log.color}>•</span> 
                      <span>{log.text}</span>
                    </div>
                    <button 
                      onClick={() => handleDeleteLog(log.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity p-0.5"
                      title="Delete log"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-xs text-theme-muted italic px-2">No activity logged for this date.</div>
              )}
            </div>

            <form onSubmit={handleAddLog} className="relative mt-auto">
              <input 
                type="text" 
                value={newLog}
                onChange={(e) => setNewLog(e.target.value)}
                placeholder="Type a new log..." 
                className="w-full bg-theme-bg border border-theme-border rounded-lg py-2 pl-3 pr-10 text-xs text-theme-text placeholder-theme-muted focus:outline-none focus:border-nyghto-orange transition-colors"
              />
              <button 
                type="submit" 
                disabled={!newLog.trim()}
                className="absolute right-1 top-1 bottom-1 p-1 rounded-md bg-nyghto-orange text-white disabled:opacity-50 disabled:bg-theme-border transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </form>
          </div>
        </div>
      </div>



      {/* All Activity Modal */}
      {showAllActivity && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-theme-card w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border border-theme-border shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-theme-border">
              <h2 className="text-xl font-bold text-theme-text">All Activity</h2>
              <button 
                onClick={() => setShowAllActivity(false)}
                className="p-2 text-theme-muted hover:text-theme-text rounded-full hover:bg-theme-border transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {activities.length > 0 ? (
                activities.map((activity) => {
                  const Icon = getActivityIcon(activity.type);
                  return (
                    <div key={activity.id} className="flex gap-4 p-4 rounded-xl border border-theme-border bg-theme-bg hover:border-nyghto-orange/30 transition-colors">
                      <div className="mt-1 bg-theme-card p-2 rounded-lg border border-theme-border shadow-sm">
                        <Icon className={`w-5 h-5 ${activity.iconColor}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-theme-text">{activity.text.replace(/shahalmuhammed\s*404/gi, 'Nighto')}</p>
                        <p className="text-xs text-theme-muted mt-2 font-medium">
                          {activity.createdAt ? new Date(activity.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                        </p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-theme-muted">
                  <ActivityIcon className="w-12 h-12 mb-4 opacity-20" />
                  <p>No activity recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
