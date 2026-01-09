
import React, { useState, useEffect, useCallback } from 'react';
import { User, Task, ActivityLog, TaskStatus } from './types';
import { INITIAL_TASKS, CATEGORIES, STATUS_COLORS } from './constants';
import { TaskCard } from './components/TaskCard';
import { ActivitySidebar } from './components/ActivitySidebar';
import { NicknameModal } from './components/NicknameModal';
import { Header } from './components/Header';
import { DashboardStats } from './components/DashboardStats';
import { TaskListView } from './components/TaskListView';

const STORAGE_KEY_TASKS = 'etkinlik_takip_tasks';
const STORAGE_KEY_LOGS = 'etkinlik_takip_logs';
const STORAGE_KEY_USER = 'etkinlik_takip_user';

type ViewMode = 'board' | 'list';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Load initial data
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUser) {
      setUser({ nickname: savedUser });
    }

    const savedTasks = localStorage.getItem(STORAGE_KEY_TASKS);
    const savedLogs = localStorage.getItem(STORAGE_KEY_LOGS);

    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    } else {
      setTasks(INITIAL_TASKS);
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(INITIAL_TASKS));
    }

    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    }

    setIsInitializing(false);
  }, []);

  // Sync with other tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_TASKS) setTasks(JSON.parse(e.newValue || '[]'));
      if (e.key === STORAGE_KEY_LOGS) setLogs(JSON.parse(e.newValue || '[]'));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(newTasks));
  };

  const addLog = (taskId: string, title: string, action: string) => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId,
      taskTitle: title,
      nickname: user?.nickname || 'Anonymous',
      action,
      timestamp: Date.now()
    };
    const updatedLogs = [newLog, ...logs].slice(0, 50); // Keep last 50 logs
    setLogs(updatedLogs);
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    let actionMsg = "updated";
    if (updates.status && updates.status !== task.status) actionMsg = `changed status to "${updates.status}"`;
    if (updates.notes !== undefined && updates.notes !== task.notes) actionMsg = "updated notes";
    if (updates.deadline && updates.deadline !== task.deadline) actionMsg = `set deadline to "${updates.deadline}"`;

    const newTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now(), assignee: user?.nickname || t.assignee } : t);
    saveTasks(newTasks);
    addLog(id, task.title, actionMsg);
  };

  const addTask = (category: string) => {
    const title = prompt("Enter task title:");
    if (!title) return;

    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      category,
      title,
      status: 'Pending',
      notes: '',
      deadline: null,
      assignee: user?.nickname || null,
      updatedAt: Date.now()
    };

    const newTasks = [...tasks, newTask];
    saveTasks(newTasks);
    addLog(newTask.id, newTask.title, "added a new task");
  };

  const handleLogin = (nickname: string) => {
    setUser({ nickname });
    localStorage.setItem(STORAGE_KEY_USER, nickname);
  };

  if (isInitializing) return null;

  if (!user) {
    return <NicknameModal onJoin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <Header user={user} onLogout={() => { setUser(null); localStorage.removeItem(STORAGE_KEY_USER); }} />
      
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        <div className="flex-grow space-y-6 overflow-hidden">
          <DashboardStats tasks={tasks} />
          
          <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex gap-1">
              <button 
                onClick={() => setViewMode('board')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${viewMode === 'board' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                Board View
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                Full List View
              </button>
            </div>
          </div>

          {viewMode === 'board' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {CATEGORIES.map(category => (
                <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[500px]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      {category}
                    </h3>
                    <button 
                      onClick={() => addTask(category)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-indigo-600 transition-colors"
                      title="Add Task"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>

                  <div className="flex-grow overflow-y-auto custom-scrollbar space-y-4 pr-1">
                    {tasks.filter(t => t.category === category).length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-sm">No tasks here.</div>
                    ) : (
                      tasks.filter(t => t.category === category).map(task => (
                        <TaskCard 
                          key={task.id} 
                          task={task} 
                          onUpdate={(updates) => updateTask(task.id, updates)} 
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TaskListView tasks={tasks} onUpdate={updateTask} />
          )}
        </div>

        <aside className="lg:w-80 shrink-0">
          <ActivitySidebar logs={logs} />
        </aside>
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-slate-400 text-[10px] uppercase tracking-widest font-semibold">
        PLANET &copy; 2026 - Opening Event Track
      </footer>
    </div>
  );
}
