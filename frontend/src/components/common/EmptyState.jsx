import React from 'react';
import { Inbox } from 'lucide-react';

export const EmptyState = ({ title = 'No Data Available', description = 'There are no records to display at this time.', icon: Icon = Inbox }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
      <div className="p-3 bg-slate-100 rounded-2xl text-slate-400 mb-3">
        <Icon className="w-8 h-8" />
      </div>
      <h4 className="text-sm font-bold text-slate-800">{title}</h4>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
    </div>
  );
};
