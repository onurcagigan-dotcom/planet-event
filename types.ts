
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';

export interface Task {
  id: string;
  category: string;
  title: string;
  status: TaskStatus;
  notes: string;
  deadline: string | null;
  assignee: string | null;
  updatedAt: number;
}

export interface ActivityLog {
  id: string;
  taskId: string;
  taskTitle: string;
  nickname: string;
  action: string;
  timestamp: number;
}

export interface User {
  nickname: string;
  isAdmin: boolean;
}

export interface ProjectData {
  tasks: Task[];
  categories: string[];
  logs: ActivityLog[];
  version: number;
  lastUpdatedBy: string;
  timestamp: number;
}
