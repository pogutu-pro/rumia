'use client';

import { useState } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Search } from 'lucide-react';

interface FeedbackItem {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  category: string;
  message: string;
  created_at: string;
}

interface FeedbackTableClientProps {
  feedback: FeedbackItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
  suggest_hostel: 'Suggest Hostel',
  feature_request: 'Feature Request',
  report_problem: 'Report Problem',
  general: 'General',
};

const CATEGORY_COLORS: Record<string, string> = {
  suggest_hostel: 'bg-blue-50 text-blue-700',
  feature_request: 'bg-purple-50 text-purple-700',
  report_problem: 'bg-red-50 text-red-700',
  general: 'bg-slate-50 text-slate-700',
};

export function FeedbackTableClient({ feedback }: FeedbackTableClientProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const filtered = feedback.filter((f) => {
    const matchesSearch =
      !search ||
      f.message.toLowerCase().includes(search.toLowerCase()) ||
      (f.user_email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (f.user_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || f.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Feedback</h1>
        <p className="text-sm text-slate-500 mt-1">
          {feedback.length} message{feedback.length !== 1 ? 's' : ''} from students.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search messages, names, or emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
        >
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-12 text-center">
          <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No feedback to show.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => {
            const isOpen = expanded.has(f.id);
            return (
              <div
                key={f.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => toggle(f.id)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="shrink-0 mt-0.5">
                    <MessageSquare className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[f.category]}`}>
                        {CATEGORY_LABELS[f.category] ?? f.category}
                      </span>
                      <span className="text-xs text-slate-500">
                        {f.user_name ?? f.user_email ?? 'Anonymous'}
                      </span>
                      {f.user_email && f.user_name && (
                        <span className="text-xs text-slate-400">{f.user_email}</span>
                      )}
                    </div>
                    <p className={`text-sm text-slate-900 mt-1 ${isOpen ? '' : 'line-clamp-2'}`}>
                      {f.message}
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {new Date(f.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="shrink-0 mt-1">
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
