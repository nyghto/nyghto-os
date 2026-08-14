import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, MoreVertical, Clock, CheckCircle2, AlertCircle, PlayCircle, PauseCircle, X, LayoutGrid, List, Link, ExternalLink } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { hasAdminAccess, isSuperAdmin } from '../utils/permissions';
import type { Project } from '../types';

import { useTeam } from '../contexts/TeamContext';

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Completed': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case 'In Progress': return <PlayCircle className="w-4 h-4 text-blue-400" />;
    case 'Planning': return <Clock className="w-4 h-4 text-nyghto-yellow" />;
    case 'On Hold': return <PauseCircle className="w-4 h-4 text-gray-400" />;
    default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Completed': return 'bg-green-500/20 text-green-400 border-green-500/20';
    case 'In Progress': return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
    case 'Planning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
    case 'On Hold': return 'bg-gray-500/20 text-gray-400 border-gray-500/20';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/20';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'Critical': return 'text-red-400';
    case 'High': return 'text-nyghto-orange';
    case 'Medium': return 'text-nyghto-yellow';
    case 'Low': return 'text-green-400';
    default: return 'text-gray-400';
  }
};

export default function Projects() {
  const { userData, user } = useAuth();
  const { teamMembers } = useTeam();
  const [filter, setFilter] = useState('All');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  
  // Drag and drop state
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const COLUMNS = ['Planning', 'In Progress', 'On Hold', 'Completed'];
  
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProgress, setEditProgress] = useState(0);
  const [editStatus, setEditStatus] = useState<Project['status']>('Planning');
  const [editDueDate, setEditDueDate] = useState('');
  
  // Form state
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'Planning' | 'In Progress' | 'On Hold' | 'Completed'>('Planning');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [budget, setBudget] = useState<number | ''>('');
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [links, setLinks] = useState<{title: string, url: string}[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
    });
    return () => unsubscribe();
  }, []);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !client || !category || !dueDate) return;

    try {
      await addDoc(collection(db, 'projects'), {
        name,
        client,
        category,
        status,
        progress: 0,
        dueDate,
        priority,
        budget: Number(budget) || 0,
        team: selectedTeam,
        links,
        createdAt: serverTimestamp(),
        createdBy: userData?.name || 'User'
      });
      
      await addDoc(collection(db, 'activities'), {
        text: `${userData?.name || 'User'} created project '${name}'`,
        type: 'project',
        iconColor: 'text-blue-500',
        createdAt: serverTimestamp()
      });

      setIsAddingProject(false);
      setName('');
      setClient('');
      setCategory('');
      setStatus('Planning');
      setDueDate('');
      setPriority('Medium');
      setBudget('');
      setSelectedTeam([]);
      setLinks([]);
      setLinkTitle('');
      setLinkUrl('');
    } catch (error) {
      console.error("Error adding project:", error);
    }
  };

  const deleteProject = async (projectId: string, projectName: string) => {
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      
      await addDoc(collection(db, 'activities'), {
        text: `${userData?.name || 'User'} deleted project '${projectName}'`,
        type: 'project',
        iconColor: 'text-red-500',
        createdAt: serverTimestamp()
      });
      setActiveDropdown(null);
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    try {
      await updateDoc(doc(db, 'projects', editingProject.id), {
        progress: editProgress,
        status: editStatus,
        dueDate: editDueDate
      });
      
      await addDoc(collection(db, 'activities'), {
        text: `${userData?.name || 'User'} updated project '${editingProject.name}'`,
        type: 'project',
        iconColor: 'text-blue-500',
        createdAt: serverTimestamp()
      });

      setEditingProject(null);
    } catch (error) {
      console.error("Error updating project:", error);
    }
  };

  const renderProjectCard = (project: Project) => (
    <div 
      key={project.id} 
      className="glass-card hover-scale p-6 flex flex-col hover:border-white/20 transition-all group"
      draggable={viewMode === 'kanban' && hasAdminAccess(user?.email)}
      onDragStart={(e) => handleDragStart(e, project.id)}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${getStatusColor(project.status)}`}>
          {getStatusIcon(project.status)}
          {project.status}
        </div>
        <div className="relative">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setActiveDropdown(activeDropdown === project.id ? null : project.id);
            }}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {activeDropdown === project.id && (
            <div className="absolute top-6 right-0 bg-nyghto-dark border border-white/10 shadow-xl rounded-lg w-36 py-1 z-10">
              <button
                onClick={() => {
                  setEditingProject(project);
                  setEditProgress(project.progress || 0);
                  setEditStatus(project.status);
                  setEditDueDate(project.dueDate || '');
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors"
              >
                Update Project
              </button>
              <button
                onClick={async () => {
                  const newStatus = project.status === 'On Hold' ? 'In Progress' : 'On Hold';
                  try {
                    await updateDoc(doc(db, 'projects', project.id), { status: newStatus });
                    await addDoc(collection(db, 'activities'), {
                      text: `${userData?.name || 'User'} marked project '${project.name}' as ${newStatus}`,
                      type: 'project',
                      iconColor: 'text-nyghto-yellow',
                      createdAt: serverTimestamp()
                    });
                  } catch(e) {}
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors"
              >
                {project.status === 'On Hold' ? 'Resume Project' : 'Put On Hold'}
              </button>
              {isSuperAdmin(user?.email) && (
                <button
                  onClick={() => deleteProject(project.id, project.name)}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-white/5 transition-colors"
                >
                  Delete Project
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <h3 className="text-xl font-bold mb-1 hover:text-nyghto-orange transition-colors cursor-pointer">
        {project.name}
      </h3>
      <div className="text-sm text-gray-400 mb-6 space-y-1">
        <p>{project.category} • Client: {project.client}</p>
        {project.budget && <p className="text-nyghto-orange/90 font-medium">Budget: ${project.budget.toLocaleString()}</p>}
      </div>
      
      <div className="mt-auto space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Progress</span>
            <span className="font-medium">{project.progress}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-nyghto-orange to-nyghto-yellow h-2 rounded-full transition-all duration-1000"
              style={{ width: `${project.progress}%` }}
            ></div>
          </div>
        </div>

        {/* Links Section */}
        {project.links && project.links.length > 0 && (
          <div className="space-y-2 pt-2">
            {project.links.map((link, idx) => (
              <a 
                key={idx} 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex justify-between items-center text-xs text-gray-300 hover:text-white transition-colors bg-white/5 p-2 rounded-lg border border-white/10 hover:border-nyghto-orange/50 group/link"
              >
                <div className="flex items-center gap-2 overflow-hidden pr-2">
                  <Link className="w-3 h-3 flex-shrink-0 text-nyghto-orange" />
                  <span className="truncate">{link.title}</span>
                </div>
                <div className="flex items-center gap-1 text-nyghto-orange flex-shrink-0 bg-nyghto-orange/10 px-2 py-1 rounded">
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              </a>
            ))}
          </div>
        )}
        
        <div className="flex justify-between items-center pt-4 border-t border-white/10">
          <div 
            className="flex flex-wrap gap-2 relative cursor-pointer group/team"
            onClick={(e) => {
              e.stopPropagation();
              setActiveDropdown(`team-${project.id}`);
            }}
            title="Click to manage team"
          >
            {(project.team || []).map((member, i) => {
              const memberData = teamMembers.find(m => m.name === member);
              if (!memberData) return null;
              return (
                <div 
                  key={i} 
                  className="flex items-center gap-1.5 pr-2.5 rounded-full border border-white/10 bg-white/5 group-hover/team:border-nyghto-orange/50 transition-colors z-0"
                >
                  {memberData.avatarImage ? (
                    <img 
                      src={memberData.avatarImage} 
                      alt={memberData.name} 
                      className="w-6 h-6 rounded-full object-cover shadow-sm group-hover/assign:ring-2 group-hover/assign:ring-nyghto-orange transition-all"
                    />
                  ) : (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${memberData.color || 'bg-gray-800'}`}>
                      {memberData.initial}
                    </div>
                  )}
                  <span className="text-[11px] font-medium text-gray-300">
                    {memberData.name}
                  </span>
                </div>
              );
            })}

            {activeDropdown === `team-${project.id}` && (
              <div 
                className="absolute bottom-10 left-0 bg-nyghto-dark border border-white/10 shadow-xl rounded-lg w-48 py-2 z-20"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 flex justify-between items-center">
                  Manage Team
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdown(null);
                    }}
                    className="hover:text-white transition-colors"
                    title="Close"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {teamMembers.map(member => {
                  const currentTeam = project.team || [];
                  const isSelected = currentTeam.includes(member.name);
                  return (
                    <button
                      key={member.id}
                      onClick={async () => {
                        const newTeam = isSelected 
                          ? currentTeam.filter(m => m !== member.name) 
                          : [...currentTeam, member.name];
                        try {
                          await updateDoc(doc(db, 'projects', project.id), { team: newTeam });
                        } catch(e) {}
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full ${member.color} text-white flex items-center justify-center text-[9px] font-bold`}>
                          {member.initial}
                        </div>
                        {member.name}
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-nyghto-orange" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-0.5">Due Date</div>
            <div className={`text-sm font-medium ${getPriorityColor(project.priority)}`}>
              {new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggedProjectId(projectId);
  };

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    if (draggedOverColumn !== column) {
      setDraggedOverColumn(column);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, column: string) => {
    e.preventDefault();
    setDraggedOverColumn(null);
    if (!draggedProjectId || !hasAdminAccess(user?.email)) return;

    const project = projects.find(p => p.id === draggedProjectId);
    if (project && project.status !== column) {
      try {
        await updateDoc(doc(db, 'projects', draggedProjectId), { 
          status: column,
          progress: column === 'Completed' ? 100 : column === 'In Progress' ? 50 : project.progress
        });
        await addDoc(collection(db, 'activities'), {
          text: `${userData?.name || 'User'} moved project '${project.name}' to ${column}`,
          type: 'project',
          iconColor: 'text-nyghto-yellow',
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Error moving project:", err);
      }
    }
    setDraggedProjectId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10" onClick={() => setActiveDropdown(null)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Projects</h1>
          <p className="text-gray-400">Manage all internal and client projects.</p>
        </div>
        {isSuperAdmin(user?.email) && (
          <button 
            onClick={() => setIsAddingProject(true)}
            className="btn-primary flex items-center gap-2 w-fit"
          >
            <Plus className="w-5 h-5" /> New Project
          </button>
        )}
      </div>

      <div className="glass-card p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          {viewMode === 'list' && ['All', 'Planning', 'In Progress', 'Completed', 'On Hold'].map((s) => (
            <button 
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === s 
                  ? 'bg-nyghto-orange text-white' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search projects..." 
              className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-nyghto-orange transition-colors"
            />
          </div>
          <div className="flex bg-nyghto-dark rounded-lg p-1 border border-white/10 mr-2">
            <button 
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-nyghto-orange text-white' : 'text-gray-400 hover:text-white'}`}
              title="Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-nyghto-orange text-white' : 'text-gray-400 hover:text-white'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col mt-6">
        {viewMode === 'list' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pr-2 pb-10 hide-scrollbar">
            {projects.filter(p => filter === 'All' || p.status === filter).map(project => renderProjectCard(project))}
            {projects.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-400">
                No projects found. Create one to get started!
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-4 hide-scrollbar flex-1 h-[calc(100vh-250px)]">
            {COLUMNS.map(column => {
              const columnProjects = projects.filter(p => p.status === column && (filter === 'All' || p.status === filter));
              return (
                <div 
                  key={column} 
                  className="flex-shrink-0 w-80 flex flex-col bg-nyghto-dark/30 rounded-xl border border-white/5 overflow-hidden"
                  onDragOver={(e) => handleDragOver(e, column)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column)}
                >
                  <div className={`p-4 border-b border-white/10 flex justify-between items-center bg-black/20 ${draggedOverColumn === column ? 'bg-nyghto-orange/10 border-nyghto-orange/50' : ''}`}>
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      {column}
                      <span className="text-xs font-normal text-gray-500 bg-black/40 px-2 py-0.5 rounded-full">
                        {columnProjects.length}
                      </span>
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
                    {columnProjects.map(project => renderProjectCard(project))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAddingProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">New Project</h2>
              <button 
                onClick={() => setIsAddingProject(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Project Name</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Client</label>
                  <input 
                    type="text" 
                    required
                    value={client}
                    onChange={e => setClient(e.target.value)}
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
                  <input 
                    type="text" 
                    required
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Budget ($)</label>
                <input 
                  type="number"
                  min="0"
                  value={budget}
                  onChange={e => setBudget(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Optional"
                  className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Due Date</label>
                  <input 
                    type="date" 
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Priority</label>
                  <select 
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange appearance-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Team Members</label>
                <div className="flex gap-3">
                  {teamMembers.map(member => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        if (selectedTeam.includes(member.name)) {
                          setSelectedTeam(selectedTeam.filter(m => m !== member.name));
                        } else {
                          setSelectedTeam([...selectedTeam, member.name]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full border flex items-center gap-2 text-sm transition-all ${
                        selectedTeam.includes(member.name) 
                          ? 'border-nyghto-orange bg-nyghto-orange/10 text-nyghto-orange' 
                          : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full ${member.color} text-white flex items-center justify-center text-[10px]`}>
                        {member.initial}
                      </div>
                      {member.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Project Links & Resources</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Link Title (e.g. Figma)"
                    value={linkTitle}
                    onChange={e => setLinkTitle(e.target.value)}
                    className="w-1/3 bg-nyghto-dark border border-white/10 rounded-lg py-1.5 px-3 text-sm text-white focus:outline-none focus:border-nyghto-orange"
                  />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    className="flex-1 bg-nyghto-dark border border-white/10 rounded-lg py-1.5 px-3 text-sm text-white focus:outline-none focus:border-nyghto-orange"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (linkTitle && linkUrl) {
                        setLinks([...links, { title: linkTitle, url: linkUrl }]);
                        setLinkTitle('');
                        setLinkUrl('');
                      }
                    }}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                  >
                    Add
                  </button>
                </div>
                {links.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {links.map((link, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white/5 p-2 rounded-lg text-sm border border-white/5">
                        <div className="flex items-center gap-2">
                          <Link className="w-4 h-4 text-nyghto-orange" />
                          <span className="font-medium text-white">{link.title}</span>
                          <span className="text-gray-500 truncate max-w-[150px]">{link.url}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 bg-nyghto-orange/20 text-nyghto-orange hover:bg-nyghto-orange/40 rounded-lg text-xs font-medium transition-colors"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                            className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg text-xs font-medium transition-colors"
                          >
                            <span>Remove</span>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddingProject(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Update Project</h2>
              <button 
                onClick={() => setEditingProject(null)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProject} className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-400">Progress ({editProgress}%)</label>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={editProgress}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEditProgress(val);
                    if (val === 100) setEditStatus('Completed');
                    else if (val === 0) setEditStatus('Planning');
                    else setEditStatus('In Progress');
                  }}
                  className="w-full accent-nyghto-orange h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                  <select 
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as any)}
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange appearance-none"
                  >
                    <option value="Planning">Planning</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Due Date</label>
                  <input 
                    type="date" 
                    required
                    value={editDueDate}
                    onChange={e => setEditDueDate(e.target.value)}
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setEditingProject(null)}
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
    </div>
  );
}
