
import React, { useState } from 'react';
import { Task, TaskStatus } from '../types';
import { STATUS_COLORS } from '../constants';

interface TaskCardProps {
  task: Task;
  onUpdate: (updates: Partial<Task>) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdate }) => {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState(task.notes);

  const calculateDaysLeft = (deadline: string | null) => {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysLeft = calculateDaysLeft(task.deadline);

  const handleNoteSave = () => {
    onUpdate({ notes });
    setIsEditingNotes(false);
  };

  return (
    <div className="p-4 border border-slate-100 rounded-lg hover:border-indigo-200 hover:shadow-sm transition-all bg-slate-50 group">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-slate-800 text-sm flex-grow mr-2">{task.title}</h4>
        <select 
          value={task.status}
          onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}
          className={`text-[10px] font-bold px-2 py-1 rounded-full outline-none cursor-pointer ${STATUS_COLORS[task.status]}`}
        >
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="space-y-3">
        {/* Deadline & Notifications */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <input 
              type="date"
              value={task.deadline || ''}
              onChange={(e) => onUpdate({ deadline: e.target.value || null })}
              className="text-xs text-slate-600 bg-transparent border-none focus:ring-0 p-0 cursor-pointer"
            />
          </div>
          {daysLeft !== null && task.status !== 'Completed' && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${daysLeft < 3 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
              {daysLeft < 0 ? 'Delayed' : `${daysLeft} days left`}
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
                className="w-full text-xs p-2 border border-indigo-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                rows={3}
                placeholder="Write your notes here..."
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditingNotes(false)} className="text-[10px] text-slate-500 hover:text-slate-700">Cancel</button>
                <button onClick={handleNoteSave} className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">Save</button>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setIsEditingNotes(true)}
              className="text-xs text-slate-500 italic bg-white p-2 rounded border border-transparent hover:border-slate-200 cursor-text min-h-[40px]"
            >
              {task.notes || 'Click to add notes...'}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex justify-between items-center text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            {task.assignee || 'Unassigned'}
          </span>
          <span>{new Date(task.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
};
