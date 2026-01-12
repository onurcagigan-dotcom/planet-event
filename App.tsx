
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

/**
 * V25: UNIVERSAL IDENTITY & CLOUD RECOVERY
 * We are using a fresh, strictly formatted v4 UUID as required by kvdb.io.
 */
const DEFAULT_BUCKET = 'e4b2d9f1-7a3c-482e-9c1d-6b5f4a3e2d1c';
const DEFAULT_PROJECT = 'planet_v25_final';

const STORAGE_KEYS = {
  DB: `planet_v25_local_db`,
  SESSION: `planet_v25_user`,
  BUCKET_OVERRIDE: `planet_v25_bucket_id`
};

type SyncState = 'active' | 'syncing' | 'local' | 'error';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [syncState, setSyncState] = useState<SyncState>('active');
  const [version, setVersion] = useState<number>(0);
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Dynamic Bucket Management
  const [activeBucket, setActiveBucket] = useState(localStorage.getItem(STORAGE_KEYS.BUCKET_OVERRIDE) || DEFAULT_BUCKET);

  const vRef = useRef(0);
  const syncLock = useRef(false);
  const hasLocalChanges = useRef(false);

  const getSyncUrl = () => `https://kvdb.io/${activeBucket}/${DEFAULT_PROJECT}`;

  /**
   * RECOVERY: Change Bucket ID Manually
   */
  const handleBucketOverride = () => {
    const newId = prompt("Yeni bir Bucket ID (UUID) girin veya varsayılana dönmek için boş bırakın:", activeBucket);
    if (newId !== null) {
      const idToSet = newId.trim() || DEFAULT_BUCKET;
      setActiveBucket(idToSet);
      localStorage.setItem(STORAGE_KEYS.BUCKET_OVERRIDE, idToSet);
      window.location.reload();
    }
  };

  /**
   * CLOUD PUSH: Write to KVDB
   */
  const cloudPush = async (overrideData?: any) => {
    if (syncLock.current || !navigator.onLine) {
      if (!navigator.onLine) setSyncState('local');
      return;
    }

    syncLock.current = true;
    setSyncState('syncing');
    setErrorMessage(null);

    const nextV = vRef.current + 1;
    const payload: ProjectData = {
      tasks: overrideData?.tasks || tasks,
      categories: overrideData?.categories || categories,
      logs: (overrideData?.logs || logs).slice(0, 50),
      version: nextV,
      lastUpdatedBy: user?.nickname || 'Guest',
      timestamp: Date.now()
    };

    try {
      const res = await fetch(getSyncUrl(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Bulut Hatası (${res.status}): ${errText || 'Erişim reddedildi'}`);
      }

      vRef.current = nextV;
      setVersion(nextV);
      setLastSync(Date.now());
      setSyncState('active');
      hasLocalChanges.current = false;
      localStorage.setItem(STORAGE_KEYS.DB, JSON.stringify(payload));
    } catch (err: any) {
      console.error('Push Error:', err);
      setSyncState('error');
      setErrorMessage(err.message);
    } finally {
      syncLock.current = false;
    }
  };

  /**
   * CLOUD PULL: Read from KVDB
   */
  const cloudPull = useCallback(async (isInitial = false) => {
    if (syncLock.current || !navigator.onLine || hasLocalChanges.current) return;

    if (isInitial) setSyncState('syncing');

    try {
      const res = await fetch(`${getSyncUrl()}?_v=${Date.now()}`);
      
      if (res.status === 404) {
        // Project not initialized on cloud yet
        if (isInitial) await cloudPush();
        return;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Veri Çekme Hatası (${res.status}): ${errText}`);
      }

      const data = await res.json();
      
      if (data && data.version > vRef.current) {
        setTasks(data.tasks || []);
        setCategories(data.categories || DEFAULT_CATEGORIES);
        setLogs(data.logs || []);
        vRef.current = data.version;
        setVersion(data.version);
        setLastSync(Date.now());
        setSyncState('active');
        localStorage.setItem(STORAGE_KEYS.DB, JSON.stringify(data));
      } else {
        setSyncState('active');
      }
    } catch (err: any) {
      if (isInitial) {
        setSyncState('error');
        setErrorMessage(err.message);
      }
    }
  }, [tasks, categories, logs, user, activeBucket]);

  // Initial Boot
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (savedUser) setUser({ nickname: savedUser });

    const localData = localStorage.getItem(STORAGE_KEYS.DB);
    if (localData) {
      try {
        const d = JSON.parse(localData);
        setTasks(d.tasks || INITIAL_TASKS);
        setCategories(d.categories || DEFAULT_CATEGORIES);
        setLogs(d.logs || []);
        vRef.current = d.version || 0;
        setVersion(vRef.current);
      } catch (e) {
        setTasks(INITIAL_TASKS);
      }
    } else {
      setTasks(INITIAL_TASKS);
      setCategories(DEFAULT_CATEGORIES);
    }
    
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (isReady && user) {
      const timer = setTimeout(() => cloudPull(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isReady, user, activeBucket]);

  // Sync Interval
  useEffect(() => {
    if (!isReady || !user) return;
    const interval = setInterval(() => {
      if (hasLocalChanges.current) {
        cloudPush();
      } else {
        cloudPull();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isReady, user, cloudPull, tasks, categories, logs]);

  /**
   * Handlers
   */
  const applyChange = (t: Task[], c: string[], l: ActivityLog[]) => {
    setTasks(t);
    setCategories(c);
    setLogs(l);
    hasLocalChanges.current = true;
    cloudPush({ tasks: t, categories: c, logs: l });
  };

  const onUpdateTask = (id: string, updates: Partial<Task>) => {
    const nextTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    const task = tasks.find(t => t.id === id);
    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId: id,
      taskTitle: task?.title || 'Unknown',
      nickname: user?.nickname || 'User',
      action: updates.status ? `durumunu ${updates.status} yaptı` : "bilgilerini güncelledi",
      timestamp: Date.now()
    };
    applyChange(nextTasks, categories, [log, ...logs].slice(0, 50));
  };

  const onDeleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !confirm(`"${task.title}" silinsin mi?`)) return;
    const nextTasks = tasks.filter(t => t.id !== id);
    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId: id,
      taskTitle: task.title,
      nickname: user?.nickname || 'User',
      action: "görevi sildi",
      timestamp: Date.now()
    };
    applyChange(nextTasks, categories, [log, ...logs].slice(0, 50));
  };

  const onFormSubmit = (data: any) => {
    let activeCats = [...categories];
    if (!activeCats.includes(data.category)) activeCats.push(data.category);

    const isEdit = !!editingTask;
    const nextTasks = isEdit 
      ? tasks.map(t => t.id === editingTask!.id ? { ...t, ...data, updatedAt: Date.now() } : t)
      : [...tasks, { id: Math.random().toString(36).substr(2, 9), ...data, status: 'Pending', updatedAt: Date.now() }];

    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId: isEdit ? editingTask!.id : 'new',
      taskTitle: data.title,
      nickname: user?.nickname || 'User',
      action: isEdit ? "düzenledi" : "ekledi",
      timestamp: Date.now()
    };
    
    applyChange(nextTasks, activeCats, [log, ...logs].slice(0, 50));
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);

  if (!isReady) return null;
  if (!user) return <NicknameModal onJoin={(n) => { setUser({ nickname: n }); localStorage.setItem(STORAGE_KEYS.SESSION, n); }} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header user={user} onLogout={() => { setUser(null); localStorage.removeItem(STORAGE_KEYS.SESSION); }} />
      
      <main className="flex-grow container mx-auto px-4 py-4 lg:py-8 flex flex-col lg:flex-row gap-8">
        <div className="flex-grow space-y-6">
          <DashboardStats tasks={tasks} />
          
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>LİSTE</button>
                <button onClick={() => setViewMode('board')} className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all ${viewMode === 'board' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>PANEL</button>
              </div>

              <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 min-w-[160px]">
                <div className={`w-2.5 h-2.5 rounded-full ${syncState === 'syncing' ? 'bg-amber-400 animate-pulse' : syncState === 'error' ? 'bg-red-500' : 'bg-green-500 shadow-sm shadow-green-200'}`}></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-slate-700 leading-none">
                    {syncState === 'syncing' ? 'Eşitleniyor' : syncState === 'error' ? 'Bağlantı Sorunu' : 'Bulut Çevrimiçi'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono tracking-tighter mt-0.5">
                    V{version} • {new Date(lastSync).toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button 
                onClick={() => cloudPull(true)}
                className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-all active:scale-95"
                title="Şimdi Güncelle"
              >
                <svg className={`w-4 h-4 ${syncState === 'syncing' ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M4 4v5h5M20 20v-5h-5M4 13a8.1 8.1 0 0015.5 2m.5 5v-5h-5M20 11a8.1 8.1 0 00-15.5-2"/></svg>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
              {categories.map(category => (
                <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col h-[550px]">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm"></span>
                      {category}
                    </h3>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full uppercase">
                         {tasks.filter(t => t.category === category).length} GÖREV
                       </span>
                    </div>
                  </div>
                  <div className="flex-grow overflow-y-auto custom-scrollbar space-y-3 pr-1">
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

      {/* Persistence / Error Banner */}
      {syncState === 'error' && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 bg-slate-900 text-white p-5 rounded-2xl shadow-2xl flex flex-col gap-3 z-50 border border-slate-700 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
            <p className="text-xs font-black uppercase tracking-widest leading-none">Bulut Erişimi Kısıtlı</p>
          </div>
          <p className="text-[10px] opacity-70 leading-relaxed">
            {errorMessage || "KVDB sunucusu UUID hatası veriyor olabilir. Sistem otomatik düzeltildi. Sorun sürerse Bucket ID'yi manuel güncelleyin."}
          </p>
          <div className="flex gap-2">
            <button onClick={() => cloudPush()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex-grow">TEKRAR DENE</button>
            <button onClick={handleBucketOverride} className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all">ID DEĞİŞTİR</button>
          </div>
        </div>
      )}
    </div>
  );
}
