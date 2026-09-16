import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Users, Target, Activity, CheckCircle2, Clock, Calendar, Wallet, Landmark, ArrowDownRight, ChevronDown, IndianRupee } from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Task, Project, Report, Withdrawal } from '../types';

// Revenue data is now dynamically calculated from projects

// Productivity data is now dynamically calculated from reports

export default function Analytics() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [timeFilter, setTimeFilter] = useState<'This Month' | 'Last 30 Days' | 'Last 90 Days' | 'This Year' | 'All Time' | 'Custom'>('This Month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showAllFinanceCards, setShowAllFinanceCards] = useState(false);

  useEffect(() => {
    const unsubTasks = onSnapshot(query(collection(db, 'tasks')), snapshot => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[]);
    });

    const unsubProjects = onSnapshot(query(collection(db, 'projects')), snapshot => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[]);
    });

    const unsubReports = onSnapshot(query(collection(db, 'reports')), snapshot => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Report[]);
    });

    const unsubWithdrawals = onSnapshot(query(collection(db, 'withdrawals')), snapshot => {
      setWithdrawals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Withdrawal[]);
    });

    return () => {
      unsubTasks();
      unsubProjects();
      unsubReports();
      unsubWithdrawals();
    };
  }, []);

  const filterByTime = (dateValue: any) => {
    if (timeFilter === 'All Time') return true;
    
    let date = new Date();
    if (dateValue) {
      if (typeof dateValue === 'number') date = new Date(dateValue);
      else if (dateValue.seconds) date = new Date(dateValue.seconds * 1000);
      else if (dateValue.toDate) date = dateValue.toDate();
      else date = new Date(dateValue);
    } else {
      return true; // if no date, include it by default
    }
    
    if (isNaN(date.getTime())) return true;

    const now = new Date();
    if (timeFilter === 'This Month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    } else if (timeFilter === 'Last 30 Days') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return date >= past30 && date <= now;
    } else if (timeFilter === 'Last 90 Days') {
      const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return date >= past90 && date <= now;
    } else if (timeFilter === 'This Year') {
      return date.getFullYear() === now.getFullYear();
    } else if (timeFilter === 'Custom') {
      if (!customStartDate && !customEndDate) return true;
      const start = customStartDate ? new Date(customStartDate) : new Date(0);
      const end = customEndDate ? new Date(customEndDate + 'T23:59:59') : new Date(8640000000000000);
      return date >= start && date <= end;
    }
    return true;
  };

  const filteredTasks = tasks.filter(t => filterByTime(t.createdAt));
  const filteredProjects = projects.filter(p => filterByTime(p.createdAt));
  const filteredReports = reports.filter(r => filterByTime(r.createdAt));
  const filteredWithdrawals = withdrawals.filter(w => filterByTime(w.date || w.createdAt));

  // Derived Metrics
  const tasksCompleted = filteredTasks.filter(t => t.status === 'Completed').length;
  const uniqueClients = new Set(filteredProjects.map(p => p.client)).size;
  const totalRevenue = filteredProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
  const totalAdvance = filteredProjects.reduce((sum, p) => sum + (Number(p.advance) || 0), 0);
  
  const getGot = (p: Project) => {
    if (p.receivedAmount !== undefined && p.receivedAmount !== null && p.receivedAmount !== '') {
      return Number(p.receivedAmount) || 0;
    }
    return Number(p.advance) || 0;
  };

  const totalGotMoney = filteredProjects.reduce((sum, p) => sum + getGot(p), 0);
  const totalWithdrawn = filteredWithdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
  const currentPeriodBalance = totalGotMoney - totalWithdrawn;
  const totalPending = Math.max(0, totalRevenue - totalGotMoney);

  const lifetimeTotalRevenue = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
  const lifetimeAdvance = projects.reduce((sum, p) => sum + (Number(p.advance) || 0), 0);
  const lifetimeGotMoney = projects.reduce((sum, p) => sum + getGot(p), 0);
  const lifetimeWithdrawn = withdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
  const lifetimeAccountBalance = lifetimeGotMoney - lifetimeWithdrawn;
  const lifetimePending = Math.max(0, lifetimeTotalRevenue - lifetimeGotMoney);
  
  // Project Distribution
  const projectStatusCounts = filteredProjects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const projectStatusData = [
    { name: 'Completed', value: projectStatusCounts['Completed'] || 0, color: '#10B981' },
    { name: 'In Progress', value: projectStatusCounts['In Progress'] || 0, color: '#FF6B00' },
    { name: 'Planning', value: projectStatusCounts['Planning'] || 0, color: '#FFC107' },
    { name: 'On Hold', value: projectStatusCounts['On Hold'] || 0, color: '#6B7280' },
  ].filter(d => d.value > 0);

  // Fallback if empty
  if (projectStatusData.length === 0) {
    projectStatusData.push({ name: 'No Projects', value: 1, color: '#333' });
  }

  // Monthly Revenue Growth Calculation
  const monthlyRevenue = [
    { name: 'Jan', monthIndex: 0, current: 0, previous: 0 },
    { name: 'Feb', monthIndex: 1, current: 0, previous: 0 },
    { name: 'Mar', monthIndex: 2, current: 0, previous: 0 },
    { name: 'Apr', monthIndex: 3, current: 0, previous: 0 },
    { name: 'May', monthIndex: 4, current: 0, previous: 0 },
    { name: 'Jun', monthIndex: 5, current: 0, previous: 0 },
    { name: 'Jul', monthIndex: 6, current: 0, previous: 0 },
    { name: 'Aug', monthIndex: 7, current: 0, previous: 0 },
    { name: 'Sep', monthIndex: 8, current: 0, previous: 0 },
    { name: 'Oct', monthIndex: 9, current: 0, previous: 0 },
    { name: 'Nov', monthIndex: 10, current: 0, previous: 0 },
    { name: 'Dec', monthIndex: 11, current: 0, previous: 0 },
  ];

  const currentYear = new Date().getFullYear();

  filteredProjects.forEach(p => {
    if (p.budget) {
      let date = new Date();
      if (p.createdAt) {
        if (typeof p.createdAt === 'number') date = new Date(p.createdAt);
        else if ((p.createdAt as any).seconds) date = new Date((p.createdAt as any).seconds * 1000);
        else date = new Date(p.createdAt);
      }
      
      const month = date.getMonth();
      const year = date.getFullYear();
      
      if (year === currentYear) {
        monthlyRevenue[month].current += Number(p.budget);
      } else if (year === currentYear - 1) {
        monthlyRevenue[month].previous += Number(p.budget);
      }
    }
  });

  // Department Productivity Calculation
  const productivityData = [
    { name: 'Mon', dayIndex: 1, design: 0, dev: 0, mgt: 0 },
    { name: 'Tue', dayIndex: 2, design: 0, dev: 0, mgt: 0 },
    { name: 'Wed', dayIndex: 3, design: 0, dev: 0, mgt: 0 },
    { name: 'Thu', dayIndex: 4, design: 0, dev: 0, mgt: 0 },
    { name: 'Fri', dayIndex: 5, design: 0, dev: 0, mgt: 0 },
    { name: 'Sat', dayIndex: 6, design: 0, dev: 0, mgt: 0 },
    { name: 'Sun', dayIndex: 0, design: 0, dev: 0, mgt: 0 },
  ];

  filteredReports.forEach(r => {
    let date = new Date();
    if (r.createdAt) {
      if (typeof r.createdAt === 'number') date = new Date(r.createdAt);
      else if ((r.createdAt as any).seconds) date = new Date((r.createdAt as any).seconds * 1000);
      else date = new Date(r.createdAt);
    }
    const day = date.getDay();
    const target = productivityData.find(d => d.dayIndex === day);
    
    if (target && r.tasksDone) {
      if (r.userName === 'RINSHAN' || r.userId === 'RINSHAN') target.dev += Number(r.tasksDone);
      else if (r.userName === 'AMAL' || r.userId === 'AMAL') target.design += Number(r.tasksDone);
      else if (r.userName === 'SHAHAL' || r.userId === 'SHAHAL') target.mgt += Number(r.tasksDone);
      else target.dev += Number(r.tasksDone); // fallback
    }
  });

  // Calculate generic team productivity (tasks done vs hours)
  let totalTasksDone = 0;
  let totalHoursLogged = 0;
  filteredReports.forEach(r => {
    totalTasksDone += r.tasksDone;
    totalHoursLogged += r.hours;
  });
  const productivityScore = totalHoursLogged > 0 ? Math.round((totalTasksDone / totalHoursLogged) * 100) : 0;

  const exportReport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + `Analytics Report (${timeFilter})\n\n`
      + "Metric,Value\n"
      + `Total Revenue,$${totalRevenue}\n`
      + `Tasks Completed,${tasksCompleted}\n`
      + `Unique Clients,${uniqueClients}\n`
      + `Productivity Score,${productivityScore > 100 ? 100 : productivityScore}%\n`;
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NyghtoOS_Analytics_${timeFilter.replace(' ', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Analytics</h1>
          <p className="text-gray-400">Detailed reports and performance metrics based on your data.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:text-white hover:bg-white/10 transition-colors text-sm focus:outline-none focus:border-nyghto-orange cursor-pointer font-medium"
          >
            <option value="This Month" className="bg-nyghto-dark">📅 This Month (Default)</option>
            <option value="Last 30 Days" className="bg-nyghto-dark">Last 30 Days</option>
            <option value="Last 90 Days" className="bg-nyghto-dark">Last 90 Days</option>
            <option value="This Year" className="bg-nyghto-dark">This Year</option>
            <option value="All Time" className="bg-nyghto-dark">All Time (Lifetime)</option>
            <option value="Custom" className="bg-nyghto-dark">📆 Custom Calendar Range</option>
          </select>
          <button
            type="button"
            onClick={() => setShowAllFinanceCards(!showAllFinanceCards)}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-nyghto-orange hover:text-white border border-nyghto-orange/30 transition-all flex items-center gap-1.5"
          >
            <span>{showAllFinanceCards ? 'Show Less' : 'Show All'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAllFinanceCards ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={exportReport} className="btn-primary flex items-center gap-2 text-sm">
            Export Report
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker in Analytics */}
      {timeFilter === 'Custom' && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Calendar className="w-3.5 h-3.5 text-nyghto-orange" />
            <span className="font-medium">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-nyghto-dark border border-white/10 rounded-lg py-1 px-2 text-xs text-white focus:outline-none focus:border-nyghto-orange"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Calendar className="w-3.5 h-3.5 text-nyghto-orange" />
            <span className="font-medium">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-nyghto-dark border border-white/10 rounded-lg py-1 px-2 text-xs text-white focus:outline-none focus:border-nyghto-orange"
            />
          </div>
          {(customStartDate || customEndDate) && (
            <button
              type="button"
              onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
              className="text-[11px] text-gray-400 hover:text-white underline ml-auto"
            >
              Reset Dates
            </button>
          )}
        </div>
      )}

      {/* Primary Financial Summary Cards: Nyghto AC Balance, Total Money, Pending Money */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Nyghto AC Balance */}
        <div className="glass-card hover-scale p-5 flex flex-col justify-between border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-center text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">Nyghto AC Balance</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl lg:text-3xl font-black mt-2 ${currentPeriodBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ₹{currentPeriodBalance.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-emerald-400/80 mt-2 flex justify-between items-center pt-2 border-t border-emerald-500/20">
            <span>Available Cash</span>
            <span className="text-gray-400 font-medium">Life: ₹{lifetimeAccountBalance.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* 2. Total Revenue */}
        <div className="glass-card hover-scale p-5 flex flex-col justify-between border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Total Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-white mt-2">₹{totalRevenue.toLocaleString('en-IN')}</div>
          <div className="text-xs text-gray-400 mt-2 flex justify-between items-center pt-2 border-t border-white/5">
            <span>{filteredProjects.length} projects</span>
            <span className="text-gray-400 font-medium">Life: ₹{lifetimeTotalRevenue.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* 3. Pending Money */}
        <div className="glass-card hover-scale p-5 flex flex-col justify-between border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
          <div className="flex justify-between items-center text-amber-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Money</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-amber-400 mt-2">₹{totalPending.toLocaleString('en-IN')}</div>
          <div className="text-xs text-amber-400/80 mt-2 flex justify-between items-center pt-2 border-t border-white/5">
            <span>
              {totalRevenue > 0 ? `${Math.round((totalPending / totalRevenue) * 100)}% balance due` : '0% due'}
            </span>
            <span className="text-gray-400 font-medium">Life: ₹{lifetimePending.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Expanded Financial Cards in Analytics (Shown only when Show All is clicked) */}
      {showAllFinanceCards && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Withdrawn Money */}
          <div className="glass-card hover-scale p-4 flex flex-col justify-between border-rose-500/30 bg-rose-500/10">
            <div className="flex justify-between items-center text-rose-400">
              <span className="text-xs font-bold uppercase tracking-wider">Withdrawn Money</span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-rose-400 mt-2">₹{totalWithdrawn.toLocaleString('en-IN')}</div>
            <div className="text-xs text-rose-400/80 mt-2 flex justify-between items-center pt-2 border-t border-white/5">
              <span>{filteredWithdrawals.length} withdrawals</span>
              <span className="text-gray-400">Life: ₹{lifetimeWithdrawn.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Total Got Money */}
          <div className="glass-card hover-scale p-4 flex flex-col justify-between border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
            <div className="flex justify-between items-center text-emerald-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Got Money</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-emerald-400 mt-2">₹{totalGotMoney.toLocaleString('en-IN')}</div>
            <div className="text-xs text-emerald-400/80 mt-2 flex justify-between items-center pt-2 border-t border-white/5">
              <span>
                {totalRevenue > 0 ? `${Math.round((totalGotMoney / totalRevenue) * 100)}% collected` : '0% collected'}
              </span>
              <span className="text-gray-500">Life: ₹{lifetimeGotMoney.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Advance Money */}
          <div className="glass-card hover-scale p-4 flex flex-col justify-between border-blue-400/20 bg-gradient-to-br from-blue-400/5 to-transparent">
            <div className="flex justify-between items-center text-blue-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Advance Money</span>
              <div className="w-8 h-8 rounded-lg bg-blue-400/20 border border-blue-400/30 text-blue-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-blue-400 mt-2">₹{totalAdvance.toLocaleString('en-IN')}</div>
            <div className="text-xs text-blue-400/80 mt-2 flex justify-between items-center pt-2 border-t border-white/5">
              <span>Initial advance</span>
              <span className="text-gray-500">Life: ₹{lifetimeAdvance.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card hover-scale p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-sm font-medium">Team Productivity</span>
            <Activity className="w-4 h-4 text-nyghto-orange" />
          </div>
          <div className="text-2xl font-bold">{productivityScore > 100 ? 100 : productivityScore}%</div>
          <div className="text-xs text-gray-400">Based on reports logged</div>
        </div>
        <div className="glass-card hover-scale p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-sm font-medium">Tasks Completed</span>
            <Target className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold">{tasksCompleted}</div>
          <div className="text-xs text-gray-400">In selected period</div>
        </div>
        <div className="glass-card hover-scale p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-sm font-medium">Unique Clients</span>
            <Users className="w-4 h-4 text-nyghto-yellow" />
          </div>
          <div className="text-2xl font-bold">{uniqueClients}</div>
          <div className="text-xs text-gray-400">Active portfolio</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Comparison */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-6">Revenue Growth (Real Data)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF6B00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" stroke="#666" axisLine={false} tickLine={false} />
                <YAxis stroke="#666" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#161616', borderColor: '#2A2A2A', borderRadius: '8px' }} />
                <Legend />
                <Area type="monotone" dataKey="current" name={currentYear.toString()} stroke="#FF6B00" fillOpacity={1} fill="url(#colorCurrent)" />
                <Area type="monotone" dataKey="previous" name={(currentYear - 1).toString()} stroke="#666" fill="transparent" strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Team Productivity */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-6">Department Productivity (Real Data)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" stroke="#666" axisLine={false} tickLine={false} />
                <YAxis stroke="#666" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#161616', borderColor: '#2A2A2A', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="dev" name="CEO" stackId="a" fill="#FF6B00" />
                <Bar dataKey="design" name="CTO" stackId="a" fill="#FFC107" />
                <Bar dataKey="mgt" name="CPO" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Status Distribution */}
        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="text-lg font-bold mb-6">Project Distribution (Real Data)</h3>
          <div className="h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {projectStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#161616', borderColor: '#2A2A2A', borderRadius: '8px' }} />
                <Legend verticalAlign="middle" align="right" layout="vertical" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
