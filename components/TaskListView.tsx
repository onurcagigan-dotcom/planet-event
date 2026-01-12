
import React, { useState } from 'react';
import { Task, TaskStatus } from '../types';
import { STATUS_COLORS } from '../constants';

interface TaskListViewProps {
  tasks: Task[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  categories: string[];
  onAddTask: (category: string) => void;
  onEditCategory: (catName: string) => void;
  onDeleteCategory: (catName: string) => void;
}

const CATEGORY_THEMES: Record<string, string> = {
  'PREPARATIONS': 'bg-indigo-50 border-indigo-200 text-indigo-700',
  'LOGISTICS & TRANSPORT': 'bg-amber-50 border-amber-200 text-amber-700',
  'CATERING & FOOD': 'bg-emerald-50 border-emerald-200 text-emerald-700',
  'VENUE SETUP & HR': 'bg-purple-50 border-purple-200 text-purple-700',
  'PRINTED / PRODUCED MATERIALS': 'bg-rose-50 border-rose-200 text-rose-700',
  'DIGITAL CONTENTS': 'bg-cyan-50 border-cyan-200 text-cyan-700',
  'APPROVALS': 'bg-slate-100 border-slate-300 text-slate-700',
};

export const TaskListView: React.FC<TaskListViewProps> = ({ 
  tasks, onUpdate, onDelete, onEdit, categories, onAddTask, onEditCategory, onDeleteCategory 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (t.assignee && t.assignee.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[700px]">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <h3 className="font-bold text-slate-800 whitespace-nowrap">Task Repository</h3>
        <div className="relative w-full sm:w-80">
          <input 
            type="text"
            placeholder="Search tasks, categories, owners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
          />
          <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>
      
      <div className="flex-grow overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 bg-white z-20 shadow-sm border-b border-slate-100">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">
              <th className="px-4 py-3 w-1/4">Task Details</th>
              <th className="px-4 py-3 w-32">Status</th>
              <th className="px-4 py-3 w-36">Deadline</th>
              <th className="px-4 py-3">Notes & Comments</th>
              <th className="px-4 py-3 w-40">Assignee</th>
              <th className="px-4 py-3 w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map(category => {
              const categoryTasks = filteredTasks.filter(t => t.category === category);
              const theme = CATEGORY_THEMES[category] || 'bg-slate-100 border-slate-300 text-slate-700';

              return (
                <React.Fragment key={category}>
                  <tr className={`${theme.split(' ')[0]} border-l-4 ${theme.split(' ')[1]} group/cat-row`}>
                    <td colSpan={5} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest ${theme.split(' ')[2]}`}>
                      <div className="flex items-center gap-3">
                        {category}
                        <div className="hidden group-hover/cat-row:flex items-center gap-1">
                          <button onClick={() => onEditCategory(category)} className="p-1 hover:bg-black/5 rounded transition-all">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-2 text-right ${theme.split(' ')[2]}`}>
                      <button 
                        onClick={() => onAddTask(category)}
                        className="text-[10px] font-black hover:underline tracking-tighter"
                      >
                        + ADD
                      </button>
                    </td>
                  </tr>
                  
                  {categoryTasks.map(task => (
                    <tr key={task.id} className="hover:bg-slate-50/80 transition-colors group/row">
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                        {task.title}
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          value={task.status}
                          onChange={(e) => onUpdate(task.id, { status: e.target.value as TaskStatus })}
                          className={`text-[9px] font-black px-2 py-0.5 rounded-full outline-none cursor-pointer border-transparent uppercase tracking-wider ${STATUS_COLORS[task.status]}`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="date"
                          value={task.deadline || ''}
                          onChange={(e) => onUpdate(task.id, { deadline: e.target.value || null })}
                          className="text-[11px] font-medium text-slate-500 bg-transparent border-none focus:ring-0 p-0 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <input 
                          type="text"
                          value={task.notes}
                          onChange={(e) => onUpdate(task.id, { notes: e.target.value })}
                          className="w-full text-[11px] text-slate-500 bg-transparent border-none focus:ring-0 p-0 italic focus:bg-white focus:not-italic focus:px-2 focus:py-1 rounded transition-all truncate focus:truncate-none"
                          placeholder="Add details..."
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="text"
                          value={task.assignee || ''}
                          onChange={(e) => onUpdate(task.id, { assignee: e.target.value || null })}
                          className="w-full text-[11px] font-bold text-slate-600 bg-transparent border-none focus:ring-0 p-0 hover:bg-slate-100 focus:bg-white focus:px-2 focus:py-1 rounded transition-all uppercase tracking-tight"
                          placeholder="Owner..."
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                           <button onClick={() => onEdit(task)} className="p-1.5 hover:bg-indigo-100 rounded text-indigo-600">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                           </button>
                           <button onClick={() => onDelete(task.id)} className="p-1.5 hover:bg-red-100 rounded text-red-600">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {categoryTasks.length === 0 && !searchTerm && (
                    <tr className="bg-slate-50/20">
                      <td colSpan={6} className="px-4 py-4 text-center text-[11px] text-slate-400 font-medium italic">
                        Empty group. <button onClick={() => onAddTask(category)} className="text-indigo-600 font-bold hover:underline ml-1">+ CREATE FIRST TASK</button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filteredTasks.length === 0 && searchTerm && (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-2">
            <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <p className="font-medium">No matches found for "{searchTerm}"</p>
          </div>
        )}
      </div>
    </div>
  );
};
