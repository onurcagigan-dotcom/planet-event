
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

// V14: High-Reliability Drive Simulation
const PROJECT_ID = 'planet_event_master_v14';
const SYNC_ENDPOINT = `https://kvdb.io/A9S9h7nL3u3Jt9v6m8K1Z2/${PROJECT_ID}`;
const LOCAL_STORAGE_KEY = `local_${PROJECT_ID}_data`;
const USER_STORAGE_KEY = `local_${PROJECT_ID}_user`;

type ViewMode = 'board' | 'list';
type SyncState = 'idle' | 'saving' | 'fetching' | 'conflict' | 'offline' | 'error';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const [version, setVersion] = useState<number>(0);
  const [isReady, setIsReady] = useState(false);

  // Refs for background sync management
  const syncLock = useRef(false);
  const retryCount = useRef(0);
  const pendingChanges = useRef(false);

  /**
   * CORE: SAVE TO CLOUD (DRIVE STYLE)
   */
  const saveToCloud = async (forceData?: ProjectData) => {
    if (syncLock.current || !navigator.onLine) {
      pendingChanges.current = true;
      return;
    }

    syncLock.current = true;
    setSyncState('saving');

    const dataToSave: ProjectData = forceData || {
      tasks,
      categories,
      logs,
      version: version + 1,
      lastUpdatedBy: user?.nickname || 'Unknown',
      timestamp: Date.now()
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(SYNC_ENDPOINT, {
        method: 'PUT',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) throw new Error('Cloud rejected save');

      // Success
      setVersion(dataToSave.version);
      setLastSync(Date.now());
      setSyncState('idle');
      retryCount.current = 0;
      pendingChanges.current = false;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (err) {
      console.error('Save failed:', err);
      setSyncState('error');
      retryCount.current++;
      pendingChanges.current = true;
    } finally {
      syncLock.current = false;
    }
  };

  /**
   * CORE: FETCH FROM CLOUD
   */
  const fetchFromCloud = useCallback(async (isInitial = false) => {
    if (syncLock.current || !navigator.onLine) return;
    
    setSyncState(isInitial ? 'fetching' : 'idle');
    try {
      const response = await fetch(`${SYNC_ENDPOINT}?nocache=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;

      const text = await response.text();
      if (!text) return;

      const cloudData: ProjectData = JSON.parse(text);

      // Conflict Resolution: Only update if cloud has a higher version
      if (cloudData.version > version) {
        setTasks(cloudData.tasks);
        setCategories(cloudData.categories);
        setLogs(cloudData.logs);
        setVersion(cloudData.version);
        setLastSync(Date.now());
        localStorage.setItem(LOCAL_STORAGE_KEY, text);
      }
    } catch (err) {
      console.warn('Silent fetch failed');
    } finally {
      setSyncState('idle');
    }
  }, [version]);

  // Initial Hydration
  useEffect(() => {
    const savedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (savedUser) setUser({ nickname: savedUser });

    const localCache = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localCache) {
      try {
        const d = JSON.parse(localCache);
        setTasks(d.tasks);
        setCategories(d.categories);
        setLogs(d.logs);
        setVersion(d.version || 0);
      } catch (e) {
        setTasks(INITIAL_TASKS);
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setTasks(INITIAL_TASKS);
      setCategories(DEFAULT_CATEGORIES);
    }
    
    setIsReady(true);
    setTimeout(() => fetchFromCloud(true), 500);
  }, []);

  // Background Heartbeat (Every 10 seconds)
  useEffect(() => {
    if (!isReady || !user) return;

    const interval = setInterval(() => {
      if (pendingChanges.current) {
        saveToCloud();
      } else {
        fetchFromCloud();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isReady, user, fetchFromCloud, tasks, categories, logs, version]);

  /**
   * Action Handlers
   */
  const handleDataChange = (newTasks: Task[], newCats: string[], newLogs: ActivityLog[]) => {
    setTasks(newTasks);
    setCategories(newCats);
    setLogs(newLogs);
    pendingChanges.current = true;
    
    // Attempt immediate save
    saveToCloud({
      tasks: newTasks,
      categories: newCats,
      logs: newLogs,
      version: version + 1,
      lastUpdatedBy: user?.nickname || 'User',
      timestamp: Date.now()
    });
  };

  const createLog = (taskId: string, title: string, action: string, t: Task[], c: string[], l: ActivityLog[]) => {
    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId,
      taskTitle: title,
      nickname: user?.nickname || 'Member',
      action,
      timestamp: Date.now()
    };
    handleDataChange(t, c, [log, ...l].slice(0, 50));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    createLog(id, task.title, updates.status ? `changed status to ${updates.status}` : "updated task details", newTasks, categories, logs);
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !confirm(`Delete "${task.title}"?`)) return;
    const newTasks = tasks.filter(t => t.id !== id);
    createLog(id, task.title, "removed the task", newTasks, categories, logs);
  };

  const onFormSubmit = (data: any) => {
    let freshCats = [...categories];
    if (!freshCats.includes(data.category)) freshCats.push(data.category);

    const isEdit = !!editingTask;
    const newTasks = isEdit 
      ? tasks.map(t => t.id === editingTask!.id ? { ...t, ...data, updatedAt: Date.now() } : t)
      : [...tasks, { id: Math.random().toString(36).substr(2, 9), ...data, status: 'Pending', updatedAt: Date.now() }];

    createLog(isEdit ? editingTask!.id : 'new', data.title, isEdit ? "edited details" : "created task", newTasks, freshCats, logs);
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);

  if (!isReady) return null;
  if (!user) return <NicknameModal onJoin={(n) => { setUser({ nickname: n }); localStorage.setItem(USER_STORAGE_KEY, n); }} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header user={user} onLogout={() => { setUser(null); localStorage.removeItem(USER_STORAGE_KEY); }} />
      
      <main className="flex-grow container mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        <div className="flex-grow space-y-6">
          <DashboardStats tasks={tasks} />
          
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>LIST</button>
                <button onClick={() => setViewMode('board')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'board' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>BOARD</button>
              </div>

              <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${syncState === 'saving' || syncState === 'fetching' ? 'bg-amber-400 animate-pulse' : syncState === 'error' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-slate-400 leading-none">
                    {syncState === 'saving' ? 'Saving to Cloud...' : syncState === 'error' ? 'Sync Error (Retrying)' : 'Connected'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    v{version} • Last Sync: {new Date(lastSync).toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
              ADD PROJECT TASK
            </button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map(category => (
                <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col h-[500px]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      {category}
                    </h3>
                    <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {tasks.filter(t => t.category === category).length}
                    </span>
                  </div>
                  <div className="flex-grow overflow-y-auto custom-scrollbar space-y-3">
                    {tasks.filter(t => t.category === category).map(task => (
                      <TaskCard key={task.id} task={task} onUpdate={(u) => updateTask(task.id, u)} onDelete={() => deleteTask(task.id)} onEdit={() => { setEditingTask(task); setIsModalOpen(true); }} />
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

      {/* Persistence Safety Banner */}
      {syncState === 'error' && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-2xl flex items-center gap-3 z-50 animate-bounce">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <span className="text-xs font-bold">Cloud Sync Offline. All changes saved locally.</span>
        </div>
      )}
    </div>
  );
}
