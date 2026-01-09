
import React, { useState, useEffect } from 'react';
import { Task } from '../types';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string, category: string, deadline: string | null, notes: string, assignee: string | null }) => void;
  categories: string[];
  initialData?: Task;
  preselectedCategory?: string;
  currentUserNickname?: string;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({ 
  isOpen, onClose, onSubmit, categories, initialData, preselectedCategory, currentUserNickname 
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [assignee, setAssignee] = useState('');
  const [isNewCategory, setIsNewCategory] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setCategory(initialData.category);
      setDeadline(initialData.deadline || '');
      setNotes(initialData.notes);
      setAssignee(initialData.assignee || '');
      setIsNewCategory(false);
    } else {
      setTitle('');
      setCategory(preselectedCategory || categories[0] || '');
      setDeadline('');
      setNotes('');
      setAssignee(currentUserNickname || '');
      setIsNewCategory(false);
    }
  }, [initialData, preselectedCategory, categories, currentUserNickname, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    const finalCategory = isNewCategory ? newCategoryName.trim().toUpperCase() : category;
    if (!finalCategory) {
      alert("Please select or enter a category.");
      return;
    }

    onSubmit({
      title: title.trim(),
      category: finalCategory,
      deadline: deadline || null,
      notes: notes.trim(),
      assignee: assignee.trim() || null
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
            {initialData ? 'Edit Task' : 'Create New Task'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Task Title *</label>
            <input 
              type="text" 
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium text-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Category</label>
              {!isNewCategory ? (
                <div className="space-y-2">
                  <select 
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setIsNewCategory(true);
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-semibold text-slate-700 bg-white"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__new__" className="text-indigo-600 font-bold">+ CREATE NEW CATEGORY</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <input 
                      type="text" 
                      autoFocus
                      placeholder="Category name..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border-2 border-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-bold uppercase"
                    />
                    <button 
                      type="button"
                      onClick={() => setIsNewCategory(false)}
                      className="absolute right-2 top-2 p-1 text-slate-400 hover:text-red-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Responsible</label>
              <input 
                type="text" 
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Assign to..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium text-slate-700"
              />
            </div>
          </div>

          <div>
             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Deadline</label>
              <input 
                type="date" 
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium text-slate-700"
              />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Notes / Description</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details or links..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-slate-700"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-2 grow-[2] bg-indigo-600 text-white px-4 py-3 rounded-xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 uppercase tracking-widest"
            >
              {initialData ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
