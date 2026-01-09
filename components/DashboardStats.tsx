
import React from 'react';
import { Task } from '../types';
import { EVENT_DATE } from '../constants';

interface DashboardStatsProps {
  tasks: Task[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ tasks }) => {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const delayed = tasks.filter(t => t.deadline && new Date(t.deadline).getTime() < new Date().getTime() && t.status !== 'Completed').length;

  const progressPercentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  // Calculate days to Event
  const eventDate = new Date(EVENT_DATE);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = eventDate.getTime() - today.getTime();
  const daysToEvent = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const formattedTargetDate = eventDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-indigo-600">
        <p className="text-xs text-slate-500 font-medium mb-1">Days to Event</p>
        <div className="flex items-end justify-between">
          <span className={`text-2xl font-black ${daysToEvent <= 7 && daysToEvent >= 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {daysToEvent > 0 ? daysToEvent : daysToEvent === 0 ? 'TODAY' : 'DONE'}
          </span>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Target: {formattedTargetDate}</p>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <p className="text-xs text-slate-500 font-medium mb-1">Overall Progress</p>
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold text-green-600">%{progressPercentage}</span>
          <div className="flex-grow mx-4 mb-2">
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <p className="text-xs text-slate-500 font-medium mb-1">Total Tasks</p>
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold text-slate-900">{total}</span>
          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <p className="text-xs text-slate-500 font-medium mb-1">Critical/Delayed</p>
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold text-red-600">{delayed}</span>
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
};
