import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, MoreVertical, Clock, CheckCircle2, AlertCircle, PlayCircle, PauseCircle, X, LayoutGrid, List, Link, ExternalLink, Lock, Trash2, IndianRupee, Calendar, Wallet, CreditCard, ChevronDown, ArrowDownRight, History, Landmark } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { hasAdminAccess, isSuperAdmin } from '../utils/permissions';
import type { Project, Withdrawal } from '../types';

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

const formatDueDate = (dateStr?: string) => {
  if (!dateStr || dateStr === 'Today') return 'Today';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch (e) {}
  return dateStr;
};

const getLocalDateStr = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function Projects() {
  const { userData, user } = useAuth();
  const isMainAdmin = isSuperAdmin(user?.email);
  const { teamMembers } = useTeam();
  const [filter, setFilter] = useState('All');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  
  // Current logged in team member
  const currentMember = teamMembers.find(
    m => m.email?.toLowerCase().trim() === user?.email?.toLowerCase().trim()
  );
  const currentMemberName = currentMember?.name;

  // Strict Project Permission: Only assigned team members and Super Admin can edit or drag
  const canManageProject = (project: Project) => {
    if (!user) return false;
    if (isMainAdmin) return true; // Super Admin (team.nyghto@gmail.com) can manage all projects
    const isInTeam = project.team?.some(t => {
      const cleanT = t.toLowerCase().trim();
      if (currentMemberName && cleanT === currentMemberName.toLowerCase().trim()) return true;
      if (currentMember?.id && cleanT === currentMember.id.toLowerCase().trim()) return true;
      if (user?.email && cleanT === user.email.toLowerCase().trim()) return true;
      return false;
    });
    if (isInTeam) return true;
    if (project.createdBy && (
      project.createdBy.toLowerCase().trim() === (userData?.name || '').toLowerCase().trim() ||
      project.createdBy.toLowerCase().trim() === (currentMemberName || '').toLowerCase().trim()
    )) return true;
    return false;
  };
  
  // Drag and drop state
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const COLUMNS = ['Planning', 'In Progress', 'On Hold', 'Completed'];
  
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPriority, setEditPriority] = useState<Project['priority']>('Medium');
  const [editProgress, setEditProgress] = useState(0);
  const [editStatus, setEditStatus] = useState<Project['status']>('Planning');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editBudget, setEditBudget] = useState<number | ''>('');
  const [editAdvance, setEditAdvance] = useState<number | ''>('');
  const [editReceivedAmount, setEditReceivedAmount] = useState<number | ''>('');
  const [editSelectedTeam, setEditSelectedTeam] = useState<string[]>([]);
  const [editLinks, setEditLinks] = useState<{title: string, url: string}[]>([]);
  const [editLinkTitle, setEditLinkTitle] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');
  
  // Form state
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'Planning' | 'In Progress' | 'On Hold' | 'Completed'>('Planning');
  const [startDate, setStartDate] = useState(getLocalDateStr());
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [budget, setBudget] = useState<number | ''>('');
  const [advance, setAdvance] = useState<number | ''>('');
  const [receivedAmount, setReceivedAmount] = useState<number | ''>('');
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [links, setLinks] = useState<{title: string, url: string}[]>([]);

  // Financial Stats Filters (Default to 'This Month')
  const [financeTimeFilter, setFinanceTimeFilter] = useState<'This Month' | 'Last 30 Days' | 'Last 90 Days' | 'This Year' | 'All Time' | 'Custom'>('This Month');
  const [financeStartDate, setFinanceStartDate] = useState('');
  const [financeEndDate, setFinanceEndDate] = useState('');

  // Withdrawals State & Modals
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isWithdrawHistoryOpen, setIsWithdrawHistoryOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number | ''>('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawCategory, setWithdrawCategory] = useState('Office & Operational');
  const [withdrawDate, setWithdrawDate] = useState(getLocalDateStr());
  const [withdrawError, setWithdrawError] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [showAllFinanceCards, setShowAllFinanceCards] = useState(false);

  // Financial Filter Function for Projects
  const isProjectInFinanceRange = (proj: Project) => {
    if (financeTimeFilter === 'All Time') return true;

    let d: Date | null = null;
    if (proj.createdAt) {
      if (typeof proj.createdAt === 'number') d = new Date(proj.createdAt);
      else if ((proj.createdAt as any).seconds) d = new Date((proj.createdAt as any).seconds * 1000);
      else if ((proj.createdAt as any).toDate) d = (proj.createdAt as any).toDate();
      else d = new Date(proj.createdAt);
    } else if (proj.dueDate && proj.dueDate !== 'Today') {
      d = new Date(proj.dueDate);
    }

    if (!d || isNaN(d.getTime())) return true; // Include if date undetermined

    const now = new Date();

    if (financeTimeFilter === 'This Month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (financeTimeFilter === 'Last 30 Days') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return d >= past30 && d <= now;
    }
    if (financeTimeFilter === 'Last 90 Days') {
      const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return d >= past90 && d <= now;
    }
    if (financeTimeFilter === 'This Year') {
      return d.getFullYear() === now.getFullYear();
    }
    if (financeTimeFilter === 'Custom') {
      if (!financeStartDate && !financeEndDate) return true;
      const start = financeStartDate ? new Date(financeStartDate) : new Date(0);
      const end = financeEndDate ? new Date(financeEndDate + 'T23:59:59') : new Date(8640000000000000);
      return d >= start && d <= end;
    }
    return true;
  };

  // Filter Function for Withdrawals
  const isWithdrawalInRange = (w: Withdrawal) => {
    if (financeTimeFilter === 'All Time') return true;
    let d: Date | null = null;
    if (w.date) {
      d = new Date(w.date);
    } else if (w.createdAt) {
      if (typeof w.createdAt === 'number') d = new Date(w.createdAt);
      else if ((w.createdAt as any).seconds) d = new Date((w.createdAt as any).seconds * 1000);
      else if ((w.createdAt as any).toDate) d = (w.createdAt as any).toDate();
      else d = new Date(w.createdAt);
    }
    if (!d || isNaN(d.getTime())) return true;

    const now = new Date();
    if (financeTimeFilter === 'This Month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (financeTimeFilter === 'Last 30 Days') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return d >= past30 && d <= now;
    }
    if (financeTimeFilter === 'Last 90 Days') {
      const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return d >= past90 && d <= now;
    }
    if (financeTimeFilter === 'This Year') {
      return d.getFullYear() === now.getFullYear();
    }
    if (financeTimeFilter === 'Custom') {
      if (!financeStartDate && !financeEndDate) return true;
      const start = financeStartDate ? new Date(financeStartDate) : new Date(0);
      const end = financeEndDate ? new Date(financeEndDate + 'T23:59:59') : new Date(8640000000000000);
      return d >= start && d <= end;
    }
    return true;
  };

  // Helper to get total received for a project (receivedAmount if set, otherwise advance)
  const getProjectGotMoney = (p: Project) => {
    if (p.receivedAmount !== undefined && p.receivedAmount !== null && p.receivedAmount !== '') {
      return Number(p.receivedAmount) || 0;
    }
    return Number(p.advance) || 0;
  };

  // Filtered Financial Totals
  const financeProjects = projects.filter(isProjectInFinanceRange);
  const financeWithdrawals = withdrawals.filter(isWithdrawalInRange);

  const totalMoney = financeProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
  const totalAdvance = financeProjects.reduce((sum, p) => sum + (Number(p.advance) || 0), 0);
  const totalGotMoney = financeProjects.reduce((sum, p) => sum + getProjectGotMoney(p), 0);
  const totalWithdrawn = financeWithdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
  const totalPending = Math.max(0, totalMoney - totalGotMoney);

  // All-time Totals
  const lifetimeTotalMoney = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
  const lifetimeAdvance = projects.reduce((sum, p) => sum + (Number(p.advance) || 0), 0);
  const lifetimeGotMoney = projects.reduce((sum, p) => sum + getProjectGotMoney(p), 0);
  const lifetimeWithdrawn = withdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
  const lifetimePending = Math.max(0, lifetimeTotalMoney - lifetimeGotMoney);

  // Nyghto Account Balance: Total Got Money minus Total Withdrawn Money
  const currentPeriodBalance = totalGotMoney - totalWithdrawn;
  const lifetimeAccountBalance = lifetimeGotMoney - lifetimeWithdrawn;

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
    });

    const qWithdraw = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));
    const unsubWithdraw = onSnapshot(qWithdraw, (snapshot) => {
      const withData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Withdrawal[];
      setWithdrawals(withData);
    });

    return () => {
      unsubscribe();
      unsubWithdraw();
    };
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
        startDate: startDate || getLocalDateStr(),
        dueDate,
        priority,
        budget: Number(budget) || 0,
        advance: Number(advance) || 0,
        receivedAmount: receivedAmount !== '' ? Number(receivedAmount) : (Number(advance) || 0),
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
      setStartDate(getLocalDateStr());
      setDueDate('');
      setPriority('Medium');
      setBudget('');
      setAdvance('');
      setReceivedAmount('');
      setSelectedTeam([]);
      setLinks([]);
      setLinkTitle('');
      setLinkUrl('');
    } catch (error) {
      console.error("Error adding project:", error);
    }
  };

  // Admin Delete Confirmation with Password Modal State
  const [deletingProject, setDeletingProject] = useState<{ id: string; name: string } | null>(null);
  const [deleteProjPassInput, setDeleteProjPassInput] = useState('');
  const [deleteProjPassError, setDeleteProjPassError] = useState('');
  const [isDeletingProjLoading, setIsDeletingProjLoading] = useState(false);

  const promptDeleteProject = (proj: { id: string; name: string }) => {
    setDeletingProject(proj);
    setDeleteProjPassInput('');
    setDeleteProjPassError('');
    setActiveDropdown(null);
  };

  const confirmDeleteProjectWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingProject || !user?.email) return;

    setDeleteProjPassError('');
    setIsDeletingProjLoading(true);

    const emailClean = user.email.toLowerCase().trim();
    const enteredPass = deleteProjPassInput.trim();

    // Default password fallbacks
    const defaultPasswords: Record<string, string> = {
      'amaldas.co@gmail.com': 'amal123',
      'salurinshan9539@gmail.com': 'rinshan123',
      'shahalmuhammed404@gmail.com': 'shahal123',
      'team.nyghto@gmail.com': '1111'
    };

    try {
      let expectedPass = '9999';

      // Check admin_config deletePin
      const adminDoc = await getDoc(doc(db, 'settings', 'admin_config'));
      if (adminDoc.exists() && adminDoc.data().deletePin) {
        expectedPass = adminDoc.data().deletePin.toString().trim();
      }

      if (enteredPass !== expectedPass) {
        setDeleteProjPassError('Incorrect Delete Password! Project was not deleted.');
        setIsDeletingProjLoading(false);
        return;
      }

      // Password verified! Delete project
      await deleteDoc(doc(db, 'projects', deletingProject.id));
      await addDoc(collection(db, 'activities'), {
        text: `${userData?.name || 'Admin'} deleted project '${deletingProject.name}'`,
        type: 'project',
        iconColor: 'text-red-500',
        createdAt: serverTimestamp()
      });

      setDeletingProject(null);
      setDeleteProjPassInput('');
    } catch (error: any) {
      console.error("Error deleting project:", error);
      setDeleteProjPassError(error.message || 'Failed to delete project');
    } finally {
      setIsDeletingProjLoading(false);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    try {
      const updateData: any = {
        progress: editProgress,
        status: editStatus,
        dueDate: editDueDate
      };
      if (editStartDate) {
        updateData.startDate = editStartDate;
      }

      if (isMainAdmin) {
        if (editName.trim()) updateData.name = editName.trim();
        if (editClient.trim()) updateData.client = editClient.trim();
        if (editCategory.trim()) updateData.category = editCategory.trim();
        updateData.priority = editPriority;
        updateData.budget = editBudget === '' ? 0 : Number(editBudget);
        updateData.advance = editAdvance === '' ? 0 : Number(editAdvance);
        updateData.receivedAmount = editReceivedAmount === '' ? (Number(editAdvance) || 0) : Number(editReceivedAmount);
        updateData.team = editSelectedTeam;
        updateData.links = editLinks;
      }

      await updateDoc(doc(db, 'projects', editingProject.id), updateData);
      
      await addDoc(collection(db, 'activities'), {
        text: `${userData?.name || 'User'} updated project '${editName.trim() || editingProject.name}'`,
        type: 'project',
        iconColor: 'text-blue-500',
        createdAt: serverTimestamp()
      });

      setEditingProject(null);
    } catch (error) {
      console.error("Error updating project:", error);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      setWithdrawError('Please enter a valid amount greater than 0.');
      return;
    }
    if (!withdrawReason.trim()) {
      setWithdrawError('Please provide a reason for the withdrawal.');
      return;
    }

    setWithdrawError('');
    setIsSubmittingWithdraw(true);

    try {
      const amt = Number(withdrawAmount);
      const withDoc = {
        amount: amt,
        reason: withdrawReason.trim(),
        category: withdrawCategory,
        date: withdrawDate || getLocalDateStr(),
        withdrawnBy: userData?.name || user?.email || 'Admin',
        withdrawnByEmail: user?.email || '',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'withdrawals'), withDoc);

      await addDoc(collection(db, 'activities'), {
        text: `${userData?.name || 'Admin'} withdrew $${amt.toLocaleString()} (${withdrawReason.trim()})`,
        type: 'general',
        iconColor: 'text-rose-500',
        createdAt: serverTimestamp()
      });

      // Reset form
      setWithdrawAmount('');
      setWithdrawReason('');
      setWithdrawCategory('Office & Operational');
      setIsWithdrawModalOpen(false);
    } catch (err: any) {
      console.error('Error recording withdrawal:', err);
      setWithdrawError(err.message || 'Failed to submit withdrawal');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const handleDeleteWithdrawal = async (withdrawId: string, amount: number, reason: string) => {
    if (!window.confirm(`Are you sure you want to delete this withdrawal record of $${amount.toLocaleString()} for "${reason}"?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'withdrawals', withdrawId));
      await addDoc(collection(db, 'activities'), {
        text: `${userData?.name || 'Admin'} deleted withdrawal record: $${amount.toLocaleString()} (${reason})`,
        type: 'general',
        iconColor: 'text-amber-500',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error deleting withdrawal:', err);
      alert('Failed to delete withdrawal record.');
    }
  };

  const renderProjectCard = (project: Project) => {
    const isPermitted = canManageProject(project);
    return (
    <div 
      key={project.id} 
      className={`glass-card p-6 flex flex-col transition-all group ${
        isPermitted 
          ? 'hover-scale hover:border-white/20 cursor-grab active:cursor-grabbing' 
          : 'cursor-default border-white/5 opacity-90'
      }`}
      draggable={viewMode === 'kanban' && isPermitted}
      onDragStart={(e) => handleDragStart(e, project.id)}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${getStatusColor(project.status)}`}>
          {getStatusIcon(project.status)}
          {project.status}
        </div>
        {isPermitted && (
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
                    setEditName(project.name || '');
                    setEditClient(project.client || '');
                    setEditCategory(project.category || '');
                    setEditPriority(project.priority || 'Medium');
                    setEditProgress(project.progress || 0);
                    setEditStatus(project.status || 'Planning');
                    setEditStartDate(project.startDate || (project.createdAt ? getLocalDateStr(new Date((project.createdAt as any).seconds ? (project.createdAt as any).seconds * 1000 : project.createdAt)) : getLocalDateStr()));
                    setEditDueDate(project.dueDate || '');
                    setEditBudget(project.budget !== undefined ? project.budget : '');
                    setEditAdvance(project.advance !== undefined ? project.advance : '');
                    setEditReceivedAmount(project.receivedAmount !== undefined ? project.receivedAmount : (project.advance !== undefined ? project.advance : ''));
                    setEditSelectedTeam(project.team || []);
                    setEditLinks(project.links || []);
                    setEditLinkTitle('');
                    setEditLinkUrl('');
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors flex items-center justify-between"
                >
                  <span>{isMainAdmin ? 'Edit Project' : 'Update Progress'}</span>
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
                {isMainAdmin && (
                  <button
                    type="button"
                    onClick={() => promptDeleteProject({ id: project.id, name: project.name })}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-white/5 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Project</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      <h3 className="text-xl font-bold mb-1 hover:text-nyghto-orange transition-colors cursor-pointer">
        {project.name}
      </h3>
      <div className="text-sm text-gray-400 mb-6 space-y-1.5">
        <p>{project.category} • Client: {project.client}</p>
        {(project.budget !== undefined && project.budget > 0) && (() => {
          const got = getProjectGotMoney(project);
          const due = Math.max(0, project.budget - got);
          return (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs pt-1">
              <span className="text-nyghto-orange/90 font-medium">
                Budget: <span className="text-white font-bold">₹{project.budget.toLocaleString('en-IN')}</span>
              </span>
              {(project.advance !== undefined && project.advance > 0) && (
                <span className="text-blue-400 font-medium bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                  Adv: <span className="text-white font-bold">₹{project.advance.toLocaleString('en-IN')}</span>
                </span>
              )}
              {got > 0 && (
                <span className="text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                  Total Got: <span className="text-white font-bold">₹{got.toLocaleString('en-IN')}</span>
                </span>
              )}
              {due > 0 && (
                <span className="text-amber-400 text-[11px] font-medium">
                  Pending: <b className="text-amber-300">₹{due.toLocaleString('en-IN')}</b>
                </span>
              )}
            </div>
          );
        })()}
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
            className={`flex flex-wrap gap-2 relative ${isMainAdmin ? 'cursor-pointer group/team' : 'cursor-default'}`}
            onClick={(e) => {
              if (!isMainAdmin) return;
              e.stopPropagation();
              setActiveDropdown(`team-${project.id}`);
            }}
            title={isMainAdmin ? "Click to manage team" : "Assigned team members"}
          >
            {(project.team || []).map((member, i) => {
              const memberData = teamMembers.find(m => m.name === member);
              if (!memberData) return null;
              return (
                <div 
                  key={i} 
                  className={`flex items-center gap-1.5 pr-2.5 rounded-full border border-white/10 bg-white/5 transition-colors z-0 ${isMainAdmin ? 'group-hover/team:border-nyghto-orange/50' : ''}`}
                >
                  {memberData.avatarImage ? (
                    <img 
                      src={memberData.avatarImage} 
                      alt={memberData.name} 
                      className="w-6 h-6 rounded-full object-cover shadow-sm"
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

            {isMainAdmin && activeDropdown === `team-${project.id}` && (
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
          <div className="flex items-center gap-4 text-right">
            <div className="text-left">
              <div className="text-[10px] text-gray-500 mb-0.5 uppercase tracking-wider">Started</div>
              <div className="text-xs font-medium text-gray-300">
                {formatDueDate(project.startDate || (project.createdAt ? getLocalDateStr(new Date((project.createdAt as any).seconds ? (project.createdAt as any).seconds * 1000 : project.createdAt)) : undefined))}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-0.5 uppercase tracking-wider">Due Date</div>
              <div className={`text-xs font-medium ${getPriorityColor(project.priority)}`}>
                {formatDueDate(project.dueDate)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  };

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !canManageProject(project)) {
      e.preventDefault();
      return;
    }
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
    if (!draggedProjectId || !user) return;

    const project = projects.find(p => p.id === draggedProjectId);
    if (!project || !canManageProject(project)) {
      setDraggedProjectId(null);
      return;
    }

    if (project.status !== column) {
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

      {/* Financial Overview Cards & Filter (Total Money, Got Advance, Pending Money, Nyghto Balance, Withdrawals) */}
      <div className="glass-card p-5 border border-white/10 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-nyghto-orange/20 border border-nyghto-orange/30 flex items-center justify-center text-nyghto-orange">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>Nyghto Financial & Account Overview</span>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-nyghto-orange/20 text-nyghto-orange border border-nyghto-orange/30">
                  {financeTimeFilter}
                </span>
              </h3>
              <p className="text-xs text-gray-400">Total revenue, client advance, account balance & admin withdrawals.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Action Buttons for Admins: Withdraw Funds and Withdrawal History */}
            {hasAdminAccess(user?.email) && (
              <div className="flex items-center gap-2 mr-2">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white transition-all shadow-md shadow-rose-500/20 flex items-center gap-1.5"
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Withdraw Money</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsWithdrawHistoryOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5 text-nyghto-orange" />
                  <span>History ({withdrawals.length})</span>
                </button>
              </div>
            )}

            {/* Show All / Show Less Toggle Button */}
            <button
              type="button"
              onClick={() => setShowAllFinanceCards(!showAllFinanceCards)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-nyghto-orange hover:text-white border border-nyghto-orange/30 transition-all flex items-center gap-1.5"
            >
              <span>{showAllFinanceCards ? 'Show Less' : 'Show All'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAllFinanceCards ? 'rotate-180' : ''}`} />
            </button>

            {/* Filter Bar */}
            {(['This Month', 'Last 30 Days', 'Last 90 Days', 'This Year', 'All Time', 'Custom'] as const).map((tFilter) => (
              <button
                key={tFilter}
                type="button"
                onClick={() => setFinanceTimeFilter(tFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  financeTimeFilter === tFilter
                    ? 'bg-nyghto-orange text-white shadow-md shadow-nyghto-orange/20'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                {tFilter === 'This Month' ? '📅 This Month (Default)' : tFilter}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {financeTimeFilter === 'Custom' && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Calendar className="w-3.5 h-3.5 text-nyghto-orange" />
              <span className="font-medium">From:</span>
              <input
                type="date"
                value={financeStartDate}
                onChange={(e) => setFinanceStartDate(e.target.value)}
                className="bg-nyghto-dark border border-white/10 rounded-lg py-1 px-2 text-xs text-white focus:outline-none focus:border-nyghto-orange"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Calendar className="w-3.5 h-3.5 text-nyghto-orange" />
              <span className="font-medium">To:</span>
              <input
                type="date"
                value={financeEndDate}
                onChange={(e) => setFinanceEndDate(e.target.value)}
                className="bg-nyghto-dark border border-white/10 rounded-lg py-1 px-2 text-xs text-white focus:outline-none focus:border-nyghto-orange"
              />
            </div>
            {(financeStartDate || financeEndDate) && (
              <button
                type="button"
                onClick={() => { setFinanceStartDate(''); setFinanceEndDate(''); }}
                className="text-[11px] text-gray-400 hover:text-white underline ml-auto"
              >
                Reset Dates
              </button>
            )}
          </div>
        )}

        {/* Primary 3 Cards: Nyghto AC Balance, Total Revenue, Pending Money */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* 1. Nyghto AC Balance (Available Funds) */}
          <div className="bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-5 transition-all group shadow-[0_0_25px_rgba(16,185,129,0.1)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between text-emerald-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Nyghto AC Balance</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-2xl lg:text-3xl font-black ${currentPeriodBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{currentPeriodBalance.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-emerald-400/80 mt-2 flex justify-between items-center pt-2 border-t border-emerald-500/20">
              <span>Available Cash</span>
              <span className="text-gray-400 font-medium">Life: ₹{lifetimeAccountBalance.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* 2. Total Revenue */}
          <div className="bg-white/5 hover:bg-white/10 border border-blue-500/20 rounded-xl p-5 transition-all group bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="flex items-center justify-between text-blue-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Revenue</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl lg:text-3xl font-black text-white group-hover:text-blue-400 transition-colors">
              ₹{totalMoney.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-gray-400 mt-2 flex justify-between items-center pt-2 border-t border-white/5">
              <span>{financeProjects.length} projects in range</span>
              <span className="text-gray-400 font-medium">Life: ₹{lifetimeTotalMoney.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* 3. Pending Money */}
          <div className="bg-white/5 hover:bg-white/10 border border-amber-500/20 rounded-xl p-5 transition-all group bg-gradient-to-br from-amber-500/5 to-transparent">
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Pending Money</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl lg:text-3xl font-black text-amber-400">
              ₹{totalPending.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-amber-400/80 mt-2 flex justify-between items-center pt-2 border-t border-white/5">
              <span>
                {totalMoney > 0 ? `${Math.round((totalPending / totalMoney) * 100)}% pending` : '0% pending'}
              </span>
              <span className="text-gray-400 font-medium">Life: ₹{lifetimePending.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Secondary Expanded Cards (Shown only when Show All is clicked) */}
        {showAllFinanceCards && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Withdrawn Money */}
            <div className="bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/30 rounded-xl p-4 transition-all group bg-gradient-to-br from-rose-500/10 to-transparent">
              <div className="flex items-center justify-between text-rose-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Withdrawn Money</span>
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-rose-400">
                ₹{totalWithdrawn.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-rose-400/80 mt-1 flex justify-between items-center">
                <span>{financeWithdrawals.length} withdrawals</span>
                <span className="text-gray-400">Life: ₹{lifetimeWithdrawn.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Total Got Money */}
            <div className="bg-white/5 hover:bg-white/10 border border-emerald-500/20 rounded-xl p-4 transition-all group bg-gradient-to-br from-emerald-500/5 to-transparent">
              <div className="flex items-center justify-between text-emerald-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Total Got Money</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-emerald-400">
                ₹{totalGotMoney.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-emerald-400/80 mt-1 flex justify-between items-center">
                <span>
                  {totalMoney > 0 ? `${Math.round((totalGotMoney / totalMoney) * 100)}% received` : '0% received'}
                </span>
                <span className="text-gray-500">Life: ₹{lifetimeGotMoney.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Advance Money */}
            <div className="bg-white/5 hover:bg-white/10 border border-blue-500/20 rounded-xl p-4 transition-all group bg-gradient-to-br from-blue-500/5 to-transparent">
              <div className="flex items-center justify-between text-blue-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Advance Money</span>
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-blue-400">
                ₹{totalAdvance.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-blue-400/80 mt-1 flex justify-between items-center">
                <span>Initial advance</span>
                <span className="text-gray-500">Life: ₹{lifetimeAdvance.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Budget (₹)</label>
                  <input 
                    type="number"
                    min="0"
                    value={budget}
                    onChange={e => setBudget(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Optional"
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Advance (₹)</label>
                  <input 
                    type="number"
                    min="0"
                    value={advance}
                    onChange={e => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      setAdvance(val);
                      // If total got money hasn't been explicitly edited yet, auto-fill it with advance
                      if (receivedAmount === '' || receivedAmount === advance) {
                        setReceivedAmount(val);
                      }
                    }}
                    placeholder="Optional"
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-emerald-400 mb-1">Total Got (₹)</label>
                  <input 
                    type="number"
                    min="0"
                    value={receivedAmount}
                    onChange={e => setReceivedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Auto (Adv)"
                    className="w-full bg-nyghto-dark border border-emerald-500/30 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-emerald-500 text-sm" 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Started Date</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                  />
                </div>
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
              <h2 className="text-xl font-bold">{isMainAdmin ? 'Edit Project' : 'Update Project'}</h2>
              <button 
                onClick={() => setEditingProject(null)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProject} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
              {isMainAdmin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Project Name</label>
                    <input 
                      type="text" 
                      required
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Client</label>
                      <input 
                        type="text" 
                        required
                        value={editClient}
                        onChange={e => setEditClient(e.target.value)}
                        className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
                      <input 
                        type="text" 
                        required
                        value={editCategory}
                        onChange={e => setEditCategory(e.target.value)}
                        className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                      />
                    </div>
                  </div>

                  {/* Budget, Advance, and Total Got Money section */}
                  <div className="grid grid-cols-3 gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                    <div>
                      <label className="block text-xs font-semibold text-nyghto-orange mb-1">Budget (₹)</label>
                      <input 
                        type="number"
                        min="0"
                        value={editBudget}
                        onChange={e => setEditBudget(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Optional"
                        className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-blue-400 mb-1">Advance (₹)</label>
                      <input 
                        type="number"
                        min="0"
                        value={editAdvance}
                        onChange={e => setEditAdvance(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Optional"
                        className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-emerald-400 mb-1">Total Got (₹)</label>
                      <input 
                        type="number"
                        min="0"
                        value={editReceivedAmount}
                        onChange={e => setEditReceivedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Auto (Adv)"
                        className="w-full bg-nyghto-dark border border-emerald-500/30 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-emerald-500 text-sm" 
                      />
                    </div>
                  </div>
                </>
              )}

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

              <div className="grid grid-cols-3 gap-4">
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
                  <label className="block text-sm font-medium text-gray-400 mb-1">Started Date</label>
                  <input 
                    type="date" 
                    value={editStartDate}
                    onChange={e => setEditStartDate(e.target.value)}
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange" 
                  />
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

              {isMainAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Priority</label>
                  <select 
                    value={editPriority}
                    onChange={e => setEditPriority(e.target.value as any)}
                    className="w-full bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-nyghto-orange appearance-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              )}

              {isMainAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Team Members</label>
                  <div className="flex flex-wrap gap-2">
                    {teamMembers.map(member => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          if (editSelectedTeam.includes(member.name)) {
                            setEditSelectedTeam(editSelectedTeam.filter(m => m !== member.name));
                          } else {
                            setEditSelectedTeam([...editSelectedTeam, member.name]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full border flex items-center gap-2 text-sm transition-all ${
                          editSelectedTeam.includes(member.name) 
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
              )}

              {isMainAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Project Links & Resources</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Link Title (e.g. Figma)"
                      value={editLinkTitle}
                      onChange={e => setEditLinkTitle(e.target.value)}
                      className="w-1/3 bg-nyghto-dark border border-white/10 rounded-lg py-1.5 px-3 text-sm text-white focus:outline-none focus:border-nyghto-orange"
                    />
                    <input
                      type="url"
                      placeholder="https://..."
                      value={editLinkUrl}
                      onChange={e => setEditLinkUrl(e.target.value)}
                      className="flex-1 bg-nyghto-dark border border-white/10 rounded-lg py-1.5 px-3 text-sm text-white focus:outline-none focus:border-nyghto-orange"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (editLinkTitle && editLinkUrl) {
                          setEditLinks([...editLinks, { title: editLinkTitle, url: editLinkUrl }]);
                          setEditLinkTitle('');
                          setEditLinkUrl('');
                        }
                      }}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {editLinks.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {editLinks.map((link, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white/5 p-2 rounded-lg text-sm border border-white/5">
                          <div className="flex items-center gap-2">
                            <Link className="w-4 h-4 text-nyghto-orange" />
                            <span className="font-medium text-white">{link.title}</span>
                            <span className="text-gray-500 truncate max-w-[150px]">{link.url}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditLinks(editLinks.filter((_, i) => i !== idx))}
                            className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg text-xs font-medium transition-colors"
                          >
                            <span>Remove</span>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-nyghto-card/90 backdrop-blur py-2">
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

      {/* Delete Project Security Confirmation Modal (Requires Password) */}
      {deletingProject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setDeletingProject(null)}>
          <div className="glass-card w-full max-w-sm p-6 relative border border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.2)] rounded-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setDeletingProject(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center mb-3 shadow-lg">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Delete Project Confirmation</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-[240px]">
                Enter Admin Delete Password to delete <b className="text-white font-medium">"{deletingProject.name}"</b>.
              </p>
            </div>

            {deleteProjPassError && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium leading-relaxed animate-shake">
                {deleteProjPassError}
              </div>
            )}

            <form onSubmit={confirmDeleteProjectWithPassword} className="space-y-4">
              <div>
                <input
                  type="password"
                  autoFocus
                  required
                  value={deleteProjPassInput}
                  onChange={(e) => {
                    setDeleteProjPassInput(e.target.value);
                    setDeleteProjPassError('');
                  }}
                  placeholder="Enter Delete Password (••••)"
                  className="w-full text-center text-base tracking-[0.2em] font-mono py-2.5 bg-nyghto-dark/90 border border-white/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-inner"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingProject(null)}
                  className="w-1/2 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!deleteProjPassInput || isDeletingProjLoading}
                  className="w-1/2 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeletingProjLoading ? 'Deleting...' : 'Delete Project'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Withdraw Money Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setIsWithdrawModalOpen(false)}>
          <div className="glass-card w-full max-w-md p-6 relative border border-rose-500/30 shadow-[0_0_50px_rgba(244,63,94,0.15)] rounded-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsWithdrawModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Withdraw Money</h3>
                <p className="text-xs text-gray-400">Record cash/funds withdrawal from Nyghto account with reason.</p>
              </div>
            </div>

            {/* Current Balance Banner */}
            <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center">
              <div>
                <span className="text-[11px] text-gray-400 uppercase font-bold tracking-wider">Current Account Balance</span>
                <div className="text-lg font-black text-emerald-400">
                  ₹{lifetimeAccountBalance.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-right text-[11px] text-gray-400">
                <div>Total Received: <b className="text-white">₹{lifetimeGotMoney.toLocaleString('en-IN')}</b></div>
                <div>Withdrawn: <b className="text-rose-400">₹{lifetimeWithdrawn.toLocaleString('en-IN')}</b></div>
              </div>
            </div>

            {withdrawError && (
              <div className="mb-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium animate-shake">
                {withdrawError}
              </div>
            )}

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Withdrawal Amount (₹) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    autoFocus
                    value={withdrawAmount}
                    onChange={(e) => {
                      setWithdrawAmount(e.target.value === '' ? '' : Number(e.target.value));
                      setWithdrawError('');
                    }}
                    placeholder="e.g. 5000"
                    className="w-full pl-8 pr-3 py-2.5 bg-nyghto-dark border border-white/15 rounded-xl text-white font-semibold placeholder:text-gray-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Reason / Purpose <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={withdrawReason}
                  onChange={(e) => {
                    setWithdrawReason(e.target.value);
                    setWithdrawError('');
                  }}
                  placeholder="e.g. Server hosting renewal, office supplies, team advance payout..."
                  className="w-full px-3 py-2 bg-nyghto-dark border border-white/15 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Category</label>
                  <select
                    value={withdrawCategory}
                    onChange={(e) => setWithdrawCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-nyghto-dark border border-white/15 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500 cursor-pointer"
                  >
                    <option value="Office & Operational">Office & Operational</option>
                    <option value="Software & Hosting">Software & Hosting</option>
                    <option value="Team / Salary Advance">Team / Salary Advance</option>
                    <option value="Hardware / Equipment">Hardware / Equipment</option>
                    <option value="Marketing & Growth">Marketing & Growth</option>
                    <option value="Personal / Founder Draw">Personal / Founder Draw</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Withdrawal Date</label>
                  <input
                    type="date"
                    required
                    value={withdrawDate}
                    onChange={(e) => setWithdrawDate(e.target.value)}
                    className="w-full px-3 py-2 bg-nyghto-dark border border-white/15 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="w-1/2 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWithdraw}
                  className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/30 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <ArrowDownRight className="w-4 h-4" />
                  <span>{isSubmittingWithdraw ? 'Processing...' : 'Confirm Withdrawal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdrawal History Modal */}
      {isWithdrawHistoryOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setIsWithdrawHistoryOpen(false)}>
          <div className="glass-card w-full max-w-2xl max-h-[85vh] flex flex-col p-6 relative border border-white/15 shadow-2xl rounded-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsWithdrawHistoryOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-nyghto-orange/20 border border-nyghto-orange/30 text-nyghto-orange flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Withdrawal History & Reasons</h3>
                  <p className="text-xs text-gray-400">All recorded withdrawals from Nyghto account.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsWithdrawHistoryOpen(false);
                  setIsWithdrawModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white transition-all shadow-md shadow-rose-500/20 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Withdrawal</span>
              </button>
            </div>

            {/* Summary strip inside history */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-white/5 rounded-xl border border-white/10 mb-4">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold">Lifetime Got</span>
                <div className="text-base font-extrabold text-emerald-400">₹{lifetimeGotMoney.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold">Lifetime Withdrawn</span>
                <div className="text-base font-extrabold text-rose-400">₹{lifetimeWithdrawn.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold">Current Balance</span>
                <div className={`text-base font-extrabold ${lifetimeAccountBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ₹{lifetimeAccountBalance.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Withdrawals List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {withdrawals.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">
                  <ArrowDownRight className="w-8 h-8 mx-auto mb-2 opacity-30 text-rose-400" />
                  No withdrawals recorded yet.
                </div>
              ) : (
                withdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-rose-400">₹{Number(w.amount || 0).toLocaleString('en-IN')}</span>
                        {w.category && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/10">
                            {w.category}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-500">
                          {w.date ? formatDueDate(w.date) : 'Recent'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-200 font-medium leading-relaxed">
                        Reason: <span className="text-white font-semibold">"{w.reason}"</span>
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Withdrawn by: <span className="text-gray-400 font-medium">{w.withdrawnBy || 'Admin'}</span>
                      </div>
                    </div>

                    {isMainAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteWithdrawal(w.id, w.amount, w.reason)}
                        title="Delete withdrawal record"
                        className="self-end sm:self-center p-2 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-80 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
