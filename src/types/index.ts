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
  dueDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  team: string[];
  budget?: number;
  links?: { title: string; url: string }[];
  createdAt: number;
  createdBy: string;
}

export interface Report {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeAvatar: string;
  role: string;
  date: string;
  status: 'Pending' | 'Submitted';
  hours: number;
  tasksDone: number;
  createdAt: number;
}

export interface Activity {
  id: string;
  text: string;
  type: 'project' | 'task' | 'report' | 'client' | 'general';
  iconColor: string;
  createdAt: number;
}
