
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

// Permanent valid UUID for consistent cloud sync
const CLOUD_BUCKET_ID = '3a2e1c5f-4e9a-8d6b-0f1e-2d3c4b5a6d7e';
const PROJECT_NAMESPACE = 'planet_opening_v3';

const STORAGE_KEYS = {
  USER_SESSION: 'planet_auth_v3',
  LOCAL_BACKUP: 'planet_cache_v3'
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [syncStatus, setSyncStatus] = useState<'online' | 'syncing' | 'offline' | 'error'>('online');
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const [isReady, setIsReady] = useState(false);

  const isSyncing = useRef(false);
  const dataVersion = useRef(0);
  const unsavedChanges = useRef(false);

  const getApiUrl = () => `https://kvdb.io/${CLOUD_BUCKET_ID}/${PROJECT_NAMESPACE}`;

  // 1. Initial Setup
  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
    if (savedSession) {
      setUser(JSON.parse(savedSession));
    }

    const localData = localStorage.getItem(STORAGE_KEYS.LOCAL_BACKUP);
    if (localData) {
      const parsed = JSON.parse(localData);
      setTasks(parsed.tasks || INITIAL_TASKS);
      setCategories(parsed.categories || DEFAULT_CATEGORIES);
      setLogs(parsed.logs || []);
      dataVersion.current = parsed.version || 0;
    } else {
      setTasks(INITIAL_TASKS);
      setCategories(DEFAULT_CATEGORIES);
    }
    
    setIsReady(true);
  }, []);

  // 2. Cloud Save (ADMIN ONLY)
  const saveToCloud = async (currentData?: Partial<ProjectData>) => {
    if (isSyncing.current || !navigator.onLine || !user?.isAdmin) return;
    
    isSyncing.current = true;
    setSyncStatus('syncing');

    const nextVersion = dataVersion.current + 1;
    const payload: ProjectData = {
      tasks: currentData?.tasks || tasks,
      categories: currentData?.categories || categories,
      logs: (currentData?.logs || logs).slice(0, 50),
      version: nextVersion,
      lastUpdatedBy: user.nickname,
      timestamp: Date.now()
    };

    try {
      const response = await fetch(getApiUrl(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Sync Format Error');

      dataVersion.current = nextVersion;
      setLastSync(Date.now());
      setSyncStatus('online');
      unsavedChanges.current = false;
      localStorage.setItem(STORAGE_KEYS.LOCAL_BACKUP, JSON.stringify(payload));
    } catch (error) {
      console.error('Save Error:', error);
      setSyncStatus('error');
    } finally {
      isSyncing.current = false;
    }
  };

  // 3. Cloud Load (Everyone can pull)
  const loadFromCloud = useCallback(async (isSilent = false) => {
    if (isSyncing.current || !navigator.onLine || unsavedChanges.current) return;
    if (!isSilent) setSyncStatus('syncing');

    try {
      const response = await fetch(`${getApiUrl()}?t=${Date.now()}`);
      
      if (response.status === 404) {
        if (!isSilent && user?.isAdmin) await saveToCloud();
        return;
      }

      if (!response.ok) throw new Error('Fetch Error');

      const cloudData: ProjectData = await response.json();
      
      if (cloudData.version > dataVersion.current) {
        setTasks(cloudData.tasks);
        setCategories(cloudData.categories);
        setLogs(cloudData.logs);
        dataVersion.current = cloudData.version;
        setLastSync(Date.now());
        localStorage.setItem(STORAGE_KEYS.LOCAL_BACKUP, JSON.stringify(cloudData));
      }
      setSyncStatus('online');
    } catch (error) {
      if (!isSilent) setSyncStatus('error');
    }
  }, [user, tasks, categories, logs]);

  // Periodic Sync
  useEffect(() => {
    if (!isReady || !user) return;
    
    loadFromCloud(true);

    const syncInterval = setInterval(() => {
      if (unsavedChanges.current && user.isAdmin) {
        saveToCloud();
      } else {
        loadFromCloud(true);
      }
    }, 15000);

    return () => clearInterval(syncInterval);
  }, [isReady, user, loadFromCloud]);

  const applyChanges = (newTasks: Task[], newCats: string[], newLogs: ActivityLog[]) => {
    if (!user?.isAdmin) return; // Fail-safe
    setTasks(newTasks);
    setCategories(newCats);
    setLogs(newLogs);
    unsavedChanges.current = true;
    saveToCloud({ tasks: newTasks, categories: newCats, logs: newLogs });
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
      action: updates.status ? `changed status to ${updates.status}` : "updated task",
      timestamp: Date.now()
    };
    applyChanges(nextTasks, categories, [log, ...logs]);
  };

  const handleDeleteTask = (id: string) => {
    if (!user?.isAdmin) return;
    const task = tasks.find(t => t.id === id);
    if (!task || !confirm(`Delete "${task.title}"?`)) return;
    const nextTasks = tasks.filter(t => t.id !== id);
    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId: id,
      taskTitle: task.title,
      nickname: user.nickname,
      action: "removed this task",
      timestamp: Date.now()
    };
    applyChanges(nextTasks, categories, [log, ...logs]);
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
      action: isEditing ? "edited task" : "added new task",
      timestamp: Date.now()
    };
    
    applyChanges(nextTasks, nextCats, [log, ...logs]);
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);

  if (!isReady) return null;
  
  if (!user) {
    return (
      <NicknameModal 
        onJoin={(nickname, isAdmin) => { 
          const userData = { nickname, isAdmin };
          setUser(userData); 
          localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(userData)); 
        }} 
      />
    );
  }

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

              <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'syncing' ? 'bg-amber-400 animate-pulse' : syncStatus === 'error' ? 'bg-red-500' : 'bg-green-500 shadow-sm'}`}></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-indigo-900 leading-none">
                    {syncStatus === 'syncing' ? 'SYNCING...' : syncStatus === 'error' ? 'OFFLINE' : 'SECURE CONNECTED'}
                  </span>
                  <span className="text-[9px] text-indigo-500 font-bold mt-1 uppercase">
                    Last: {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {!user.isAdmin && (
                <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl border border-amber-100 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <span className="text-[10px] font-black uppercase tracking-tight">View Only Mode</span>
                </div>
              )}
              {user.isAdmin && (
                <button 
                  onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
                  className="flex-grow md:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                  NEW TASK
                </button>
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
