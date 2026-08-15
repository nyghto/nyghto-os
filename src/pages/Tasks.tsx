import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, MoreVertical, MessageSquare, Paperclip, Clock, Calendar, Users, X } from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { hasAdminAccess, isSuperAdmin } from '../utils/permissions';
import { useTeam } from '../contexts/TeamContext';
import type { Task, User } from '../types';

const COLUMNS = ['To Do', 'In Progress', 'Review', 'Completed'];

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'Critical': return 'bg-red-500/20 text-red-500';
    case 'High': return 'bg-orange-500/20 text-orange-500';
    case 'Medium': return 'bg-yellow-500/20 text-yellow-600';
    case 'Low': return 'bg-green-500/20 text-green-500';
    default: return 'bg-gray-500/20 text-gray-500';
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr === 'Today') return 'Today';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return dateStr;
};

export default function Tasks() {
  const { user, userData } = useAuth();
  const isMainAdmin = isSuperAdmin(user?.email);
  const { teamMembers } = useTeam();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProject, setNewTaskProject] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('Medium');
  const [newTaskStatus, setNewTaskStatus] = useState('To Do');
  const [newTaskAssignee, setNewTaskAssignee] = useState('u1');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to real-time updates from Firestore
    const unsubscribe = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(tasksData);
    });

    return () => unsubscribe();
  }, []);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMainAdmin) return;
    if (!newTaskTitle.trim()) return;

    try {
      await addDoc(collection(db, 'tasks'), {
        title: newTaskTitle,
        project: newTaskProject || 'General',
        priority: newTaskPriority,
        status: newTaskStatus,
        dueDate: newTaskDueDate || 'Today',
        comments: 0,
        attachments: 0,
        assigneeId: newTaskAssignee,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'activities'), {
        text: `${userData?.name || 'User'} created task '${newTaskTitle}'`,
        type: 'task',
        iconColor: 'text-blue-500',
        createdAt: serverTimestamp()
      });

      setIsModalOpen(false);
      setNewTaskTitle('');
      setNewTaskProject('');
      setNewTaskPriority('Medium');
      setNewTaskAssignee(teamMembers[0]?.id || 'u1');
      setNewTaskDueDate('');
    } catch (error) {
      console.error("Error adding task: ", error);
    }
  };

  const assignTask = async (taskId: string, memberId: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        assigneeId: memberId
      });
      setActiveDropdown(null);
    } catch (error) {
      console.error("Error assigning task: ", error);
    }
  };
  
  const deleteTask = async (taskId: string, taskTitle?: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      if (taskTitle) {
        await addDoc(collection(db, 'activities'), {
          text: `${userData?.name || 'User'} deleted task '${taskTitle}'`,
          type: 'task',
          iconColor: 'text-red-500',
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error deleting task: ", error);
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault(); // allow drop
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
    if (!draggedTaskId || !user) return;

    const task = tasks.find(t => t.id === draggedTaskId);
    if (task && task.status !== column) {
      try {
        await updateDoc(doc(db, 'tasks', draggedTaskId), { status: column });
        await addDoc(collection(db, 'activities'), {
          text: `${userData?.name || 'User'} moved task '${task.title}' to ${column}`,
          type: 'task',
          iconColor: 'text-nyghto-yellow',
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Error moving task:", err);
      }
    }
    setDraggedTaskId(null);
  };

  // Group tasks by column
  const board = COLUMNS.reduce((acc, col) => {
    acc[col] = tasks.filter(t => t.status === col);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 h-full flex flex-col" onClick={() => setActiveDropdown(null)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-none">
        <div>
          <h1 className="text-3xl font-bold mb-1 text-theme-text">Tasks</h1>
          <p className="text-theme-muted">Manage your pending and assigned tasks. Powered by Firebase.</p>
        </div>
        {isMainAdmin && (
          <button onClick={() => { setNewTaskStatus('To Do'); setIsModalOpen(true); }} className="btn-primary flex items-center gap-2 w-fit">
            <Plus className="w-5 h-5" /> New Task
          </button>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 min-h-[500px]">
        {COLUMNS.map((column) => (
          <div 
            key={column} 
            onDragOver={(e) => handleDragOver(e, column)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column)}
            className={`min-w-[320px] w-[320px] flex flex-col bg-theme-bg/50 rounded-xl p-4 border transition-all ${
              draggedOverColumn === column 
                ? 'border-nyghto-orange border-dashed bg-nyghto-orange/5 shadow-[0_0_15px_rgba(255,107,0,0.1)]' 
                : 'border-theme-border shadow-inner'
            }`}
          >
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="font-bold flex items-center gap-2 text-theme-text">
                {column}
                <span className="bg-theme-border text-theme-muted text-xs py-0.5 px-2 rounded-full">
                  {board[column].length}
                </span>
              </h3>
            </div>
            
            <div className="flex flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar flex-1">
              {board[column].map((task) => {
                const assignee = teamMembers.find(m => m.id === task.assigneeId) || teamMembers[0];
                const isDragging = draggedTaskId === task.id;
                
                return (
                <div 
                  key={task.id} 
                  draggable={!!user}
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={() => setDraggedTaskId(null)}
                  className={`glass-card p-4 cursor-grab active:cursor-grabbing hover:border-nyghto-orange/30 transition-all group relative ${
                    isDragging ? 'opacity-40 scale-95 border-nyghto-orange border-dashed' : 'hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    {isMainAdmin && (
                      <button onClick={() => deleteTask(task.id, task.title)} className="text-theme-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Task">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <h4 className={`font-medium text-sm mb-1 transition-colors ${task.status === 'Completed' ? 'text-green-500' : 'group-hover:text-nyghto-orange text-theme-text'}`}>
                    {task.title}
                  </h4>
                  <p className="text-xs text-theme-muted mb-3">{task.project}</p>

                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] mb-1.5">
                      <span className="text-theme-muted">Progress</span>
                      <span className="font-medium text-theme-text">{task.status === 'Completed' ? 100 : task.status === 'In Progress' ? 50 : 0}%</span>
                    </div>
                    <div className="w-full bg-theme-border rounded-full h-1.5">
                      <div 
                        className="bg-gradient-to-r from-nyghto-orange to-nyghto-yellow h-1.5 rounded-full transition-all duration-1000"
                        style={{ width: `${task.status === 'Completed' ? 100 : task.status === 'In Progress' ? 50 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 border-t border-theme-border">
                    <div className="flex items-center gap-3 text-theme-muted">
                      {task.comments > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {task.comments}
                        </div>
                      )}
                      {task.attachments > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                          <Paperclip className="w-3.5 h-3.5" />
                          {task.attachments}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 relative">
                      <div className="relative">
                        <div 
                          className="flex items-center gap-1 text-xs text-theme-muted hover:text-nyghto-orange cursor-pointer transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdown(`date-${column}-${task.id}`);
                          }}
                          title="Click to update due date"
                        >
                          <Calendar className="w-3 h-3" />
                          {formatDate(task.dueDate)}
                        </div>
                        
                        {activeDropdown === `date-${column}-${task.id}` && (
                          <div 
                            className="absolute bottom-6 left-0 bg-theme-card border border-theme-border shadow-xl rounded-lg p-3 w-44 z-20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <label className="block text-xs font-semibold text-theme-muted mb-2">Update Due Date</label>
                            <input 
                              type="date"
                              className="w-full bg-theme-bg border border-theme-border rounded py-1 px-2 text-xs text-theme-text mb-3 focus:outline-none focus:border-nyghto-orange"
                              defaultValue={task.dueDate !== 'Today' ? task.dueDate : ''}
                              onChange={async (e) => {
                                if (!e.target.value) return;
                                try {
                                  await updateDoc(doc(db, 'tasks', task.id), { dueDate: e.target.value });
                                } catch(err) {}
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setActiveDropdown(null);
                                }
                              }}
                            />
                            <button 
                              onClick={() => setActiveDropdown(null)}
                              className="w-full text-center text-xs font-medium bg-white/5 border border-white/10 rounded py-1.5 hover:bg-white/10 transition-colors"
                            >
                              Close
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Assignee Avatar with visible button */}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(`${column}-${task.id}`);
                        }}
                        className="flex items-center gap-1.5 cursor-pointer group/assign"
                      >
                        {assignee.avatarImage ? (
                          <img 
                            src={assignee.avatarImage} 
                            alt={assignee.name} 
                            className="w-6 h-6 rounded-full object-cover shadow-sm group-hover/assign:ring-2 group-hover/assign:ring-nyghto-orange transition-all"
                            title={`Assigned to ${assignee.name}. Click to reassign.`}
                          />
                        ) : (
                          <div 
                            className={`w-6 h-6 rounded-full ${assignee.color} flex items-center justify-center text-[10px] font-bold text-white shadow-sm group-hover/assign:ring-2 group-hover/assign:ring-nyghto-orange transition-all`}
                            title={`Assigned to ${assignee.name}. Click to reassign.`}
                          >
                            {assignee.initial}
                          </div>
                        )}
                        <span className="text-[10px] text-theme-muted group-hover/assign:text-nyghto-orange font-semibold uppercase tracking-wider transition-colors">
                          {assignee.name}
                        </span>
                      </div>

                      {/* Dropdown Menu */}
                      {activeDropdown === `${column}-${task.id}` && (
                        <div 
                          className="absolute bottom-8 right-0 bg-theme-card border border-theme-border shadow-xl rounded-lg w-48 py-2 z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="px-3 py-1.5 text-xs font-semibold text-theme-muted flex items-center gap-2">
                            <Users className="w-3 h-3" /> Assign To
                          </div>
                          {teamMembers.map(member => (
                            <button
                              key={member.id}
                              onClick={() => assignTask(task.id, member.id)}
                              className="w-full text-left px-3 py-2 text-sm text-theme-text hover:bg-theme-border transition-colors flex items-center gap-2"
                            >
                              <div className={`w-5 h-5 rounded-full ${member.color} text-white flex items-center justify-center text-[9px] font-bold`}>
                                {member.initial}
                              </div>
                              {member.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )})}
              
              {column === 'To Do' && isMainAdmin && (
                <button 
                  onClick={() => { setNewTaskStatus(column); setIsModalOpen(true); }}
                  className="mt-2 py-2 w-full rounded-lg border border-dashed border-theme-border text-theme-muted text-sm hover:border-nyghto-orange hover:text-nyghto-orange transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Task
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Simple Add Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
          <div className="bg-theme-card w-full max-w-md p-6 rounded-2xl border border-theme-border shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-theme-text">Create New Task</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-theme-muted hover:text-theme-text rounded-full hover:bg-theme-border">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-theme-muted mb-1">Task Title</label>
                <input 
                  type="text" 
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="E.g. Update UI Components"
                  className="w-full bg-theme-bg border border-theme-border rounded-lg py-2.5 px-3 text-sm text-theme-text focus:outline-none focus:border-nyghto-orange"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-theme-muted mb-1">Project Name (Optional)</label>
                <input 
                  type="text" 
                  value={newTaskProject}
                  onChange={(e) => setNewTaskProject(e.target.value)}
                  placeholder="E.g. Marketing Site"
                  className="w-full bg-theme-bg border border-theme-border rounded-lg py-2.5 px-3 text-sm text-theme-text focus:outline-none focus:border-nyghto-orange"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-theme-muted mb-1">Priority</label>
                <select 
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg py-2.5 px-3 text-sm text-theme-text focus:outline-none focus:border-nyghto-orange"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Due Date</label>
                  <input 
                    type="date" 
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full bg-theme-bg border border-theme-border rounded-lg py-2.5 px-3 text-sm text-theme-text focus:outline-none focus:border-nyghto-orange"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">Assign To</label>
                  <select 
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    className="w-full bg-theme-bg border border-theme-border rounded-lg py-2.5 px-3 text-sm text-theme-text focus:outline-none focus:border-nyghto-orange"
                  >
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-border transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!newTaskTitle.trim()}
                  className="btn-primary px-6 py-2 rounded-lg disabled:opacity-50"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
