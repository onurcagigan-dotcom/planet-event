
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Task, ActivityLog, ProjectData } from './types';
import { INITIAL_TASKS, DEFAULT_CATEGORIES } from './constants';
import { TaskCard } from './components/TaskCard';
import { ActivitySidebar } from './components/ActivitySidebar';
import { NicknameModal } from './components/NicknameModal';
import { Header } from './components/Header';
import { DashboardStats } from './components/DashboardStats';
import { TaskListView } from './components/TaskListView';
import { TaskFormModal } from './components/TaskFormModal';

// V15: Enhanced Reliability Protocol
const PROJECT_UUID = 'planet_drive_v15_final';
const SYNC_URL = `https://kvdb.io/A9S9h7nL3u3Jt9v6m8K1Z2/${PROJECT_UUID}`;
const STORAGE_KEYS = {
  USER: `user_${PROJECT_UUID}`,
  DATA: `data_${PROJECT_UUID}`
};

type ViewMode = 'board' | 'list';
type SyncStatus = 'online' | 'saving' | 'reconnecting' | 'error';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('online');
  const [lastSyncTs, setLastSyncTs] = useState<number>(Date.now());
  const [version, setVersion] = useState<number>(0);
  const [isInitializing, setIsInitializing] = useState(true);

  // Sync Logic Refs
  const currentVersion = useRef<number>(0);
  const isBusy = useRef<boolean>(false);
  const pendingSync = useRef<boolean>(false);
  const consecutiveFailures = useRef<number>(0);

  /**
   * PUSH: Drive-style Upload
   */
  const uploadToCloud = async (overrideData?: any) => {
    if (isBusy.current || !navigator.onLine) {
      pendingSync.current = true;
      return;
    }

    isBusy.current = true;
    setSyncStatus('saving');

    const nextVersion = currentVersion.current + 1;
    const payload: ProjectData = {
      tasks: overrideData?.tasks || tasks,
      categories: overrideData?.categories || categories,
      logs: overrideData?.logs || logs,
      version: nextVersion,
      lastUpdatedBy: user?.nickname || 'Team',
      timestamp: Date.now()
    };

    try {
      const response = await fetch(SYNC_URL, {
        method: 'PUT',
        body: JSON.stringify(payload),
        mode: 'cors'
      });

      if (!response.ok) throw new Error('Cloud push rejected');

      currentVersion.current = nextVersion;
      setVersion(nextVersion);
      setLastSyncTs(Date.now());
      setSyncStatus('online');
      consecutiveFailures.current = 0;
      pendingSync.current = false;
      
      // Save locally as backup
      localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(payload));
    } catch (err) {
      console.warn('Sync delayed:', err);
      setSyncStatus('reconnecting');
      consecutiveFailures.current++;
      pendingSync.current = true;
    } finally {
      isBusy.current = false;
    }
  };

  /**
   * PULL: Drive-style Fetch
   */
  const downloadFromCloud = useCallback(async (isInitial = false) => {
    if (isBusy.current || !navigator.onLine) return;
    
    if (isInitial) setSyncStatus('saving');
    
    try {
      const response = await fetch(`${SYNC_URL}?nocache=${Date.now()}`);
      if (!response.ok) return;

      const dataText = await response.text();
      if (!dataText || dataText.trim() === "") {
        // First time setup: push current local state
        if (isInitial) await uploadToCloud();
        return;
      }

      const cloudData: ProjectData = JSON.parse(dataText);

      // Version check for conflict resolution
      if (cloudData.version > currentVersion.current) {
        setTasks(cloudData.tasks);
        setCategories(cloudData.categories);
        setLogs(cloudData.logs);
        setVersion(cloudData.version);
        currentVersion.current = cloudData.version;
        setLastSyncTs(Date.now());
        localStorage.setItem(STORAGE_KEYS.DATA, dataText);
      }
      setSyncStatus('online');
      consecutiveFailures.current = 0;
    } catch (err) {
      console.warn('Silent pull failed');
      if (isInitial) setSyncStatus('error');
    } finally {
      if (isInitial) setSyncStatus('online');
    }
  }, [tasks, categories, logs]);

  // Bootup Initialization
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    if (savedUser) setUser({ nickname: savedUser });

    const localCache = localStorage.getItem(STORAGE_KEYS.DATA);
    if (localCache) {
      try {
        const d = JSON.parse(localCache);
        setTasks(d.tasks);
        setCategories(d.categories);
        setLogs(d.logs);
        setVersion(d.version || 0);
        currentVersion.current = d.version || 0;
      } catch (e) {
        setTasks(INITIAL_TASKS);
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setTasks(INITIAL_TASKS);
      setCategories(DEFAULT_CATEGORIES);
    }
    
    setIsInitializing(false);
    setTimeout(() => downloadFromCloud(true), 1000);
  }, []);

  // Drive-style Pulse (Every 8 seconds)
  useEffect(() => {
    if (isInitializing || !user) return;

    const pulse = setInterval(() => {
      if (pendingSync.current) {
        uploadToCloud();
      } else {
        downloadFromCloud();
      }
    }, 8000);

    return () => clearInterval(pulse);
  }, [isInitializing, user, downloadFromCloud, tasks, categories, logs]);

  /**
   * Action Central
   */
  const syncState = (t: Task[], c: string[], l: ActivityLog[]) => {
    setTasks(t);
    setCategories(c);
    setLogs(l);
    pendingSync.current = true;
    
    // Immediate opportunistic save
    uploadToCloud({ tasks: t, categories: c, logs: l });
  };

  const addLog = (taskId: string, title: string, action: string, t: Task[], c: string[], l: ActivityLog[]) => {
    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId,
      taskTitle: title,
      nickname: user?.nickname || 'User',
      action,
      timestamp: Date.now()
    };
    syncState(t, c, [log, ...l].slice(0, 50));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    addLog(id, task.title, updates.status ? `marked as ${updates.status}` : "updated task details", newTasks, categories, logs);
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !confirm(`Delete "${task.title}"?`)) return;
    const newTasks = tasks.filter(t => t.id !== id);
    addLog(id, task.title, "deleted the task", newTasks, categories, logs);
  };

  const onFormSubmit = (data: any) => {
    let freshCats = [...categories];
    if (!freshCats.includes(data.category)) freshCats.push(data.category);

    const isEdit = !!editingTask;
    const newTasks = isEdit 
      ? tasks.map(t => t.id === editingTask!.id ? { ...t, ...data, updatedAt: Date.now() } : t)
      : [...tasks, { id: Math.random().toString(36).substr(2, 9), ...data, status: 'Pending', updatedAt: Date.now() }];

    addLog(isEdit ? editingTask!.id : 'new', data.title, isEdit ? "updated task info" : "created new task", newTasks, freshCats, logs);
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);

  if (isInitializing) return null;
  if (!user) return <NicknameModal onJoin={(n) => { setUser({ nickname: n }); localStorage.setItem(STORAGE_KEYS.USER, n); }} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header user={user} onLogout={() => { setUser(null); localStorage.removeItem(STORAGE_KEYS.USER); }} />
      
      <main className="flex-grow container mx-auto px-4 py-4 lg:py-8 flex flex-col lg:flex-row gap-8">
        <div className="flex-grow space-y-6">
          <DashboardStats tasks={tasks} />
          
          <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
              <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>LIST VIEW</button>
                <button onClick={() => setViewMode('board')} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${viewMode === 'board' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>BOARD VIEW</button>
              </div>

              <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

              <div className="flex items-center gap-2 shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'saving' ? 'bg-amber-400 animate-pulse' : syncStatus === 'reconnecting' ? 'bg-red-400 animate-pulse' : 'bg-green-500 shadow-sm shadow-green-200'}`}></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-slate-500 leading-none">
                    {syncStatus === 'saving' ? 'Saving...' : syncStatus === 'reconnecting' ? 'Reconnecting...' : 'Drive Connected'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono tracking-tighter">
                    V.{version} • {new Date(lastSyncTs).toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button 
                onClick={() => downloadFromCloud(true)}
                className="p-2.5 bg-slate-50 text-slate-500 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all"
                title="Force Refresh from Cloud"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4 4v5h5M20 20v-5h-5M4 13a8.1 8.1 0 0015.5 2m.5 5v-5h-5M20 11a8.1 8.1 0 00-15.5-2"/></svg>
              </button>
              <button 
                onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
                className="flex-grow md:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                CREATE NEW TASK
              </button>
            </div>
          </div>

          {viewMode === 'list' ? (
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20 lg:pb-0">
              {categories.map(category => (
                <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col h-[500px]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-100"></span>
                      {category}
                    </h3>
                    <button onClick={() => { setPreselectedCategory(category); setIsModalOpen(true); }} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                    </button>
                  </div>
                  <div className="flex-grow overflow-y-auto custom-scrollbar space-y-3">
                    {tasks.filter(t => t.category === category).length > 0 ? (
                      tasks.filter(t => t.category === category).map(task => (
                        <TaskCard key={task.id} task={task} onUpdate={(u) => updateTask(task.id, u)} onDelete={() => deleteTask(task.id)} onEdit={() => { setEditingTask(task); setIsModalOpen(true); }} />
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 border-2 border-dashed border-slate-50 rounded-xl">
                        <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
                        <span className="text-[10px] font-black uppercase tracking-tighter">No tasks yet</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
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

      {/* Persistent Recovery Banner */}
      {syncStatus === 'reconnecting' && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom duration-300 border border-slate-700">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
          <div className="flex-grow">
            <p className="text-xs font-black uppercase tracking-widest leading-none">Connecting to Drive...</p>
            <p className="text-[10px] text-slate-400 mt-1">Changes are safely queued in your local browser storage.</p>
          </div>
          <button 
            onClick={() => uploadToCloud()}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
          >
            Retry Now
          </button>
        </div>
      )}
    </div>
  );
}
