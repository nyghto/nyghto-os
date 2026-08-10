import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, MoreVertical, Clock, CheckCircle2, AlertCircle, PlayCircle, PauseCircle, X } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Project } from '../types';

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
  const { userData } = useAuth();
  const [filter, setFilter] = useState('All');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProgress, setEditProgress] = useState(0);
  const [editStatus, setEditStatus] = useState<Project['status']>('Planning');
  
  // Form state
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'Planning' | 'In Progress' | 'On Hold' | 'Completed'>('Planning');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [budget, setBudget] = useState<number | ''>('');

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
        team: [userData?.initial || 'U'], // Just add creator for now
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
        status: editStatus
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10" onClick={() => setActiveDropdown(null)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Projects</h1>
          <p className="text-gray-400">Manage all internal and client projects.</p>
        </div>
        <button 
          onClick={() => setIsAddingProject(true)}
          className="btn-primary flex items-center gap-2 w-fit"
        >
          <Plus className="w-5 h-5" /> New Project
        </button>
      </div>

      <div className="glass-card p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          {['All', 'Planning', 'In Progress', 'Completed', 'On Hold'].map((s) => (
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
          <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.filter(p => filter === 'All' || p.status === filter).map((project) => (
          <div key={project.id} className="glass-card hover-scale p-6 flex flex-col hover:border-white/20 transition-all group">
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
                        setActiveDropdown(null);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors"
                    >
                      Update Progress
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
                    <button
                      onClick={() => deleteProject(project.id, project.name)}
                      className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-white/5 transition-colors"
                    >
                      Delete Project
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <h3 className="text-xl font-bold mb-1 hover:text-nyghto-orange transition-colors cursor-pointer">
              {project.name}
            </h3>
            <p className="text-sm text-gray-400 mb-6">{project.category} • Client: {project.client}</p>
            
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
              
              <div className="flex justify-between items-center pt-4 border-t border-white/10">
                <div className="flex -space-x-2">
                  {project.team?.map((member, i) => (
                    <div 
                      key={i} 
                      className="w-8 h-8 rounded-full bg-gray-800 border-2 border-nyghto-card flex items-center justify-center text-xs font-medium"
                    >
                      {member}
                    </div>
                  ))}
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
        ))}
        {projects.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400">
            No projects found. Create one to get started!
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
              <h2 className="text-xl font-bold">Update Progress</h2>
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
