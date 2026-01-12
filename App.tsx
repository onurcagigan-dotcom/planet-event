
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

const STORAGE_KEY_TASKS = 'etkinlik_takip_tasks';
const STORAGE_KEY_LOGS = 'etkinlik_takip_logs';
const STORAGE_KEY_USER = 'etkinlik_takip_user';
const STORAGE_KEY_CATEGORIES = 'etkinlik_takip_categories';
const STORAGE_KEY_LAST_UPDATE = 'etkinlik_takip_last_update';

// Paylaşılan proje anahtarı (Gerçek bir uygulamada bu dinamik olabilir)
const SYNC_URL = 'https://kvdb.io/A9S9h7nL3u3Jt9v6m8K1Z2/planet_event_state';

type ViewMode = 'board' | 'list';
type SyncStatus = 'synced' | 'syncing' | 'error';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);

  // Bulut verisini çekme
  const pullFromCloud = useCallback(async () => {
    try {
      const response = await fetch(SYNC_URL);
      if (response.ok) {
        const cloudData = await response.json();
        // Eğer buluttaki veri yerelden daha yeniyse güncelle
        if (cloudData.lastUpdate > lastUpdate) {
          setTasks(cloudData.tasks);
          setCategories(cloudData.categories);
          setLogs(cloudData.logs);
          setLastUpdate(cloudData.lastUpdate);
          
          localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(cloudData.tasks));
          localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(cloudData.categories));
          localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(cloudData.logs));
          localStorage.setItem(STORAGE_KEY_LAST_UPDATE, cloudData.lastUpdate.toString());
          setSyncStatus('synced');
        }
      }
    } catch (error) {
      console.error('Sync Error:', error);
      setSyncStatus('error');
    }
  }, [lastUpdate]);

  // Buluta veri gönderme
  const pushToCloud = async (newTasks: Task[], newCategories: string[], newLogs: ActivityLog[]) => {
    setSyncStatus('syncing');
    const timestamp = Date.now();
    const dataToSync = {
      tasks: newTasks,
      categories: newCategories,
      logs: newLogs,
      lastUpdate: timestamp
    };

    try {
      await fetch(SYNC_URL, {
        method: 'POST',
        body: JSON.stringify(dataToSync)
      });
      setLastUpdate(timestamp);
      localStorage.setItem(STORAGE_KEY_LAST_UPDATE, timestamp.toString());
      setSyncStatus('synced');
    } catch (error) {
      console.error('Push Error:', error);
      setSyncStatus('error');
    }
  };

  // İlk yükleme
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUser) setUser({ nickname: savedUser });

    const savedTasks = localStorage.getItem(STORAGE_KEY_TASKS);
    const savedLogs = localStorage.getItem(STORAGE_KEY_LOGS);
    const savedCategories = localStorage.getItem(STORAGE_KEY_CATEGORIES);
    const savedLastUpdate = localStorage.getItem(STORAGE_KEY_LAST_UPDATE);

    if (savedTasks) setTasks(JSON.parse(savedTasks));
    else setTasks(INITIAL_TASKS);

    if (savedCategories) setCategories(JSON.parse(savedCategories));
    else setCategories(DEFAULT_CATEGORIES);

    if (savedLogs) setLogs(JSON.parse(savedLogs));
    if (savedLastUpdate) setLastUpdate(parseInt(savedLastUpdate));

    setIsInitializing(false);
    
    // İlk girişte buluttan en güncel veriyi çek
    pullFromCloud();
  }, []);

  // Periyodik senkronizasyon (Polling - 5 saniyede bir)
  useEffect(() => {
    if (isInitializing) return;
    const interval = setInterval(pullFromCloud, 5000);
    return () => clearInterval(interval);
  }, [pullFromCloud, isInitializing]);

  const saveStateAndSync = (newTasks: Task[], newCategories: string[], newLogs: ActivityLog[]) => {
    setTasks(newTasks);
    setCategories(newCategories);
    setLogs(newLogs);
    
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(newTasks));
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(newCategories));
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(newLogs));
    
    pushToCloud(newTasks, newCategories, newLogs);
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
    saveStateAndSync(currentTasks, currentCategories, updatedLogs);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    let actionMsg = "updated";
    if (updates.status && updates.status !== task.status) actionMsg = `changed status to "${updates.status}"`;
    else if (updates.title && updates.title !== task.title) actionMsg = `renamed to "${updates.title}"`;
    else if (updates.assignee !== undefined && updates.assignee !== task.assignee) actionMsg = `assigned responsible to "${updates.assignee || 'Unassigned'}"`;

    const newTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    addLog(id, task.title, actionMsg, newTasks, categories, logs);
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (!confirm(`Are you sure you want to delete "${task.title}"?`)) return;

    const newTasks = tasks.filter(t => t.id !== id);
    addLog(id, task.title, "deleted the task", newTasks, categories, logs);
  };

  const handleFormSubmit = (data: { title: string, category: string, deadline: string | null, notes: string, assignee: string | null }) => {
    let currentCategories = [...categories];
    if (!currentCategories.includes(data.category)) {
      currentCategories = [...currentCategories, data.category];
    }

    if (editingTask) {
      const newTasks = tasks.map(t => t.id === editingTask.id ? { ...t, ...data, updatedAt: Date.now() } : t);
      addLog(editingTask.id, data.title, "updated task details", newTasks, currentCategories, logs);
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
      addLog(newTask.id, newTask.title, "added a new task", newTasks, currentCategories, logs);
    }
    setIsModalOpen(false);
    setEditingTask(undefined);
    setPreselectedCategory(undefined);
  };

  const editCategory = (oldName: string) => {
    const newName = prompt(`Enter new name for category "${oldName}":`, oldName);
    if (!newName || newName.trim() === oldName) return;
    
    const formattedName = newName.trim().toUpperCase();
    if (categories.includes(formattedName)) return alert("Exists.");

    const newCats = categories.map(c => c === oldName ? formattedName : c);
    const newTasks = tasks.map(t => t.category === oldName ? { ...t, category: formattedName } : t);
    addLog('system', oldName, `renamed category to "${formattedName}"`, newTasks, newCats, logs);
  };

  const deleteCategory = (catName: string) => {
    if (!confirm(`Delete category "${catName}" and all its tasks?`)) return;
    const newCats = categories.filter(c => c !== catName);
    const newTasks = tasks.filter(t => t.category !== catName);
    addLog('system', catName, "deleted the category", newTasks, newCats, logs);
  };

  const exportToCSV = () => {
    const headers = ["Category", "Task", "Status", "Deadline", "Responsible", "Notes"];
    const csvRows = [headers.join(","), ...tasks.map(t => [`"${t.category}"`,`"${t.title}"`,`"${t.status}"`,`"${t.deadline || ''}"`,`"${t.assignee || ''}"`,`"${(t.notes || '').replace(/\n/g, ' ')}"`].join(","))];
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Event_Tasks_${new Date().toISOString().split('T')[0]}.csv`;
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
              <div className="flex items-center gap-2" title={syncStatus === 'synced' ? 'All changes saved to cloud' : syncStatus === 'syncing' ? 'Syncing...' : 'Connection error'}>
                <div className={`w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-green-500' : syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{syncStatus}</span>
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
                      <div className="hidden group-hover/cat:flex items-center gap-1 ml-2">
                        <button onClick={() => editCategory(category)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth="2"/></svg></button>
                        <button onClick={() => deleteCategory(category)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2"/></svg></button>
                      </div>
                    </div>
                    <button onClick={() => { setPreselectedCategory(category); setIsModalOpen(true); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-indigo-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2"/></svg></button>
                  </div>
                  <div className="flex-grow overflow-y-auto custom-scrollbar space-y-4">
                    {tasks.filter(t => t.category === category).map(task => (
                      <TaskCard key={task.id} task={task} onUpdate={(u) => updateTask(task.id, u)} onDelete={() => deleteTask(task.id)} onEdit={() => { setEditingTask(task); setIsModalOpen(true); }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TaskListView tasks={tasks} onUpdate={updateTask} onDelete={deleteTask} onEdit={(t) => { setEditingTask(t); setIsModalOpen(true); }} categories={categories} onAddTask={(c) => { setPreselectedCategory(c); setIsModalOpen(true); }} onEditCategory={editCategory} onDeleteCategory={deleteCategory} />
          )}
        </div>
        <aside className="lg:w-80 shrink-0">
          <ActivitySidebar logs={logs} />
        </aside>
      </main>

      {isModalOpen && <TaskFormModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTask(undefined); }} onSubmit={handleFormSubmit} categories={categories} initialData={editingTask} preselectedCategory={preselectedCategory} currentUserNickname={user.nickname} />}
    </div>
  );
}
