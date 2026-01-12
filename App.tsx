
import React, { useState, useEffect, useCallback } from 'react';
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
 * GÜVENLİ VE BASİT BULUT DEPOSU
 * KVDB üzerinde özel bir namespace kullanıyoruz.
 */
const CLOUD_ID = 'planet_v10_prod'; 
const API_URL = `https://kvdb.io/8x9L6XN9z7W6mGzXy9zQ2P/${CLOUD_ID}`;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  
  // Basitleştirilmiş Durumlar
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>('Bağlanıyor...');
  const [hasChanges, setHasChanges] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  // 1. VERİ ÇEKME (PULL)
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsSyncing(true);
    
    try {
      const res = await fetch(`${API_URL}?t=${Date.now()}`, { cache: 'no-cache' });
      
      if (res.ok) {
        const data: ProjectData = await res.json();
        // Sadece admin değilse veya adminin kaydedilmemiş değişikliği yoksa güncelle
        if (!user?.isAdmin || !hasChanges) {
          setTasks(data.tasks || INITIAL_TASKS);
          setCategories(data.categories || DEFAULT_CATEGORIES);
          setLogs(data.logs || []);
        }
        setLastSync(new Date().toLocaleTimeString());
      } else if (res.status === 404 && user?.isAdmin) {
        // İlk kurulum: Veri yoksa admin veriyi buluta gönderir
        saveToCloud(INITIAL_TASKS, DEFAULT_CATEGORIES, []);
      }
    } catch (err) {
      console.warn("Veri okuma başarısız, tekrar denenecek...");
    } finally {
      setIsSyncing(false);
    }
  }, [user, hasChanges]);

  // 2. VERİ GÖNDERME (PUSH)
  const saveToCloud = async (currentTasks = tasks, currentCats = categories, currentLogs = logs) => {
    if (!user?.isAdmin) return;
    
    setIsSyncing(true);
    const payload: ProjectData = {
      tasks: currentTasks,
      categories: currentCats,
      logs: currentLogs.slice(0, 30), // Boyutu küçük tutmak için logları sınırlıyoruz
      version: Date.now(),
      lastUpdatedBy: user.nickname,
      timestamp: Date.now()
    };

    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setHasChanges(false);
        setLastSync(new Date().toLocaleTimeString());
        setTasks(currentTasks);
        setCategories(currentCats);
        setLogs(currentLogs);
      } else {
        throw new Error("Kayıt hatası");
      }
    } catch (err) {
      alert("Bulut sunucusuna bağlanılamadı. Lütfen internetinizi kontrol edin.");
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. DÖNGÜ VE BAŞLANGIÇ
  useEffect(() => {
    const session = localStorage.getItem('planet_user');
    if (session) setUser(JSON.parse(session));
  }, []);

  useEffect(() => {
    if (!user) return;
    
    fetchData(); // İlk açılışta çek
    
    // Misafirler için 10 saniyede bir güncelleme kontrolü
    // Admin için sadece veri okuma (kendi değişikliği yoksa)
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [user, fetchData]);

  // 4. AKSİYONLAR (SADECE YERELDE GÜNCELLE)
  const handleLocalUpdate = (updatedTasks: Task[], logAction: string, taskTitle: string) => {
    if (!user?.isAdmin) return;
    
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId: '—',
      taskTitle: taskTitle,
      nickname: user.nickname,
      action: logAction,
      timestamp: Date.now()
    };

    const newLogs = [newLog, ...logs];
    setTasks(updatedTasks);
    setLogs(newLogs);
    setHasChanges(true); // Admin "Kaydet" butonuna basana kadar sadece yerelde kalır
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const nextTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    handleLocalUpdate(nextTasks, updates.status ? `durumu ${updates.status} yaptı` : "güncelledi", task.title);
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
    const nextTasks = tasks.filter(t => t.id !== id);
    handleLocalUpdate(nextTasks, "görevi sildi", task.title);
  };

  const handleFormSubmit = (data: any) => {
    let nextCats = [...categories];
    if (!nextCats.includes(data.category)) nextCats.push(data.category);

    let nextTasks;
    let action;
    if (editingTask) {
      nextTasks = tasks.map(t => t.id === editingTask.id ? { ...t, ...data, updatedAt: Date.now() } : t);
      action = "bilgilerini güncelledi";
    } else {
      const newTask = { id: Math.random().toString(36).substr(2, 9), ...data, status: 'Pending', updatedAt: Date.now() };
      nextTasks = [...tasks, newTask];
      action = "yeni görev oluşturdu";
    }

    setCategories(nextCats);
    handleLocalUpdate(nextTasks, action, data.title);
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  if (!user) return <NicknameModal onJoin={(n, a) => { const u = { nickname: n, isAdmin: a }; setUser(u); localStorage.setItem('planet_user', JSON.stringify(u)); }} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header user={user} onLogout={() => { setUser(null); localStorage.removeItem('planet_user'); }} />
      
      <main className="flex-grow container mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        <div className="flex-grow space-y-6">
          <DashboardStats tasks={tasks} />
          
          {/* KONTROL PANELİ */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>LİSTE</button>
                <button onClick={() => setViewMode('board')} className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all ${viewMode === 'board' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>PANEL</button>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 min-w-[140px]">
                <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-700 uppercase leading-none">{isSyncing ? 'SENKRONİZE...' : 'ÇEVRİMİÇİ'}</span>
                  <span className="text-[8px] text-slate-400 font-bold mt-0.5">{lastSync}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {!user.isAdmin ? (
                <div className="text-[10px] font-black text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-100 uppercase tracking-widest">
                  Sadece Görüntüleme Modu
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => saveToCloud()}
                    className={`px-5 py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-2 border-2 ${hasChanges ? 'bg-green-600 border-green-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                    {hasChanges ? 'BULUTA AKTAR' : 'VERİ GÜNCEL'}
                  </button>
                  <button 
                    onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-black hover:bg-black transition-all flex items-center gap-2 shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                    YENİ GÖREV
                  </button>
                </>
              )}
            </div>
          </div>

          {viewMode === 'list' ? (
            <TaskListView 
              tasks={tasks} 
              onUpdate={updateTask} 
              onDelete={deleteTask} 
              onEdit={(t) => { setEditingTask(t); setIsModalOpen(true); }} 
              categories={categories} 
              onAddTask={(c) => { setIsModalOpen(true); }} 
              isAdmin={user.isAdmin}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map(category => (
                <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col h-[500px]">
                  <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    {category}
                  </h3>
                  <div className="flex-grow overflow-y-auto custom-scrollbar space-y-3">
                    {tasks.filter(t => t.category === category).map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        onUpdate={(u) => updateTask(task.id, u)} 
                        onDelete={() => deleteTask(task.id)} 
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
          currentUserNickname={user.nickname} 
        />
      )}
    </div>
  );
}
