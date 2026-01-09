
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
}

export interface AppState {
  tasks: Task[];
  logs: ActivityLog[];
}
