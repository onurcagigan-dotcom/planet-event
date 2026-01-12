
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
 * HIGH-PRIORITY SHARED CLOUD BUCKET
 * Ensures all users are on the same global channel.
 */
const BUCKET_KEY = 'planet_global_sync_v9';
const API_URL = `https://kvdb.io/8x9L6XN9z7W6mGzXy9zQ2P/${BUCKET_KEY}`;

const STORAGE_KEYS = {
  USER_SESSION: 'planet_session_v9',
  LOCAL_BACKUP: 'planet_backup_v9'
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  
  const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'error' | 'success'>('connected');
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const isLockedRef = useRef(false);
  const currentVersionRef = useRef(0);

  // 1. Load Local State (First run or recovery)
  useEffect(() => {
    const session = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
    if (session) setUser(JSON.parse(session));

    const cache = localStorage.getItem(STORAGE_KEYS.LOCAL_BACKUP);
    if (cache) {
      const parsed = JSON.parse(cache);
      setTasks(parsed.tasks || INITIAL_TASKS);
      setCategories(parsed.categories || DEFAULT_CATEGORIES);
      setLogs(parsed.logs || []);
      currentVersionRef.current = parsed.version || 0;
    } else {
      setTasks(INITIAL_TASKS);
      setCategories(DEFAULT_CATEGORIES);
    }
    setIsReady(true);
  }, []);

  // 2. Global Pull (How Guests see changes)
  const syncFromCloud = useCallback(async (isSilent = false) => {
    // Don't pull if Admin is mid-edit to prevent overwriting local work
    if (isLockedRef.current || !navigator.onLine || (hasUnsavedChanges && user?.isAdmin)) return;

    if (!isSilent) setSyncStatus('syncing');

    try {
      const response = await fetch(`${API_URL}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });

      if (response.status === 404) {
        // Handle empty bucket: If admin, initialize it
        if (user?.isAdmin && tasks.length > 0) pushToCloud();
        setSyncStatus('connected');
        return;
      }

      if (!response.ok) throw new Error(`Server status: ${response.status}`);

      const remote: ProjectData = await response.json();

      // Only update local UI if cloud has a NEWER version
      if (remote.version > currentVersionRef.current) {
        setTasks(remote.tasks);
        setCategories(remote.categories);
        setLogs(remote.logs);
        currentVersionRef.current = remote.version;
        setLastSync(Date.now());
        setSyncStatus('success');
        localStorage.setItem(STORAGE_KEYS.LOCAL_BACKUP, JSON.stringify(remote));
        setTimeout(() => setSyncStatus('connected'), 1500);
      } else {
        setSyncStatus('connected');
      }
    } catch (err) {
      console.warn("Sync check failed:", err);
      setSyncStatus('error');
    }
  }, [user, hasUnsavedChanges, tasks.length]);

  // 3. Global Push (How Admin sends changes)
  const pushToCloud = async () => {
    if (!user?.isAdmin || isLockedRef.current) return;
    
    isLockedRef.current = true;
    setSyncStatus('syncing');

    const nextVersion = Date.now();
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

      if (!response.ok) throw new Error('Push failed');

      currentVersionRef.current = nextVersion;
      setLastSync(Date.now());
      setSyncStatus('success');
      setHasUnsavedChanges(false);
      localStorage.setItem(STORAGE_KEYS.LOCAL_BACKUP, JSON.stringify(payload));
      
      setTimeout(() => setSyncStatus('connected'), 2000);
    } catch (err) {
      setSyncStatus('error');
      alert("Failed to save to cloud. Please check your internet connection.");
    } finally {
      isLockedRef.current = false;
    }
  };

  // Background Loop (Refresh every 5s)
  useEffect(() => {
    if (!isReady || !user) return;
    syncFromCloud(true);
    const timer = setInterval(() => syncFromCloud(true), 5000);
    return () => clearInterval(timer);
  }, [isReady, user, syncFromCloud]);

  const applyLocalUpdates = (newTasks: Task[], newCats: string[], newLogs: ActivityLog[]) => {
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
      action: updates.status ? `set status: ${updates.status}` : "modified details",
      timestamp: Date.now()
    };
    applyLocalUpdates(nextTasks, categories, [log, ...logs]);
  };

  const handleDeleteTask = (id: string) => {
    if (!user?.isAdmin) return;
    const task = tasks.find(t => t.id === id);
    if (!task || !confirm(`Confirm deletion of "${task.title}"?`)) return;
    const nextTasks = tasks.filter(t => t.id !== id);
    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId: id,
      taskTitle: task.title,
      nickname: user.nickname,
      action: "deleted task",
      timestamp: Date.now()
    };
    applyLocalUpdates(nextTasks, categories, [log, ...logs]);
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
      action: isEditing ? "updated task entry" : "created new task",
      timestamp: Date.now()
    };
    
    applyLocalUpdates(nextTasks, nextCats, [log, ...logs]);
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

              {/* SHARED SYNC STATUS */}
              <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all min-w-[200px] ${syncStatus === 'error' ? 'bg-red-50 border-red-200 animate-shake' : 'bg-emerald-50/30 border-emerald-100'}`}>
                <div className={`w-2 h-2 rounded-full ${syncStatus === 'syncing' ? 'bg-amber-400 animate-pulse' : syncStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                <div className="flex flex-col">
                  <span className={`text-[10px] font-black uppercase leading-none ${syncStatus === 'error' ? 'text-red-700' : 'text-emerald-900'}`}>
                    {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Sync Interrupted' : 'Cloud Status: Live'}
                  </span>
                  <span className="text-[9px] text-slate-500 font-bold mt-1 uppercase">
                    Refreshed: {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                {syncStatus === 'error' && (
                  <button onClick={() => syncFromCloud()} className="ml-2 p-1 bg-red-100 rounded-md hover:bg-red-200 transition-colors">
                    <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {!user.isAdmin ? (
                <div className="bg-slate-100 text-slate-600 px-5 py-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-tight">Viewing Shared Live Feed</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => pushToCloud()}
                    disabled={syncStatus === 'syncing'}
                    className={`flex-grow md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border-2 ${hasUnsavedChanges ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                  >
                    <svg className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    {hasUnsavedChanges ? 'PUSH LIVE UPDATES' : 'SAVE TO CLOUD'}
                  </button>
                  <button 
                    onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
                    className="flex-grow md:flex-none px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2"
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

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
