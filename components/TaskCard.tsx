
import React, { useState } from 'react';
import { Task, TaskStatus } from '../types';
import { STATUS_COLORS } from '../constants';

interface TaskCardProps {
  task: Task;
  onUpdate: (updates: Partial<Task>) => void;
  onDelete: () => void;
  onEdit: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdate, onDelete, onEdit }) => {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState(task.notes);

  const calculateDaysLeft = (deadline: string | null) => {
    if (!deadline) return null;
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diff = deadlineDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysLeft = calculateDaysLeft(task.deadline);

  const handleNoteSave = () => {
    onUpdate({ notes });
    setIsEditingNotes(false);
  };

  return (
    <div className="p-4 border border-slate-100 rounded-lg hover:border-indigo-200 hover:shadow-sm transition-all bg-slate-50 group/card relative">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-slate-800 text-sm flex-grow mr-2 leading-snug">{task.title}</h4>
        <div className="flex flex-col items-end gap-2">
          <select 
            value={task.status}
            onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}
            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full outline-none cursor-pointer shadow-sm ${STATUS_COLORS[task.status]}`}
          >
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          
          <div className="hidden group-hover/card:flex items-center gap-1 transition-all">
            <button onClick={onEdit} className="p-1 hover:bg-indigo-100 rounded text-slate-400 hover:text-indigo-600 transition-colors" title="Edit Task">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button onClick={onDelete} className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600 transition-colors" title="Delete Task">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* Deadline info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 min-w-[100px]">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-[11px] text-slate-600 font-medium">{task.deadline ? new Date(task.deadline).toLocaleDateString('en-GB') : 'No deadline'}</span>
          </div>
          {daysLeft !== null && task.status !== 'Completed' && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap ${daysLeft < 0 ? 'bg-red-600 text-white' : daysLeft <= 3 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
              {daysLeft < 0 ? 'OVERDUE' : daysLeft === 0 ? 'DUE TODAY' : `${daysLeft}D LEFT`}
            </span>
          )}
        </div>

        {/* Notes Section */}
        <div className="relative">
          {isEditingNotes ? (
            <div className="space-y-2">
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                autoFocus
                className="w-full text-xs p-2 border border-indigo-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                rows={3}
                placeholder="Write your notes here..."
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditingNotes(false)} className="text-[10px] text-slate-500 hover:text-slate-700 font-bold uppercase">Cancel</button>
                <button onClick={handleNoteSave} className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 font-bold uppercase shadow-sm">Save</button>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setIsEditingNotes(true)}
              className="text-xs text-slate-500 italic bg-white p-2 rounded border border-slate-100 hover:border-slate-200 cursor-text min-h-[40px] leading-relaxed line-clamp-3 hover:line-clamp-none transition-all"
            >
              {task.notes || 'Click to add notes...'}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider pt-2 border-t border-slate-200/50">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            {task.assignee || 'NONE'}
          </span>
          <span>{new Date(task.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
};
