
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

// Secondary backup sync
const CLOUD_BUCKET_ID = 'planet-backup-' + Math.random().toString(36).substr(2, 5);
const PROJECT_NAMESPACE = 'event_v6';

const STORAGE_KEYS = {
  USER_SESSION: 'planet_auth_v6',
  LOCAL_DB: 'planet_db_v6'
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [syncStatus, setSyncStatus] = useState<'local' | 'saving' | 'error' | 'success'>('local');
  const [lastSaved, setLastSaved] = useState<number>(Date.now());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // File Input Ref for Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
    if (savedSession) setUser(JSON.parse(savedSession));

    const localData = localStorage.getItem(STORAGE_KEYS.LOCAL_DB);
    if (localData) {
      const parsed = JSON.parse(localData);
      setTasks(parsed.tasks || INITIAL_TASKS);
      setCategories(parsed.categories || DEFAULT_CATEGORIES);
      setLogs(parsed.logs || []);
    } else {
      setTasks(INITIAL_TASKS);
      setCategories(DEFAULT_CATEGORIES);
    }
    setIsReady(true);
  }, []);

  // 2. Save Logic (Primary: LocalStorage, Secondary: Optional Cloud)
  const performSave = async () => {
    if (!user?.isAdmin) return;
    
    setSyncStatus('saving');
    
    const payload: ProjectData = {
      tasks,
      categories,
      logs: logs.slice(0, 50),
      version: Date.now(),
      lastUpdatedBy: user.nickname,
      timestamp: Date.now()
    };

    try {
      // Save to Browser
      localStorage.setItem(STORAGE_KEYS.LOCAL_DB, JSON.stringify(payload));
      
      // Optional Cloud Sync (Fire and Forget)
      fetch(`https://kvdb.io/${CLOUD_BUCKET_ID}/${PROJECT_NAMESPACE}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => console.log("Cloud backup skipped - Network restricted"));

      setLastSaved(Date.now());
      setSyncStatus('success');
      setHasUnsavedChanges(false);
      
      setTimeout(() => setSyncStatus('local'), 2000);
    } catch (error) {
      setSyncStatus('error');
    }
  };

  // 3. Export to File (JSON)
  const exportToFile = () => {
    const data = { tasks, categories, logs, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `planet_event_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 4. Import from File (JSON)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.tasks && json.categories) {
          setTasks(json.tasks);
          setCategories(json.categories);
          setLogs(json.logs || []);
          setHasUnsavedChanges(true);
          alert("Data imported successfully. Click SAVE to finalize.");
        }
      } catch (err) {
        alert("Invalid file format.");
      }
    };
    reader.readAsText(file);
  };

  const applyChanges = (newTasks: Task[], newCats: string[], newLogs: ActivityLog[]) => {
    if (!user?.isAdmin) return;
    setTasks(newTasks);
    setCategories(newCats);
    setLogs(newLogs);
    setHasUnsavedChanges(true);
    // Auto-save to localstorage for safety
    localStorage.setItem(STORAGE_KEYS.LOCAL_DB, JSON.stringify({ tasks: newTasks, categories: newCats, logs: newLogs }));
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
      action: updates.status ? `set status to ${updates.status}` : "updated task",
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
      action: "deleted task",
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
      action: isEditing ? "modified task" : "created task",
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

              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 min-w-[180px]">
                <div className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'saving' ? 'bg-amber-400 animate-pulse' : syncStatus === 'success' ? 'bg-emerald-500' : 'bg-indigo-500 shadow-sm'}`}></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-slate-700 leading-none">
                    {syncStatus === 'saving' ? 'SECURING...' : syncStatus === 'success' ? 'DATA SAVED' : 'LOCAL DATABASE'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold mt-1 uppercase">
                    Last: {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {!user.isAdmin ? (
                <div className="bg-amber-50 text-amber-700 px-4 py-2.5 rounded-xl border border-amber-100 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <span className="text-[10px] font-black uppercase tracking-tight">View Only Mode</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                    <button onClick={exportToFile} className="px-3 py-1.5 hover:bg-white rounded-lg transition-all" title="Download JSON Backup">
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 hover:bg-white rounded-lg transition-all" title="Upload JSON Backup">
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
                  </div>
                  
                  <button 
                    onClick={performSave}
                    className={`flex-grow md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border-2 ${hasUnsavedChanges ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                    {syncStatus === 'saving' ? 'SAVING...' : 'SAVE CHANGES'}
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
