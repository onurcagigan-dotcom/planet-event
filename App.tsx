
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

// KVDB için zorunlu UUID v4 formatı üreticisi
const generateValidUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const DEFAULT_BUCKET = 'b7d3a2e1-c5f4-4e9a-8d6b-0f1e2d3c4b5a';
const PROJECT_KEY = 'planet_opening_event';

const STORAGE_KEYS = {
  USER: 'planet_user_session',
  LOCAL_CACHE: 'planet_data_cache'
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
  const [workspaceId, setWorkspaceId] = useState<string>('');

  const syncLock = useRef(false);
  const currentVersion = useRef(0);
  const hasPendingChanges = useRef(false);

  // 1. Çalışma Alanı (Workspace) Belirleme
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let wsId = params.get('ws');
    
    if (!wsId) {
      // URL'de yoksa yerel hafızadan bak, o da yoksa varsayılanı kullan
      wsId = localStorage.getItem('planet_active_ws') || DEFAULT_BUCKET;
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?ws=${wsId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
    
    setWorkspaceId(wsId);
    localStorage.setItem('planet_active_ws', wsId);

    // Kullanıcı kontrolü
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    if (savedUser) setUser({ nickname: savedUser });

    // Önbellekten verileri yükle
    const cache = localStorage.getItem(`${STORAGE_KEYS.LOCAL_CACHE}_${wsId}`);
    if (cache) {
      const parsed = JSON.parse(cache);
      setTasks(parsed.tasks);
      setCategories(parsed.categories);
      setLogs(parsed.logs);
      currentVersion.current = parsed.version || 0;
    } else {
      setTasks(INITIAL_TASKS);
      setCategories(DEFAULT_CATEGORIES);
    }
    
    setIsReady(true);
  }, []);

  const getApiUrl = () => `https://kvdb.io/${workspaceId}/${PROJECT_KEY}`;

  // 2. Veri Gönderme (Push)
  const pushData = async (forcedData?: any) => {
    if (syncLock.current || !navigator.onLine) return;
    
    syncLock.current = true;
    setSyncStatus('syncing');

    const nextVersion = currentVersion.current + 1;
    const payload: ProjectData = {
      tasks: forcedData?.tasks || tasks,
      categories: forcedData?.categories || categories,
      logs: (forcedData?.logs || logs).slice(0, 50),
      version: nextVersion,
      lastUpdatedBy: user?.nickname || 'Anonim',
      timestamp: Date.now()
    };

    try {
      const response = await fetch(getApiUrl(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(await response.text());

      currentVersion.current = nextVersion;
      setLastSync(Date.now());
      setSyncStatus('online');
      hasPendingChanges.current = false;
      localStorage.setItem(`${STORAGE_KEYS.LOCAL_CACHE}_${workspaceId}`, JSON.stringify(payload));
    } catch (error) {
      console.error('Push failed:', error);
      setSyncStatus('error');
    } finally {
      syncLock.current = false;
    }
  };

  // 3. Veri Çekme (Pull)
  const pullData = useCallback(async (silent = false) => {
    if (syncLock.current || !navigator.onLine || hasPendingChanges.current) return;

    if (!silent) setSyncStatus('syncing');

    try {
      const response = await fetch(`${getApiUrl()}?nocache=${Date.now()}`);
      
      if (response.status === 404) {
        // Eğer bu workspace yeni ise, ilk push'u yap
        if (!silent) await pushData();
        return;
      }

      if (!response.ok) throw new Error('Pull failed');

      const remoteData: ProjectData = await response.json();

      if (remoteData.version > currentVersion.current) {
        setTasks(remoteData.tasks);
        setCategories(remoteData.categories);
        setLogs(remoteData.logs);
        currentVersion.current = remoteData.version;
        setLastSync(Date.now());
        localStorage.setItem(`${STORAGE_KEYS.LOCAL_CACHE}_${workspaceId}`, JSON.stringify(remoteData));
      }
      setSyncStatus('online');
    } catch (error) {
      if (!silent) setSyncStatus('error');
    }
  }, [workspaceId, user, tasks, categories, logs]);

  // Döngüsel senkronizasyon
  useEffect(() => {
    if (!isReady || !user) return;
    
    const interval = setInterval(() => {
      if (hasPendingChanges.current) {
        pushData();
      } else {
        pullData(true);
      }
    }, 10000); // 10 saniyede bir

    return () => clearInterval(interval);
  }, [isReady, user, pullData]);

  // Workspace Değiştirme / Onarma
  const repairWorkspace = () => {
    const newWs = generateValidUUID();
    window.location.href = window.location.origin + window.location.pathname + `?ws=${newWs}`;
  };

  const handleApplyChange = (newTasks: Task[], newCats: string[], newLogs: ActivityLog[]) => {
    setTasks(newTasks);
    setCategories(newCats);
    setLogs(newLogs);
    hasPendingChanges.current = true;
    pushData({ tasks: newTasks, categories: newCats, logs: newLogs });
  };

  const onUpdateTask = (id: string, updates: Partial<Task>) => {
    const nextTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    const task = tasks.find(t => t.id === id);
    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId: id,
      taskTitle: task?.title || 'Bilinmiyor',
      nickname: user?.nickname || 'User',
      action: updates.status ? `durumunu ${updates.status} yaptı` : "güncelledi",
      timestamp: Date.now()
    };
    handleApplyChange(nextTasks, categories, [log, ...logs]);
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
      action: "sildi",
      timestamp: Date.now()
    };
    handleApplyChange(nextTasks, categories, [log, ...logs]);
  };

  const onFormSubmit = (data: any) => {
    let nextCats = [...categories];
    if (!nextCats.includes(data.category)) nextCats.push(data.category);

    const isEdit = !!editingTask;
    const nextTasks = isEdit 
      ? tasks.map(t => t.id === editingTask!.id ? { ...t, ...data, updatedAt: Date.now() } : t)
      : [...tasks, { id: Math.random().toString(36).substr(2, 9), ...data, status: 'Pending', updatedAt: Date.now() }];

    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId: isEdit ? editingTask!.id : 'new',
      taskTitle: data.title,
      nickname: user?.nickname || 'User',
      action: isEdit ? "düzenledi" : "yeni ekledi",
      timestamp: Date.now()
    };
    
    handleApplyChange(nextTasks, nextCats, [log, ...logs]);
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Davet linki kopyalandı! Ekip arkadaşlarınız bu linkle aynı listeye erişebilir.");
  };

  if (!isReady) return null;
  if (!user) return <NicknameModal onJoin={(n) => { setUser({ nickname: n }); localStorage.setItem(STORAGE_KEYS.USER, n); }} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header user={user} onLogout={() => { setUser(null); localStorage.removeItem(STORAGE_KEYS.USER); }} />
      
      <main className="flex-grow container mx-auto px-4 py-6 lg:py-8 flex flex-col lg:flex-row gap-8">
        <div className="flex-grow space-y-6">
          <DashboardStats tasks={tasks} />
          
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setViewMode('list')} className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>LİSTE</button>
                <button onClick={() => setViewMode('board')} className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${viewMode === 'board' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>PANEL</button>
              </div>

              <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'syncing' ? 'bg-amber-400 animate-pulse' : syncStatus === 'error' ? 'bg-red-500' : 'bg-green-500 shadow-sm'}`}></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-indigo-900 leading-none">
                    {syncStatus === 'syncing' ? 'Eşitleniyor...' : syncStatus === 'error' ? 'Hata Oluştu' : 'Aktif'}
                  </span>
                  <span className="text-[9px] text-indigo-500 font-bold mt-1">
                    {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={copyInviteLink}
                className="p-2.5 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl border border-indigo-100 transition-all active:scale-95 flex items-center gap-2 text-[10px] font-black uppercase"
                title="Ekip Arkadaşını Davet Et"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                EKİBİ DAVET ET
              </button>

              <button 
                onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
                className="flex-grow md:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                YENİ GÖREV
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

      {syncStatus === 'error' && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 bg-slate-900 text-white p-6 rounded-2xl shadow-2xl z-50 border border-slate-700 animate-in slide-in-from-bottom-8">
          <h4 className="text-xs font-black uppercase text-red-500 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            SİSTEM BAĞLANTISI KESİLDİ
          </h4>
          <p className="text-[11px] text-slate-400 mb-4 leading-relaxed font-medium">
            Sunucu ID formatını reddetti veya ağ erişimi engellendi. Mevcut ID'yi onarabilir veya yeni bir temiz çalışma alanı oluşturabilirsiniz.
          </p>
          <div className="flex gap-2">
            <button onClick={() => pullData()} className="bg-white/10 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-white/20 transition-all flex-grow">Yenile</button>
            <button onClick={repairWorkspace} className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-500 transition-all shadow-lg">Kendini Onar</button>
          </div>
        </div>
      )}
    </div>
  );
}
