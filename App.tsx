
import React, { useState, useEffect } from 'react';
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

type ViewMode = 'board' | 'list';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);

  // Load initial data
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUser) {
      setUser({ nickname: savedUser });
    }

    const savedTasks = localStorage.getItem(STORAGE_KEY_TASKS);
    const savedLogs = localStorage.getItem(STORAGE_KEY_LOGS);
    const savedCategories = localStorage.getItem(STORAGE_KEY_CATEGORIES);

    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    } else {
      setTasks(INITIAL_TASKS);
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(INITIAL_TASKS));
    }

    if (savedCategories) {
      setCategories(JSON.parse(savedCategories));
    } else {
      setCategories(DEFAULT_CATEGORIES);
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    }

    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    }

    setIsInitializing(false);
  }, []);

  // Sync with other tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_TASKS) setTasks(JSON.parse(e.newValue || '[]'));
      if (e.key === STORAGE_KEY_LOGS) setLogs(JSON.parse(e.newValue || '[]'));
      if (e.key === STORAGE_KEY_CATEGORIES) setCategories(JSON.parse(e.newValue || '[]'));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(newTasks));
  };

  const saveCategories = (newCats: string[]) => {
    setCategories(newCats);
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(newCats));
  };

  const addLog = (taskId: string, title: string, action: string) => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId,
      taskTitle: title,
      nickname: user?.nickname || 'Anonymous',
      action,
      timestamp: Date.now()
    };
    const updatedLogs = [newLog, ...logs].slice(0, 50);
    setLogs(updatedLogs);
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    let actionMsg = "updated";
    if (updates.status && updates.status !== task.status) actionMsg = `changed status to "${updates.status}"`;
    else if (updates.title && updates.title !== task.title) actionMsg = `renamed to "${updates.title}"`;
    else if (updates.assignee !== undefined && updates.assignee !== task.assignee) actionMsg = `assigned responsible to "${updates.assignee || 'Unassigned'}"`;
    else if (updates.notes !== undefined && updates.notes !== task.notes) actionMsg = "updated notes";
    else if (updates.deadline !== undefined && updates.deadline !== task.deadline) actionMsg = updates.deadline ? `set deadline to "${updates.deadline}"` : "removed deadline";
    else if (updates.category && updates.category !== task.category) actionMsg = `moved to "${updates.category}"`;

    const newTasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    saveTasks(newTasks);
    addLog(id, task.title, actionMsg);
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (!confirm(`Are you sure you want to delete "${task.title}"?`)) return;

    const newTasks = tasks.filter(t => t.id !== id);
    saveTasks(newTasks);
    addLog(id, task.title, "deleted the task");
  };

  const handleFormSubmit = (data: { title: string, category: string, deadline: string | null, notes: string, assignee: string | null }) => {
    // Check for category creation
    if (!categories.includes(data.category)) {
      const newCats = [...categories, data.category];
      saveCategories(newCats);
      addLog('system', data.category, "created new category via task");
    }

    if (editingTask) {
      updateTask(editingTask.id, data);
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
      saveTasks(newTasks);
      addLog(newTask.id, newTask.title, "added a new task");
    }
    setIsModalOpen(false);
    setEditingTask(undefined);
    setPreselectedCategory(undefined);
  };

  const editCategory = (oldName: string) => {
    const newName = prompt(`Enter new name for category "${oldName}":`, oldName);
    if (!newName || newName.trim() === oldName) return;
    
    const formattedName = newName.trim().toUpperCase();
    if (categories.includes(formattedName)) {
      alert("This category name already exists.");
      return;
    }

    const newCats = categories.map(c => c === oldName ? formattedName : c);
    const newTasks = tasks.map(t => t.category === oldName ? { ...t, category: formattedName } : t);
    
    saveCategories(newCats);
    saveTasks(newTasks);
    addLog('system', oldName, `renamed category to "${formattedName}"`);
  };

  const deleteCategory = (catName: string) => {
    const taskCount = tasks.filter(t => t.category === catName).length;
    if (taskCount > 0) {
      if (!confirm(`Warning: This category contains ${taskCount} task(s). Deleting the category will also delete all associated tasks. Proceed?`)) return;
    } else {
      if (!confirm(`Are you sure you want to delete category "${catName}"?`)) return;
    }

    const newCats = categories.filter(c => c !== catName);
    const newTasks = tasks.filter(t => t.category !== catName);
    
    saveCategories(newCats);
    saveTasks(newTasks);
    addLog('system', catName, "deleted the category");
  };

  const exportToCSV = () => {
    if (tasks.length === 0) {
      alert("No tasks to export.");
      return;
    }

    const headers = ["Category", "Task", "Status", "Deadline", "Responsible", "Notes", "Last Updated"];
    const csvRows = [
      headers.join(","), // header row
      ...tasks.map(task => {
        const row = [
          `"${task.category.replace(/"/g, '""')}"`,
          `"${task.title.replace(/"/g, '""')}"`,
          `"${task.status}"`,
          `"${task.deadline || '—'}"`,
          `"${(task.assignee || 'Unassigned').replace(/"/g, '""')}"`,
          `"${(task.notes || '').replace(/"/g, '""')}"`,
          `"${new Date(task.updatedAt).toLocaleString()}"`
        ];
        return row.join(",");
      })
    ];

    const csvContent = "\uFEFF" + csvRows.join("\n"); // Add BOM for Excel compatibility with UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Planet_Event_Tasks_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addLog('system', 'All Tasks', "exported task list to CSV");
  };

  const handleLogin = (nickname: string) => {
    setUser({ nickname });
    localStorage.setItem(STORAGE_KEY_USER, nickname);
  };

  if (isInitializing) return null;
  if (!user) return <NicknameModal onJoin={handleLogin} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <Header user={user} onLogout={() => { setUser(null); localStorage.removeItem(STORAGE_KEY_USER); }} />
      
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        <div className="flex-grow space-y-6 overflow-hidden">
          <DashboardStats tasks={tasks} />
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex gap-1 w-full sm:w-auto">
              <button 
                onClick={() => setViewMode('board')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${viewMode === 'board' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                Board
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                List
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={exportToCSV}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                title="Export to CSV"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export
              </button>
              <button 
                onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
                className="flex-1 sm:flex-none px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                NEW TASK
              </button>
            </div>
          </div>

          {viewMode === 'board' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map(category => (
                <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[500px]">
                  <div className="flex justify-between items-center mb-4 group/cat">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="w-2 h-2 shrink-0 rounded-full bg-indigo-500"></span>
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide truncate" title={category}>
                        {category}
                      </h3>
                      <div className="hidden group-hover/cat:flex items-center gap-1 ml-2 transition-all">
                        <button onClick={() => editCategory(category)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => deleteCategory(category)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setPreselectedCategory(category); setEditingTask(undefined); setIsModalOpen(true); }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-indigo-600 transition-colors"
                      title="Add Task to Category"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>

                  <div className="flex-grow overflow-y-auto custom-scrollbar space-y-4 pr-1">
                    {tasks.filter(t => t.category === category).length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-sm flex flex-col items-center gap-2">
                        <span>No tasks here.</span>
                        <button 
                          onClick={() => { setPreselectedCategory(category); setEditingTask(undefined); setIsModalOpen(true); }}
                          className="text-[10px] text-indigo-600 font-bold hover:underline"
                        >
                          + ADD FIRST TASK
                        </button>
                      </div>
                    ) : (
                      tasks.filter(t => t.category === category).map(task => (
                        <TaskCard 
                          key={task.id} 
                          task={task} 
                          onUpdate={(updates) => updateTask(task.id, updates)} 
                          onDelete={() => deleteTask(task.id)}
                          onEdit={() => { setEditingTask(task); setIsModalOpen(true); }}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="md:col-span-2 text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
                   <p className="text-slate-400 mb-4 font-medium">No categories found. Create a task to start!</p>
                   <button onClick={() => setIsModalOpen(true)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">Create First Task</button>
                </div>
              )}
            </div>
          ) : (
            <TaskListView 
              tasks={tasks} 
              onUpdate={updateTask} 
              onDelete={deleteTask}
              onEdit={(task) => { setEditingTask(task); setIsModalOpen(true); }}
              categories={categories} 
              onAddTask={(cat) => { setPreselectedCategory(cat); setEditingTask(undefined); setIsModalOpen(true); }} 
              onEditCategory={editCategory}
              onDeleteCategory={deleteCategory}
            />
          )}
        </div>

        <aside className="lg:w-80 shrink-0">
          <ActivitySidebar logs={logs} />
        </aside>
      </main>

      {isModalOpen && (
        <TaskFormModal 
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingTask(undefined); setPreselectedCategory(undefined); }}
          onSubmit={handleFormSubmit}
          categories={categories}
          initialData={editingTask}
          preselectedCategory={preselectedCategory}
          currentUserNickname={user.nickname}
        />
      )}

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-slate-400 text-[10px] uppercase tracking-widest font-semibold">
        PLANET &copy; 2026 - Opening Event Track
      </footer>
    </div>
  );
}
