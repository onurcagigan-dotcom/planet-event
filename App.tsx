
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

// Unique bucket for the shared event tracking
const SYNC_URL = 'https://kvdb.io/A9S9h7nL3u3Jt9v6m8K1Z2/planet_event_shared_v10';
const STORAGE_KEY_USER = 'planet_user_v10';

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

  // Sync Control Refs
  const lastUpdateTs = useRef<number>(0);
  const isSyncBusy = useRef<boolean>(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);

  /**
   * PUSH: Send current state to shared cloud
   */
  const broadcastToCloud = async (t: Task[], c: string[], l: ActivityLog[]) => {
    if (isSyncBusy.current) return;
    isSyncBusy.current = true;
    setSyncStatus('syncing');

    const timestamp = Date.now();
    const data = { tasks: t, categories: c, logs: l, lastUpdate: timestamp };

    try {
      const response = await fetch(SYNC_URL, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      lastUpdateTs.current = timestamp;
      setLastSyncTime(Date.now());
      setSyncStatus('synced');
    } catch (err) {
      console.error('Broadcast failed:', err);
      setSyncStatus('error');
    } finally {
      isSyncBusy.current = false;
    }
  };

  /**
   * PULL: Get latest data from shared cloud
   */
  const fetchFromCloud = useCallback(async (isManual = false) => {
    if (isSyncBusy.current && !isManual) return;
    
    setSyncStatus(isManual ? 'syncing' : 'checking');
    try {
      // Use timestamp query param to force bypass any browser/CDN cache
      const response = await fetch(`${SYNC_URL}?cb=${Date.now()}`, { cache: 'no-store' });
      
      if (response.ok) {
        const text = await response.text();
        if (!text || text.trim() === "") {
          // If the cloud is totally empty, initialize it with current state if manual
          if (isManual) await broadcastToCloud(tasks, categories, logs);
          setSyncStatus('synced');
          return;
        }

        const cloud = JSON.parse(text);
        
        // Logical check: only update local if cloud is strictly newer
        if (cloud.lastUpdate > lastUpdateTs.current) {
          setTasks(cloud.tasks || []);
          setCategories(cloud.categories || DEFAULT_CATEGORIES);
          setLogs(cloud.logs || []);
          lastUpdateTs.current = cloud.lastUpdate;
          setLastSyncTime(Date.now());
        }
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Fetch failed:', err);
      setSyncStatus('error');
    } finally {
      if (!isManual) {
        setTimeout(() => setSyncStatus(prev => (prev === 'checking') ? 'synced' : prev), 1000);
      }
    }
  }, [tasks, categories, logs]);

  // Initial Load
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUser) setUser({ nickname: savedUser });

    // Fill with defaults initially
    setTasks(INITIAL_TASKS);
    setCategories(DEFAULT_CATEGORIES);
    setIsInitializing(false);
    
    // Immediate pull attempt
    fetchFromCloud(true);
  }, []);

  // Heartbeat: Check for updates every 5 seconds
  useEffect(() => {
    if (isInitializing || !user) return;
    const heartbeat = setInterval(() => {
      if (syncStatus !== 'syncing') fetchFromCloud(false);
    }, 5000);
    return () => clearInterval(heartbeat);
  }, [isInitializing, user, fetchFromCloud, syncStatus]);

  /**
   * State update wrapper
   */
  const updateAndBroadcast = (t: Task[], c: string[], l: ActivityLog[]) => {
    setTasks(t);
    setCategories(c);
    setLogs(l);
    broadcastToCloud(t, c, l);
  };

  const addLog = (taskId: string, title: string, action: string, curTasks: Task[], curCats: string[], curLogs: ActivityLog[]) => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId,
      taskTitle: title,
      nickname: user?.nickname || 'Guest',
      action,
      timestamp: Date.now()
    };
    const updatedLogs = [newLog, ...curLogs].slice(0, 50);
    updateAndBroadcast(curTasks, curCats, updatedLogs);
  };

  const onUpdateTask = (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    let desc = "updated the task";
    if (updates.status && updates.status !== task.status) desc = `changed status to ${updates.status}`;
    else if (updates.assignee !== undefined) desc = `assigned task to ${updates.assignee || 'Unassigned'}`;
    
    const newTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    addLog(id, task.title, desc, newTasks, categories, logs);
  };

  const onDeleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !confirm(`Delete "${task.title}" permanently?`)) return;
    const newTasks = tasks.filter(t => t.id !== id);
    addLog(id, task.title, "removed the task", newTasks, categories, logs);
  };

  const onFormSubmit = (data: { title: string, category: string, deadline: string | null, notes: string, assignee: string | null }) => {
    let freshCats = [...categories];
    if (!freshCats.includes(data.category)) {
      freshCats = [...freshCats, data.category];
    }

    if (editingTask) {
      const newTasks = tasks.map(t => t.id === editingTask.id ? { ...t, ...data, updatedAt: Date.now() } : t);
      addLog(editingTask.id, data.title, "modified task details", newTasks, freshCats, logs);
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
      addLog(newTask.id, newTask.title, "created a new task", newTasks, freshCats, logs);
    }
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  const onExport = () => {
    const headers = ["Category", "Task", "Status", "Deadline", "Assignee", "Notes"];
    const rows = [headers.join(","), ...tasks.map(t => [`"${t.category}"`,`"${t.title}"`,`"${t.status}"`,`"${t.deadline || ''}"`,`"${t.assignee || ''}"`,`"${(t.notes || '').replace(/\n/g, ' ')}"`].join(","))];
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Event_Project_Plan.csv`;
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
                  onClick={() => fetchFromCloud(true)}
                  disabled={syncStatus === 'syncing'}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${syncStatus === 'error' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-95'}`}
                >
                  <svg className={`w-3.5 h-3.5 ${syncStatus === 'syncing' || syncStatus === 'checking' ? 'animate-spin text-indigo-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h5M20 20v-5h-5M4 13a8.1 8.1 0 0015.5 2m.5 5v-5h-5M20 11a8.1 8.1 0 00-15.5-2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {syncStatus === 'error' ? 'RETRY SYNC' : syncStatus === 'syncing' ? 'SAVING...' : syncStatus === 'checking' ? 'SYNCING...' : 'SYNC NOW'}
                  </span>
                </button>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter leading-none">Shared Table</span>
                  <span className="text-[10px] text-slate-500 font-mono leading-tight">{syncStatus === 'synced' ? `Updated: ${new Date(lastSyncTime).toLocaleTimeString([], { hour12: false })}` : 'Updating...'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={onExport} className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
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
                      <TaskCard key={task.id} task={task} onUpdate={(u) => onUpdateTask(task.id, u)} onDelete={() => onDeleteTask(task.id)} onEdit={() => { setEditingTask(task); setIsModalOpen(true); }} />
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
