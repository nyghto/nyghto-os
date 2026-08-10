import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Users, Target, Activity } from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Task, Project, Report } from '../types';

// Revenue data is now dynamically calculated from projects

// Productivity data is now dynamically calculated from reports

export default function Analytics() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [timeFilter, setTimeFilter] = useState('All Time');

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

    return () => {
      unsubTasks();
      unsubProjects();
      unsubReports();
    };
  }, []);

  const filterByTime = (dateValue: any) => {
    if (timeFilter === 'All Time') return true;
    
    let date = new Date();
    if (dateValue) {
      if (typeof dateValue === 'number') date = new Date(dateValue);
      else if (dateValue.seconds) date = new Date(dateValue.seconds * 1000);
      else date = new Date(dateValue);
    } else {
      return true; // if no date, include it by default
    }
    
    const now = new Date();
    if (timeFilter === 'This Month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    } else if (timeFilter === 'This Year') {
      return date.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const filteredTasks = tasks.filter(t => filterByTime(t.createdAt));
  const filteredProjects = projects.filter(p => filterByTime(p.createdAt));
  const filteredReports = reports.filter(r => filterByTime(r.createdAt));

  // Derived Metrics
  const tasksCompleted = filteredTasks.filter(t => t.status === 'Completed').length;
  const uniqueClients = new Set(filteredProjects.map(p => p.client)).size;
  const totalRevenue = filteredProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
  
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
        <div className="flex gap-2">
          <select 
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-sm focus:outline-none focus:border-nyghto-orange cursor-pointer"
          >
            <option value="All Time" className="bg-nyghto-dark">All Time</option>
            <option value="This Year" className="bg-nyghto-dark">This Year</option>
            <option value="This Month" className="bg-nyghto-dark">This Month</option>
          </select>
          <button onClick={exportReport} className="btn-primary flex items-center gap-2 text-sm">
            Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card hover-scale p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-sm font-medium">Total Revenue</span>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
          <div className="text-xs text-green-400">Calculated from Projects</div>
        </div>
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
          <div className="text-xs text-gray-400">All time</div>
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
                <Area type="monotone" dataKey="current" name="2026" stroke="#FF6B00" fillOpacity={1} fill="url(#colorCurrent)" />
                <Area type="monotone" dataKey="previous" name="2025" stroke="#666" fill="transparent" strokeDasharray="5 5" />
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
