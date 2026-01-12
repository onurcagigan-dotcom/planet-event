
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
 * SHARED CLOUD CONFIGURATION
 * All users using this app will connect to this specific shared bucket.
 */
const CLOUD_BUCKET_ID = 'planet-shared-event-2026'; 
const PROJECT_NAMESPACE = 'global_v1';
const API_URL = `https://kvdb.io/${CLOUD_BUCKET_ID}/${PROJECT_NAMESPACE}`;

const STORAGE_KEYS = {
  USER_SESSION: 'planet_auth_v7',
  LOCAL_CACHE: 'planet_cache_v7'
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  
  // Sync States
  const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'error' | 'updated'>('connected');
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const isProcessingRef = useRef(false);
  const versionRef = useRef(0);

  // 1. Initial Setup
  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
    if (savedSession) setUser(JSON.parse(savedSession));

    const cache = localStorage.getItem(STORAGE_KEYS.LOCAL_CACHE);
    if (cache) {
      const parsed = JSON.parse(cache);
      setTasks(parsed.tasks || INITIAL_TASKS);
      setCategories(parsed.categories || DEFAULT_CATEGORIES);
      setLogs(parsed.logs || []);
      versionRef.current = parsed.version || 0;
    } else {
      setTasks(INITIAL_TASKS);
      setCategories(DEFAULT_CATEGORIES);
    }
    setIsReady(true);
  }, []);

  // 2. Cloud Pull (Global Sync)
  const pullFromCloud = useCallback(async (isSilent = false) => {
    if (isProcessingRef.current || !navigator.onLine) return;
    if (hasUnsavedChanges && user?.isAdmin) return; // Don't overwrite admin's unsaved local work

    if (!isSilent) setSyncStatus('syncing');

    try {
      const response = await fetch(`${API_URL}?t=${Date.now()}`);
      
      if (response.status === 404) {
        // First time initialization if bucket is empty
        if (user?.isAdmin && tasks.length > 0) await pushToCloud(true);
        setSyncStatus('connected');
        return;
      }

      if (!response.ok) throw new Error('Cloud unreachable');

      const cloudData: ProjectData = await response.json();
      
      // Only update if cloud has a newer version
      if (cloudData.version > versionRef.current) {
        setTasks(cloudData.tasks);
        setCategories(cloudData.categories);
        setLogs(cloudData.logs);
        versionRef.current = cloudData.version;
        setLastSyncTime(Date.now());
        setSyncStatus('updated');
        localStorage.setItem(STORAGE_KEYS.LOCAL_CACHE, JSON.stringify(cloudData));
        setTimeout(() => setSyncStatus('connected'), 2000);
      } else {
        setSyncStatus('connected');
      }
    } catch (error) {
      console.error("Pull Error:", error);
      setSyncStatus('error');
    }
  }, [user, hasUnsavedChanges, tasks.length]);

  // 3. Cloud Push (Admin Only)
  const pushToCloud = async (isInit = false) => {
    if (!user?.isAdmin || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    setSyncStatus('syncing');

    const nextVersion = Date.now(); // Use timestamp as version
    const payload: ProjectData = {
      tasks,
      categories,
      logs: logs.slice(0, 50),
      version: nextVersion,
      lastUpdatedBy: user.nickname,
      timestamp: Date.now()
    };

    try {
      const response = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to push to cloud');

      versionRef.current = nextVersion;
      setLastSyncTime(Date.now());
      setSyncStatus('updated');
      setHasUnsavedChanges(false);
      localStorage.setItem(STORAGE_KEYS.LOCAL_CACHE, JSON.stringify(payload));
      
      setTimeout(() => setSyncStatus('connected'), 2000);
    } catch (error) {
      setSyncStatus('error');
    } finally {
      isProcessingRef.current = false;
    }
  };

  // 4. Background Sync Cycle (Every 5 seconds)
  useEffect(() => {
    if (!isReady || !user) return;
    
    // Initial pull
    pullFromCloud(true);

    const interval = setInterval(() => {
      pullFromCloud(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [isReady, user, pullFromCloud]);

  // 5. Data Mutators (Admin Only)
  const applyLocalChanges = (newTasks: Task[], newCats: string[], newLogs: ActivityLog[]) => {
    if (!user?.isAdmin) return;
    setTasks(newTasks);
    setCategories(newCats);
    setLogs(newLogs);
    setHasUnsavedChanges(true);
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    if (!user?.isAdmin) return;
    const nextTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    const task = tasks.find(t => t.id === id);
    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId: id,
      taskTitle: task?.title || 'Unknown',
      nickname: user.nickname,
      action: updates.status ? `changed status to ${updates.status}` : "updated task details",
      timestamp: Date.now()
    };
    applyLocalChanges(nextTasks, categories, [log, ...logs]);
  };

  const handleDeleteTask = (id: string) => {
    if (!user?.isAdmin) return;
    const task = tasks.find(t => t.id === id);
    if (!task || !confirm(`Permanently delete "${task.title}"?`)) return;
    const nextTasks = tasks.filter(t => t.id !== id);
    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId: id,
      taskTitle: task.title,
      nickname: user.nickname,
      action: "deleted the task",
      timestamp: Date.now()
    };
    applyLocalChanges(nextTasks, categories, [log, ...logs]);
  };

  const handleFormSubmit = (data: any) => {
    if (!user?.isAdmin) return;
    let nextCats = [...categories];
    if (!nextCats.includes(data.category)) nextCats.push(data.category);

    const isEditing = !!editingTask;
    const nextTasks = isEditing 
      ? tasks.map(t => t.id === editingTask!.id ? { ...t, ...data, updatedAt: Date.now() } : t)
      : [...tasks, { id: Math.random().toString(36).substr(2, 9), ...data, status: 'Pending', updatedAt: Date.now() }];

    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId: isEditing ? editingTask!.id : 'new',
      taskTitle: data.title,
      nickname: user.nickname,
      action: isEditing ? "modified task" : "created task",
      timestamp: Date.now()
    };
    
    applyLocalChanges(nextTasks, nextCats, [log, ...logs]);
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);

  if (!isReady) return null;
  if (!user) return <NicknameModal onJoin={(n, admin) => { const ud = { nickname: n, isAdmin: admin }; setUser(ud); localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(ud)); }} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header user={user} onLogout={() => { setUser(null); localStorage.removeItem(STORAGE_KEYS.USER_SESSION); }} />
      
      <main className="flex-grow container mx-auto px-4 py-6 lg:py-8 flex flex-col lg:flex-row gap-8">
        <div className="flex-grow space-y-6">
          <DashboardStats tasks={tasks} />
          
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setViewMode('list')} className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>LIST</button>
                <button onClick={() => setViewMode('board')} className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${viewMode === 'board' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>BOARD</button>
              </div>

              {/* CLOUD STATUS INDICATOR */}
              <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all min-w-[190px] ${syncStatus === 'error' ? 'bg-red-50 border-red-200' : 'bg-indigo-50/50 border-indigo-100'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'syncing' ? 'bg-amber-400 animate-pulse' : syncStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500 shadow-sm shadow-emerald-200'}`}></div>
                <div className="flex flex-col">
                  <span className={`text-[10px] font-black uppercase leading-none ${syncStatus === 'error' ? 'text-red-700' : 'text-indigo-900'}`}>
                    {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Connection Error' : syncStatus === 'updated' ? 'Cloud Updated!' : 'Shared Live DB'}
                  </span>
                  <span className="text-[9px] text-indigo-500 font-bold mt-1 uppercase">
                    Sync: {new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {!user.isAdmin ? (
                <div className="bg-amber-50 text-amber-700 px-4 py-2.5 rounded-xl border border-amber-100 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  <span className="text-[10px] font-black uppercase tracking-tight">View Only Mode (Live)</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => pushToCloud()}
                    disabled={syncStatus === 'syncing'}
                    className={`flex-grow md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border-2 ${hasUnsavedChanges ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200 animate-pulse' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                  >
                    <svg className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    {hasUnsavedChanges ? 'PUSH CHANGES TO ALL' : 'SAVE TO CLOUD'}
                  </button>
                  <button 
                    onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
                    className="flex-grow md:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                    NEW TASK
                  </button>
                </div>
              )}
            </div>
          </div>

          {viewMode === 'list' ? (
            <TaskListView 
              tasks={tasks} 
              onUpdate={handleUpdateTask} 
              onDelete={handleDeleteTask} 
              onEdit={(t) => { setEditingTask(t); setIsModalOpen(true); }} 
              categories={categories} 
              onAddTask={(c) => { setPreselectedCategory(c); setIsModalOpen(true); }} 
              isAdmin={user.isAdmin}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
              {categories.map(category => (
                <div key={category} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col h-[550px]">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm"></span>
                      {category}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
                      {tasks.filter(t => t.category === category).length}
                    </span>
                  </div>
                  <div className="flex-grow overflow-y-auto custom-scrollbar space-y-3 pr-1">
                    {tasks.filter(t => t.category === category).map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        onUpdate={(u) => handleUpdateTask(task.id, u)} 
                        onDelete={() => handleDeleteTask(task.id)} 
                        onEdit={() => { setEditingTask(task); setIsModalOpen(true); }} 
                        isAdmin={user.isAdmin}
                      />
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
