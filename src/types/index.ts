export interface User {
  id: string;
  name: string;
  role: string;
  initial: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  project: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'To Do' | 'In Progress' | 'Review' | 'Completed';
  progress?: number;
  startDate?: string;
  dueDate: string;
  comments: number;
  attachments: number;
  assigneeId: string;
  createdAt: number;
}

export interface CalendarLog {
  id: string;
  date: number; // Day of the month (1-31)
  month: number; 
  year: number;
  text: string;
  color: string;
  createdBy: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  category: string;
  status: 'Planning' | 'In Progress' | 'On Hold' | 'Completed';
  progress: number;
  startDate?: string;
  dueDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  team: string[];
  budget?: number;
  advance?: number;
  receivedAmount?: number;
  links?: { title: string; url: string }[];
  createdAt: number;
  createdBy: string;
}

export interface Report {
  id: string;
  employeeId: string;
  employeeEmail?: string;
  employeeName: string;
  employeeAvatar: string;
  role: string;
  title?: string;
  description?: string;
  date: string;
  status: 'Pending' | 'Submitted';
  hours: number;
  durationDays?: number;
  tasksDone: number;
  createdAt: number;
}

export interface Activity {
  id: string;
  text: string;
  type: 'project' | 'task' | 'report' | 'client' | 'general' | 'points';
  iconColor: string;
  createdAt: number;
}

export interface PointRecord {
  id: string;
  memberId: string;
  memberEmail: string;
  memberName: string;
  points: number;
  reason: string;
  category?: 'Task Completion' | 'Performance Bonus' | 'Overtime' | 'Special Achievement' | 'Disciplinary' | 'Other';
  date: string; // YYYY-MM-DD
  awardedBy: string;
  createdAt: any;
}

export interface Withdrawal {
  id: string;
  amount: number;
  reason: string;
  category?: string;
  date: string; // YYYY-MM-DD
  withdrawnBy: string;
  withdrawnByEmail?: string;
  createdAt: any;
}

export interface Schedule {
  id: string;
  title: string;
  type: 'meeting' | 'update' | 'report' | 'deadline' | 'other';
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  description?: string;
  attendees?: string[]; // user emails or names
  meetLink?: string;
  mode?: 'online' | 'offline';
  onlinePlatform?: 'google_meet' | 'whatsapp' | 'zoom' | 'teams' | 'other';
  offlineVenue?: 'office' | 'other';
  offlineLocationName?: string; // e.g. 'Park', 'School', 'Coffee Shop'
  offlineLocationLink?: string; // e.g. Google Maps link
  status: 'scheduled' | 'completed' | 'cancelled';
  attendedBy?: string[]; // user emails who marked attended
  attendedUsers?: { email: string; name: string; attendedAt: any }[];
  closedBy?: string;
  closedAt?: any;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  createdBy: string;
  createdByEmail: string;
  createdAt: any;
}
