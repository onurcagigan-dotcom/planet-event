
import React, { useState } from 'react';
import { Task, TaskStatus } from '../types';
import { STATUS_COLORS } from '../constants';

interface TaskListViewProps {
  tasks: Task[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  categories: string[];
  onAddTask: (category: string) => void;
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

export const TaskListView: React.FC<TaskListViewProps> = ({ tasks, onUpdate, categories, onAddTask }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[700px]">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <h3 className="font-bold text-slate-800 whitespace-nowrap">Complete Task List</h3>
        <div className="relative w-full sm:w-64">
          <input 
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>
      
      <div className="flex-grow overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="sticky top-0 bg-white z-20 shadow-sm">
            <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
              <th className="px-4 py-3 border-b border-slate-100 w-1/4">Task Title</th>
              <th className="px-4 py-3 border-b border-slate-100">Status</th>
              <th className="px-4 py-3 border-b border-slate-100">Deadline</th>
              <th className="px-4 py-3 border-b border-slate-100">Notes / Explanation</th>
              <th className="px-4 py-3 border-b border-slate-100">Responsible</th>
              <th className="px-4 py-3 border-b border-slate-100 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map(category => {
              const categoryTasks = filteredTasks.filter(t => t.category === category);
              const theme = CATEGORY_THEMES[category] || 'bg-slate-100 border-slate-300 text-slate-700';

              return (
                <React.Fragment key={category}>
                  {/* Category Header Row */}
                  <tr className={`${theme.split(' ')[0]} border-l-4 ${theme.split(' ')[1]}`}>
                    <td colSpan={5} className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest ${theme.split(' ')[2]}`}>
                      {category}
                    </td>
                    <td className={`px-4 py-2 text-right ${theme.split(' ')[2]}`}>
                      <button 
                        onClick={() => onAddTask(category)}
                        className="text-[10px] font-bold hover:opacity-70 transition-opacity"
                        title="Add Task to Category"
                      >
                        + ADD
                      </button>
                    </td>
                  </tr>
                  
                  {/* Task Rows */}
                  {categoryTasks.map(task => (
                    <tr key={task.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 border-l-4 border-transparent group-hover:border-indigo-400">
                        {task.title}
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          value={task.status}
                          onChange={(e) => onUpdate(task.id, { status: e.target.value as TaskStatus })}
                          className={`text-[10px] font-bold px-2 py-1 rounded-full outline-none cursor-pointer ${STATUS_COLORS[task.status]}`}
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
                          className="text-[11px] text-slate-600 bg-transparent border-none focus:ring-0 p-0 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <input 
                          type="text"
                          value={task.notes}
                          onChange={(e) => onUpdate(task.id, { notes: e.target.value })}
                          className="w-full text-xs text-slate-500 bg-transparent border-none focus:ring-0 p-0 focus:bg-white focus:px-1 rounded transition-all"
                          placeholder="Click to add note..."
                        />
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-400 font-medium whitespace-nowrap">
                        {task.assignee || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  ))}
                  {categoryTasks.length === 0 && !searchTerm && (
                    <tr className="bg-slate-50/30">
                      <td colSpan={6} className="px-4 py-2 text-center text-[10px] text-slate-400 italic">
                        No tasks in this category. 
                        <button onClick={() => onAddTask(category)} className="ml-2 text-indigo-600 font-bold hover:underline">Click to add</button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filteredTasks.length === 0 && (
          <div className="p-12 text-center text-slate-400">No tasks found.</div>
        )}
      </div>
    </div>
  );
};
