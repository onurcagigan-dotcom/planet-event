
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Task, ActivityLog, TaskStatus } from './types';
import { INITIAL_TASKS, DEFAULT_CATEGORIES, STATUS_COLORS } from './constants';
import { TaskCard } from './components/TaskCard';
import { ActivitySidebar } from './components/ActivitySidebar';
import { NicknameModal } from './components/NicknameModal';
import { Header } from './components/Header';
import { DashboardStats } from './components/DashboardStats';
import { TaskListView } from './components/TaskListView';
import { TaskFormModal } from './components/TaskFormModal';

const STORAGE_KEY_TASKS = 'planet_v6_tasks';
const STORAGE_KEY_LOGS = 'planet_v6_logs';
const STORAGE_KEY_USER = 'planet_v6_user';
const STORAGE_KEY_CATEGORIES = 'planet_v6_categories';
const STORAGE_KEY_LAST_UPDATE = 'planet_v6_last_sync_ts';

// Using a fresh KVDB path for better reliability
const SYNC_URL = 'https://kvdb.io/A9S9h7nL3u3Jt9v6m8K1Z2/planet_sync_stable_v6';

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

  // Critical refs for state management outside of the render cycle
  const lastUpdateRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);
  const stateRef = useRef({ tasks, categories, logs });

  // Update stateRef whenever main state changes to ensure sync always has latest data
  useEffect(() => {
    stateRef.current = { tasks, categories, logs };
  }, [tasks, categories, logs]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);

  /**
   * Core Push Function
   * Persists current local state to the cloud.
   */
  const pushToCloud = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncStatus('syncing');

    const timestamp = Date.now();
    const payload = {
      tasks: stateRef.current.tasks,
      categories: stateRef.current.categories,
      logs: stateRef.current.logs,
      lastUpdate: timestamp
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(SYNC_URL, {
        method: 'PUT',
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        lastUpdateRef.current = timestamp;
        localStorage.setItem(STORAGE_KEY_LAST_UPDATE, timestamp.toString());
        setLastSyncTime(Date.now());
        setSyncStatus('synced');
      } else {
        console.error('Push failed with status:', response.status);
        setSyncStatus('error');
      }
    } catch (error) {
      console.error('Push Error:', error);
      setSyncStatus('error');
    } finally {
      isSyncingRef.current = false;
    }
  };

  /**
   * Core Pull Function
   * Checks cloud for updates and reconciles if cloud is newer.
   */
  const pullFromCloud = useCallback(async (isManual = false) => {
    if (isSyncingRef.current) return;
    
    setSyncStatus(isManual ? 'syncing' : 'checking');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(SYNC_URL, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        if (!text || text.trim() === "") {
          // Empty cloud bucket - if manual, we push our local state to initialize it
          if (isManual) await pushToCloud();
          else setSyncStatus('synced');
          return;
        }

        const cloudData = JSON.parse(text);
        
        // Only update if cloud has a newer timestamp
        if (cloudData.lastUpdate > lastUpdateRef.current) {
          setTasks(cloudData.tasks);
          setCategories(cloudData.categories);
          setLogs(cloudData.logs);
          lastUpdateRef.current = cloudData.lastUpdate;
          setLastSyncTime(Date.now());
          
          localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(cloudData.tasks));
          localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(cloudData.categories));
          localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(cloudData.logs));
          localStorage.setItem(STORAGE_KEY_LAST_UPDATE, cloudData.lastUpdate.toString());
        }
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch (error) {
      console.error('Pull Error:', error);
      setSyncStatus('error');
    } finally {
      // Small delay for UX feedback
      if (!isManual) {
        setTimeout(() => setSyncStatus(prev => (prev === 'checking' || prev === 'syncing') ? 'synced' : prev), 1000);
      }
    }
  }, []);

  // Initialization
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUser) setUser({ nickname: savedUser });

    const savedTasks = localStorage.getItem(STORAGE_KEY_TASKS);
    const savedCategories = localStorage.getItem(STORAGE_KEY_CATEGORIES);
    const savedLogs = localStorage.getItem(STORAGE_KEY_LOGS);
    const savedLastUpdate = localStorage.getItem(STORAGE_KEY_LAST_UPDATE);

    if (savedTasks) setTasks(JSON.parse(savedTasks));
    else setTasks(INITIAL_TASKS);

    if (savedCategories) setCategories(JSON.parse(savedCategories));
    else setCategories(DEFAULT_CATEGORIES);

    if (savedLogs) setLogs(JSON.parse(savedLogs));
    if (savedLastUpdate) lastUpdateRef.current = parseInt(savedLastUpdate);

    setIsInitializing(false);
    
    // Check cloud on startup
    setTimeout(() => pullFromCloud(false), 800);
  }, [pullFromCloud]);

  // Polling every 10 seconds to keep clients in sync
  useEffect(() => {
    if (isInitializing || !user) return;
    const interval = setInterval(() => {
      if (syncStatus === 'synced') pullFromCloud(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [isInitializing, user, pullFromCloud, syncStatus]);

  /**
   * Updates local state and immediately triggers a cloud push
   */
  const handleDataChange = (newTasks: Task[], newCategories: string[], newLogs: ActivityLog[]) => {
    setTasks(newTasks);
    setCategories(newCategories);
    setLogs(newLogs);
    
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(newTasks));
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(newCategories));
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(newLogs));
    
    // Update local lastUpdate timestamp before pushing
    lastUpdateRef.current = Date.now();
    localStorage.setItem(STORAGE_KEY_LAST_UPDATE, lastUpdateRef.current.toString());
    
    // Trigger push with a slight delay to allow state to settle
    setTimeout(() => pushToCloud(), 100);
  };

  const addLog = (taskId: string, title: string, action: string, currentTasks: Task[], currentCategories: string[], currentLogs: ActivityLog[]) => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId,
      taskTitle: title,
      nickname: user?.nickname || 'Anonymous',
      action,
      timestamp: Date.now()
    };
    const updatedLogs = [newLog, ...currentLogs].slice(0, 50);
    handleDataChange(currentTasks, currentCategories, updatedLogs);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    let actionLabel = "updated";
    if (updates.status && updates.status !== task.status) actionLabel = `status: ${updates.status}`;
    else if (updates.assignee !== undefined) actionLabel = `assigned to ${updates.assignee || 'Unassigned'}`;
    
    const newTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    addLog(id, task.title, actionLabel, newTasks, categories, logs);
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !confirm(`Delete "${task.title}" permanently?`)) return;
    const newTasks = tasks.filter(t => t.id !== id);
    addLog(id, task.title, "removed task", newTasks, categories, logs);
  };

  const handleFormSubmit = (data: { title: string, category: string, deadline: string | null, notes: string, assignee: string | null }) => {
    let currentCategories = [...categories];
    if (!currentCategories.includes(data.category)) {
      currentCategories = [...currentCategories, data.category];
    }

    if (editingTask) {
      const newTasks = tasks.map(t => t.id === editingTask.id ? { ...t, ...data, updatedAt: Date.now() } : t);
      addLog(editingTask.id, data.title, "updated details", newTasks, currentCategories, logs);
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
      addLog(newTask.id, newTask.title, "created new task", newTasks, currentCategories, logs);
    }
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  const exportToCSV = () => {
    const headers = ["Category", "Task", "Status", "Deadline", "Assignee", "Notes"];
    const csvRows = [headers.join(","), ...tasks.map(t => [`"${t.category}"`,`"${t.title}"`,`"${t.status}"`,`"${t.deadline || ''}"`,`"${t.assignee || ''}"`,`"${(t.notes || '').replace(/\n/g, ' ')}"`].join(","))];
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Planet_Event_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
                  onClick={() => pullFromCloud(true)}
                  disabled={syncStatus === 'syncing'}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${syncStatus === 'error' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                >
                  <svg className={`w-3.5 h-3.5 ${syncStatus === 'syncing' || syncStatus === 'checking' ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h5M20 20v-5h-5M4 13a8.1 8.1 0 0015.5 2m.5 5v-5h-5M20 11a8.1 8.1 0 00-15.5-2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {syncStatus === 'error' ? 'RETRY SYNC' : syncStatus === 'syncing' ? 'SAVING...' : syncStatus === 'checking' ? 'CHECKING...' : 'SYNC NOW'}
                  </span>
                </button>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter leading-none">Last Synced</span>
                  <span className="text-[10px] text-slate-500 font-mono leading-tight">{new Date(lastSyncTime).toLocaleTimeString([], { hour12: false })}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={exportToCSV} className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Export
              </button>
              <button onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }} className="flex-1 sm:flex-none px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                NEW TASK
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
                      <div className="h-full flex items-center justify-center text-slate-300 text-xs italic font-medium">Empty bucket</div>
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
          onSubmit={handleFormSubmit} 
          categories={categories} 
          initialData={editingTask} 
          preselectedCategory={preselectedCategory} 
          currentUserNickname={user.nickname} 
        />
      )}
    </div>
  );
}
