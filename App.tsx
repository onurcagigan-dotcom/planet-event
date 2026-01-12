
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

// V19: High-Performance Resilient Cloud Logic
const CLOUD_BUCKET = 'A9S9h7nL3u3Jt9v6m8K1Z2';
const PROJECT_ID = 'planet_v19_production_core'; 
const SYNC_ENDPOINT = `https://kvdb.io/${CLOUD_BUCKET}/${PROJECT_ID}`;

const STORAGE_KEYS = {
  DATA: `planet_v19_cache`,
  USER: `planet_v19_auth`
};

type SyncState = 'online' | 'syncing' | 'local-only' | 'error';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [syncState, setSyncState] = useState<SyncState>('online');
  const [version, setVersion] = useState<number>(0);
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const [isReady, setIsReady] = useState(false);

  // Sync Control Refs
  const currentV = useRef(0);
  const isSyncing = useRef(false);
  const pendingPush = useRef(false);

  /**
   * PULL: Get latest data from Cloud
   */
  const fetchCloudData = useCallback(async (showLoading = false) => {
    if (isSyncing.current || !navigator.onLine) return;
    
    if (showLoading) setSyncState('syncing');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s Timeout

      const response = await fetch(`${SYNC_ENDPOINT}?t=${Date.now()}`, {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Network error');

      const text = await response.text();
      if (!text || text.trim() === "") {
        // First initialization for a new bucket
        if (showLoading) await pushToCloud();
        return;
      }

      const cloud: ProjectData = JSON.parse(text);

      // Version conflict resolution: Cloud is king if version is higher
      if (cloud.version > currentV.current) {
        setTasks(cloud.tasks);
        setCategories(cloud.categories);
        setLogs(cloud.logs);
        setVersion(cloud.version);
        currentV.current = cloud.version;
        setLastSync(Date.now());
        localStorage.setItem(STORAGE_KEYS.DATA, text);
        setSyncState('online');
      } else {
        setSyncState('online');
      }
    } catch (err) {
      console.warn('Sync Pull Failed: Falling back to local mode');
      setSyncState('local-only');
    } finally {
      isSyncing.current = false;
    }
  }, [tasks, categories, logs]);

  /**
   * PUSH: Update Cloud with local state
   */
  const pushToCloud = async (customData?: any) => {
    if (isSyncing.current || !navigator.onLine) {
      pendingPush.current = true;
      if (!navigator.onLine) setSyncState('local-only');
      return;
    }

    isSyncing.current = true;
    setSyncState('syncing');

    const nextV = currentV.current + 1;
    const payload: ProjectData = {
      tasks: customData?.tasks || tasks,
      categories: customData?.categories || categories,
      logs: customData?.logs || logs,
      version: nextV,
      lastUpdatedBy: user?.nickname || 'System',
      timestamp: Date.now()
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(SYNC_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Save failed');

      currentV.current = nextV;
      setVersion(nextV);
      setLastSync(Date.now());
      setSyncState('online');
      pendingPush.current = false;
      localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(payload));
    } catch (err) {
      console.warn('Sync Push Failed: Stored locally');
      setSyncState('local-only');
      pendingPush.current = true;
    } finally {
      isSyncing.current = false;
    }
  };

  // 1. Initial Load: Local Storage Priority
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
        currentV.current = d.version || 0;
      } catch (e) {
        setTasks(INITIAL_TASKS);
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setTasks(INITIAL_TASKS);
      setCategories(DEFAULT_CATEGORIES);
    }
    
    setIsReady(true);
    // Silent initial sync
    setTimeout(() => fetchCloudData(false), 500);
  }, []);

  // 2. Periodic Sync Pulse (Every 15s for stability)
  useEffect(() => {
    if (!isReady || !user) return;

    const syncPulse = setInterval(() => {
      if (pendingPush.current) {
        pushToCloud();
      } else {
        fetchCloudData(false);
      }
    }, 15000);

    return () => clearInterval(syncPulse);
  }, [isReady, user, fetchCloudData, tasks, categories, logs]);

  /**
   * UI Action Handlers
   */
  const handleDataChange = (t: Task[], c: string[], l: ActivityLog[]) => {
    setTasks(t);
    setCategories(c);
    setLogs(l);
    pendingPush.current = true;
    pushToCloud({ tasks: t, categories: c, logs: l });
  };

  const addActivity = (taskId: string, title: string, action: string, t: Task[], c: string[], l: ActivityLog[]) => {
    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId,
      taskTitle: title,
      nickname: user?.nickname || 'User',
      action,
      timestamp: Date.now()
    };
    handleDataChange(t, c, [log, ...l].slice(0, 50));
  };

  const onUpdateTask = (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const nextTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    addActivity(id, task.title, updates.status ? `durumunu ${updates.status} yaptı` : "güncelledi", nextTasks, categories, logs);
  };

  const onDeleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !confirm(`"${task.title}" silinsin mi?`)) return;
    const nextTasks = tasks.filter(t => t.id !== id);
    addActivity(id, task.title, "görevi sildi", nextTasks, categories, logs);
  };

  const onFormSubmit = (data: any) => {
    let activeCats = [...categories];
    if (!activeCats.includes(data.category)) activeCats.push(data.category);

    const isEditing = !!editingTask;
    const nextTasks = isEditing 
      ? tasks.map(t => t.id === editingTask!.id ? { ...t, ...data, updatedAt: Date.now() } : t)
      : [...tasks, { id: Math.random().toString(36).substr(2, 9), ...data, status: 'Pending', updatedAt: Date.now() }];

    addActivity(isEditing ? editingTask!.id : 'new', data.title, isEditing ? "düzenledi" : "ekledi", nextTasks, activeCats, logs);
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);

  if (!isReady) return null;
  if (!user) return <NicknameModal onJoin={(n) => { setUser({ nickname: n }); localStorage.setItem(STORAGE_KEYS.USER, n); }} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header user={user} onLogout={() => { setUser(null); localStorage.removeItem(STORAGE_KEYS.USER); }} />
      
      <main className="flex-grow container mx-auto px-4 py-4 lg:py-8 flex flex-col lg:flex-row gap-8">
        <div className="flex-grow space-y-6">
          <DashboardStats tasks={tasks} />
          
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>LİSTE</button>
                <button onClick={() => setViewMode('board')} className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all ${viewMode === 'board' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>PANEL</button>
              </div>

              <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
                <div className={`w-2 h-2 rounded-full ${syncState === 'syncing' ? 'bg-amber-400 animate-pulse' : syncState === 'local-only' ? 'bg-red-500' : 'bg-green-500 shadow-sm shadow-green-200'}`}></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-slate-600 leading-none">
                    {syncState === 'syncing' ? 'Eşitleniyor...' : syncState === 'local-only' ? 'Yerel Mod (Offline)' : 'Bulut Aktif'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono tracking-tighter">
                    V{version} • {new Date(lastSync).toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button 
                onClick={() => fetchCloudData(true)}
                className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-all active:scale-95"
                title="Şimdi Eşitle"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M4 4v5h5M20 20v-5h-5M4 13a8.1 8.1 0 0015.5 2m.5 5v-5h-5M20 11a8.1 8.1 0 00-15.5-2"/></svg>
              </button>
              <button 
                onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
                className="flex-grow md:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                YENİ GÖREV EKLE
              </button>
            </div>
          </div>

          {viewMode === 'list' ? (
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map(category => (
                <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col h-[500px]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      {category}
                    </h3>
                    <button onClick={() => { setPreselectedCategory(category); setIsModalOpen(true); }} className="text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                    </button>
                  </div>
                  <div className="flex-grow overflow-y-auto custom-scrollbar space-y-3">
                    {tasks.filter(t => t.category === category).map(task => (
                      <TaskCard key={task.id} task={task} onUpdate={(u) => onUpdateTask(task.id, u)} onDelete={() => onDeleteTask(task.id)} onEdit={() => { setEditingTask(task); setIsModalOpen(true); }} />
                    ))}
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

      {syncState === 'local-only' && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 z-50 border border-slate-700">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
          <div className="flex-grow">
            <p className="text-xs font-black uppercase tracking-widest leading-none">Bağlantı Sorunu</p>
            <p className="text-[10px] opacity-70 mt-1">Bulut erişilemiyor, verileriniz tarayıcıda güvende.</p>
          </div>
          <button onClick={() => pushToCloud()} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-[10px] font-black uppercase">YENİLE</button>
        </div>
      )}
    </div>
  );
}
