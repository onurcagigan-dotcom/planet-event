
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

// V13: Ultra-stable shared bucket
const SYNC_URL = 'https://kvdb.io/A9S9h7nL3u3Jt9v6m8K1Z2/planet_v13_stable';
const STORAGE_KEY_USER = 'planet_user_v13';
const STORAGE_KEY_DATA = 'planet_local_cache_v13';

type ViewMode = 'board' | 'list';
type SyncStatus = 'synced' | 'syncing' | 'error' | 'checking' | 'offline';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [isInitializing, setIsInitializing] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Sync Control Refs
  const lastUpdateTs = useRef<number>(0);
  const isSyncing = useRef<boolean>(false);
  const backoffCount = useRef<number>(0);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);

  // Handle Online/Offline status
  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  /**
   * PUSH: Send data to cloud with local fallback
   */
  const broadcast = async (t: Task[], c: string[], l: ActivityLog[]) => {
    // 1. Always save to local storage first (Safety Net)
    const timestamp = Date.now();
    const payload = { tasks: t, categories: c, logs: l, lastUpdate: timestamp };
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(payload));
    lastUpdateTs.current = timestamp;

    if (!navigator.onLine || isSyncing.current) return;
    
    isSyncing.current = true;
    setSyncStatus('syncing');

    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(SYNC_URL, {
        method: 'PUT',
        mode: 'cors',
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(tid);

      if (!res.ok) throw new Error(`Cloud rejected: ${res.status}`);

      setSyncStatus('synced');
      setLastSyncTime(Date.now());
      backoffCount.current = 0;
    } catch (err) {
      console.warn('Sync failed, will retry later:', err);
      setSyncStatus('error');
      backoffCount.current++;
    } finally {
      isSyncing.current = false;
    }
  };

  /**
   * PULL: Get latest from cloud
   */
  const pull = useCallback(async (isManual = false) => {
    if (isSyncing.current || !navigator.onLine) return;
    
    setSyncStatus(isManual ? 'syncing' : 'checking');
    try {
      const res = await fetch(`${SYNC_URL}?cb=${Date.now()}`, { cache: 'no-store' });
      
      if (res.ok) {
        const text = await res.text();
        if (!text || text.trim() === "") {
          if (isManual) await broadcast(tasks, categories, logs);
          setSyncStatus('synced');
          return;
        }

        const data = JSON.parse(text);
        if (data.lastUpdate > lastUpdateTs.current) {
          setTasks(data.tasks || []);
          setCategories(data.categories || DEFAULT_CATEGORIES);
          setLogs(data.logs || []);
          lastUpdateTs.current = data.lastUpdate;
          setLastSyncTime(Date.now());
          // Update local cache
          localStorage.setItem(STORAGE_KEY_DATA, text);
        }
        setSyncStatus('synced');
        backoffCount.current = 0;
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      console.warn('Pull failed:', err);
      setSyncStatus('error');
      backoffCount.current++;
    } finally {
      if (!isManual) {
        setTimeout(() => setSyncStatus(prev => prev === 'checking' ? 'synced' : prev), 1000);
      }
    }
  }, [tasks, categories, logs]);

  // Initial Load & Hydration
  useEffect(() => {
    // 1. Get User
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUser) setUser({ nickname: savedUser });

    // 2. Hydrate from Local Cache immediately
    const localData = localStorage.getItem(STORAGE_KEY_DATA);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        setTasks(parsed.tasks);
        setCategories(parsed.categories);
        setLogs(parsed.logs);
        lastUpdateTs.current = parsed.lastUpdate || 0;
      } catch (e) {
        setTasks(INITIAL_TASKS);
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setTasks(INITIAL_TASKS);
      setCategories(DEFAULT_CATEGORIES);
    }

    setIsInitializing(false);
    
    // 3. Initial Cloud Sync
    const timer = setTimeout(() => pull(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Smarter Sequential Heartbeat
  useEffect(() => {
    if (isInitializing || !user || isModalOpen) return;

    let timeoutId: number;
    const poll = async () => {
      if (navigator.onLine && syncStatus !== 'syncing') {
        await pull(false);
      }
      
      // Dynamic backoff logic to prevent "Retry Loop"
      const baseDelay = 8000;
      const errorDelay = Math.min(backoffCount.current * 10000, 40000);
      timeoutId = window.setTimeout(poll, baseDelay + errorDelay);
    };

    poll();
    return () => clearTimeout(timeoutId);
  }, [isInitializing, user, isModalOpen, pull, syncStatus]);

  /**
   * UI Action Handler
   */
  const handleUpdate = (t: Task[], c: string[], l: ActivityLog[]) => {
    setTasks(t);
    setCategories(c);
    setLogs(l);
    broadcast(t, c, l);
  };

  const addLog = (taskId: string, title: string, action: string, t: Task[], c: string[], l: ActivityLog[]) => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId,
      taskTitle: title,
      nickname: user?.nickname || 'Team',
      action,
      timestamp: Date.now()
    };
    const updatedLogs = [newLog, ...l].slice(0, 50);
    handleUpdate(t, c, updatedLogs);
  };

  const onUpdateTask = (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    let msg = "updated details";
    if (updates.status && updates.status !== task.status) msg = `moved to ${updates.status}`;
    else if (updates.assignee !== undefined) msg = `assigned to ${updates.assignee || 'Unassigned'}`;
    
    const newTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    addLog(id, task.title, msg, newTasks, categories, logs);
  };

  const onDeleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !confirm(`Delete "${task.title}"?`)) return;
    const newTasks = tasks.filter(t => t.id !== id);
    addLog(id, task.title, "removed the task", newTasks, categories, logs);
  };

  const onFormSubmit = (data: { title: string, category: string, deadline: string | null, notes: string, assignee: string | null }) => {
    let freshCats = [...categories];
    if (!freshCats.includes(data.category)) freshCats = [...freshCats, data.category];

    if (editingTask) {
      const newTasks = tasks.map(t => t.id === editingTask.id ? { ...t, ...data, updatedAt: Date.now() } : t);
      addLog(editingTask.id, data.title, "modified settings", newTasks, freshCats, logs);
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
      addLog(newTask.id, newTask.title, "added new task", newTasks, freshCats, logs);
    }
    setIsModalOpen(false);
    setEditingTask(undefined);
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
                  disabled={syncStatus === 'syncing' || !isOnline}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${!isOnline ? 'bg-slate-100 text-slate-400' : syncStatus === 'error' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                >
                  <svg className={`w-3.5 h-3.5 ${syncStatus === 'syncing' || syncStatus === 'checking' ? 'animate-spin text-indigo-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h5M20 20v-5h-5M4 13a8.1 8.1 0 0015.5 2m.5 5v-5h-5M20 11a8.1 8.1 0 00-15.5-2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {!isOnline ? 'OFFLINE' : syncStatus === 'error' ? 'RETRY' : syncStatus === 'syncing' ? 'SAVING...' : syncStatus === 'checking' ? 'SYNCING' : 'SYNCED'}
                  </span>
                </button>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter leading-none">Shared Tracking</span>
                  <span className="text-[10px] text-slate-500 font-mono leading-tight">{syncStatus === 'synced' ? `Refreshed: ${new Date(lastSyncTime).toLocaleTimeString([], { hour12: false })}` : 'Updating...'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }} className="flex-1 sm:flex-none px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ADD NEW TASK
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
                      <TaskCard key={task.id} task={task} onUpdate={(u) => onUpdateTask(task.id, u)} onDelete={() => onDeleteTask(task.id)} onEdit={() => { setEditingTask(task); setIsModalOpen(true); }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TaskListView 
              tasks={tasks} 
              onUpdate={onUpdateTask} 
              onDelete={onDeleteTask} 
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
