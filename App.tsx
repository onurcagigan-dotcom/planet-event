
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Task, ActivityLog } from './types';
import { INITIAL_TASKS, DEFAULT_CATEGORIES } from './constants';
import { TaskCard } from './components/TaskCard';
import { ActivitySidebar } from './components/ActivitySidebar';
import { NicknameModal } from './components/NicknameModal';
import { Header } from './components/Header';
import { DashboardStats } from './components/DashboardStats';
import { TaskListView } from './components/TaskListView';
import { TaskFormModal } from './components/TaskFormModal';

// V11: Fresh shared bucket for the project
const SYNC_URL = 'https://kvdb.io/A9S9h7nL3u3Jt9v6m8K1Z2/planet_master_v11';
const STORAGE_KEY_USER = 'planet_user_v11';

type ViewMode = 'board' | 'list';
type SyncStatus = 'synced' | 'syncing' | 'error' | 'checking';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [isInitializing, setIsInitializing] = useState(true);

  // Use refs to prevent stale closure issues and manage sync locks
  const lastUpdateRef = useRef<number>(0);
  const syncBusy = useRef<boolean>(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);

  /**
   * PUSH: Sync local state to cloud
   */
  const broadcast = async (t: Task[], c: string[], l: ActivityLog[]) => {
    if (syncBusy.current) return;
    syncBusy.current = true;
    setSyncStatus('syncing');

    const timestamp = Date.now();
    const payload = { tasks: t, categories: c, logs: l, lastUpdate: timestamp };

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(SYNC_URL, {
        method: 'PUT',
        mode: 'cors',
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(id);

      if (!response.ok) throw new Error(`Status: ${response.status}`);

      lastUpdateRef.current = timestamp;
      setLastSyncTime(Date.now());
      setSyncStatus('synced');
    } catch (err) {
      console.error('Broadcast error:', err);
      setSyncStatus('error');
    } finally {
      syncBusy.current = false;
    }
  };

  /**
   * PULL: Get state from cloud
   */
  const pull = useCallback(async (isManual = false) => {
    if (syncBusy.current && !isManual) return;
    
    setSyncStatus(isManual ? 'syncing' : 'checking');
    try {
      const response = await fetch(`${SYNC_URL}?cache_bust=${Date.now()}`, { 
        cache: 'no-store' 
      });
      
      if (response.ok) {
        const text = await response.text();
        if (!text || text.trim() === "") {
          if (isManual) await broadcast(tasks, categories, logs);
          setSyncStatus('synced');
          return;
        }

        const data = JSON.parse(text);
        // Only override if cloud is strictly newer
        if (data.lastUpdate > lastUpdateRef.current) {
          setTasks(data.tasks || []);
          setCategories(data.categories || DEFAULT_CATEGORIES);
          setLogs(data.logs || []);
          lastUpdateRef.current = data.lastUpdate;
          setLastSyncTime(Date.now());
        }
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Pull error:', err);
      setSyncStatus('error');
    } finally {
      if (!isManual) {
        setTimeout(() => setSyncStatus(prev => (prev === 'checking') ? 'synced' : prev), 1000);
      }
    }
  }, [tasks, categories, logs]);

  // App initialization
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUser) setUser({ nickname: savedUser });

    setTasks(INITIAL_TASKS);
    setCategories(DEFAULT_CATEGORIES);
    setIsInitializing(false);
    
    // Initial fetch
    const timer = setTimeout(() => pull(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Sync heartbeat every 5 seconds
  useEffect(() => {
    if (isInitializing || !user) return;
    const interval = setInterval(() => {
      if (syncStatus === 'synced') pull(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [isInitializing, user, pull, syncStatus]);

  /**
   * Unified updater
   */
  const handleDataUpdate = (t: Task[], c: string[], l: ActivityLog[]) => {
    setTasks(t);
    setCategories(c);
    setLogs(l);
    broadcast(t, c, l);
  };

  const createLog = (taskId: string, title: string, action: string, t: Task[], c: string[], l: ActivityLog[]) => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId,
      taskTitle: title,
      nickname: user?.nickname || 'Team Member',
      action,
      timestamp: Date.now()
    };
    const updatedLogs = [newLog, ...l].slice(0, 50);
    handleDataUpdate(t, c, updatedLogs);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    let label = "updated the task details";
    if (updates.status && updates.status !== task.status) label = `changed status to ${updates.status}`;
    else if (updates.assignee !== undefined) label = `assigned task to ${updates.assignee || 'Unassigned'}`;
    
    const newTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    createLog(id, task.title, label, newTasks, categories, logs);
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !confirm(`Permanently delete "${task.title}"?`)) return;
    const newTasks = tasks.filter(t => t.id !== id);
    createLog(id, task.title, "removed the task", newTasks, categories, logs);
  };

  const onFormSubmit = (data: { title: string, category: string, deadline: string | null, notes: string, assignee: string | null }) => {
    let freshCats = [...categories];
    if (!freshCats.includes(data.category)) {
      freshCats = [...freshCats, data.category];
    }

    if (editingTask) {
      const newTasks = tasks.map(t => t.id === editingTask.id ? { ...t, ...data, updatedAt: Date.now() } : t);
      createLog(editingTask.id, data.title, "modified task settings", newTasks, freshCats, logs);
    } else {
      const newTask: Task = {
        id: Math.random().toString(36).substr(2, 9),
        title: data.title,
        category: data.category,
        deadline: data.deadline,
        notes: data.notes,
        assignee: data.assignee,
        status: 'Pending',
        updatedAt: Date.now()
      };
      const newTasks = [...tasks, newTask];
      createLog(newTask.id, newTask.title, "created a new task", newTasks, freshCats, logs);
    }
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  const exportCSV = () => {
    const headers = ["Category", "Task", "Status", "Deadline", "Assignee", "Notes"];
    const rows = [headers.join(","), ...tasks.map(t => [`"${t.category}"`,`"${t.title}"`,`"${t.status}"`,`"${t.deadline || ''}"`,`"${t.assignee || ''}"`,`"${(t.notes || '').replace(/\n/g, ' ')}"`].join(","))];
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Event_Master_Plan.csv`;
    a.click();
  };

  if (isInitializing) return null;
  if (!user) return <NicknameModal onJoin={(n) => { setUser({ nickname: n }); localStorage.setItem(STORAGE_KEY_USER, n); }} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <Header user={user} onLogout={() => { setUser(null); localStorage.removeItem(STORAGE_KEY_USER); }} />
      
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        <div className="flex-grow space-y-6">
          <DashboardStats tasks={tasks} />
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <button onClick={() => setViewMode('board')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'board' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Board</button>
                <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>List</button>
              </div>
              
              <div className="h-6 w-px bg-slate-200 mx-1"></div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => pull(true)}
                  disabled={syncStatus === 'syncing'}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${syncStatus === 'error' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                >
                  <svg className={`w-3.5 h-3.5 ${syncStatus === 'syncing' || syncStatus === 'checking' ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h5M20 20v-5h-5M4 13a8.1 8.1 0 0015.5 2m.5 5v-5h-5M20 11a8.1 8.1 0 00-15.5-2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {syncStatus === 'error' ? 'RETRY' : syncStatus === 'syncing' ? 'SAVING...' : syncStatus === 'checking' ? 'SYNCING...' : 'SYNC NOW'}
                  </span>
                </button>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter leading-none">Shared Table</span>
                  <span className="text-[10px] text-slate-500 font-mono leading-tight">{syncStatus === 'synced' ? `Updated: ${new Date(lastSyncTime).toLocaleTimeString([], { hour12: false })}` : 'Refreshing...'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={exportCSV} className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Export
              </button>
              <button onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }} className="flex-1 sm:flex-none px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ADD TASK
              </button>
            </div>
          </div>

          {viewMode === 'board' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map(category => (
                <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[500px]">
                  <div className="flex justify-between items-center mb-4 group/cat">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <h3 className="text-sm font-bold text-slate-800 uppercase truncate">{category}</h3>
                    </div>
                    <button onClick={() => { setPreselectedCategory(category); setIsModalOpen(true); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-indigo-600 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2"/></svg></button>
                  </div>
                  <div className="flex-grow overflow-y-auto custom-scrollbar space-y-4">
                    {tasks.filter(t => t.category === category).map(task => (
                      <TaskCard key={task.id} task={task} onUpdate={(u) => updateTask(task.id, u)} onDelete={() => deleteTask(task.id)} onEdit={() => { setEditingTask(task); setIsModalOpen(true); }} />
                    ))}
                    {tasks.filter(t => t.category === category).length === 0 && (
                      <div className="h-full flex items-center justify-center text-slate-300 text-xs italic font-medium">No tasks found</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TaskListView 
              tasks={tasks} 
              onUpdate={updateTask} 
              onDelete={deleteTask} 
              onEdit={(t) => { setEditingTask(t); setIsModalOpen(true); }} 
              categories={categories} 
              onAddTask={(c) => { setPreselectedCategory(c); setIsModalOpen(true); }} 
              onEditCategory={() => {}} 
              onDeleteCategory={() => {}} 
            />
          )}
        </div>
        <aside className="lg:w-80 shrink-0">
          <ActivitySidebar logs={logs} />
        </aside>
      </main>

      {isModalOpen && (
        <TaskFormModal 
          isOpen={isModalOpen} 
          onClose={() => { setIsModalOpen(false); setEditingTask(undefined); }} 
          onSubmit={onFormSubmit} 
          categories={categories} 
          initialData={editingTask} 
          preselectedCategory={preselectedCategory} 
          currentUserNickname={user.nickname} 
        />
      )}
    </div>
  );
}
