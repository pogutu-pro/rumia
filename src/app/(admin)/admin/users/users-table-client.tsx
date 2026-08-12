'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { promoteStudentToAgentAction, updateUserRoleAction, promoteToAdminAction } from '@/app/actions/admin';
import type { UserRow } from './page';

const ROLE_BADGES: Record<string, { label: string; class: string }> = {
  admin: { label: 'Admin', class: 'bg-purple-50 text-purple-700' },
  manager: { label: 'Manager', class: 'bg-indigo-50 text-indigo-700' },
  agent: { label: 'Agent', class: 'bg-blue-50 text-blue-700' },
  student: { label: 'Student', class: 'bg-amber-50 text-amber-700' },
};

interface UsersTableClientProps {
  users: UserRow[];
}

export function UsersTableClient({ users }: UsersTableClientProps) {
  const router = useRouter();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [promoteUserId, setPromoteUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', whatsapp: '' });
  const [promoteForm, setPromoteForm] = useState<string | null>(null);

  async function handleDemote(userId: string, role: string) {
    const targetRole = role === 'admin' ? 'agent' : 'student';
    const confirmed = window.confirm(`Demote this user to ${targetRole}?`);
    if (!confirmed) return;
    setPendingUserId(userId);
    const result = await updateUserRoleAction(userId, targetRole);
    setPendingUserId(null);
    if (result.success) { toast.success(`User demoted to ${targetRole}`); router.refresh(); }
    else { toast.error(result.error); }
  }

  async function handlePromoteToAdmin(userId: string) {
    const confirmed = window.confirm('Promote this user to Admin? They will gain full admin access.');
    if (!confirmed) return;
    setPendingUserId(userId);
    const result = await promoteToAdminAction(userId);
    setPendingUserId(null);
    if (result.success) { toast.success('User promoted to admin'); router.refresh(); }
    else { toast.error(result.error); }
  }

  async function handlePromoteToAgent(userId: string) {
    if (!formData.name || !formData.phone) {
      toast.error('Name and phone are required');
      return;
    }
    setPromoteUserId(userId);
    const result = await promoteStudentToAgentAction(userId, {
      name: formData.name,
      phone: formData.phone,
      whatsapp: formData.whatsapp || formData.phone,
    });
    setPromoteUserId(null);
    setPromoteForm(null);
    setFormData({ name: '', phone: '', whatsapp: '' });
    if (result.success) { toast.success('Student promoted to agent'); router.refresh(); }
    else { toast.error(result.error); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Users</h1>
          <p className="text-sm text-slate-500 mt-1">{users.length} user{users.length !== 1 ? 's' : ''} registered</p>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50">
              {['User', 'Email', 'Phone', 'Role', 'Agent', 'Joined', 'Updated', 'Actions'].map((h) => (
                <th key={h} className="text-xs font-medium text-slate-500 uppercase tracking-wider text-left px-5 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.length === 0 ? (
              <tr><td colSpan={8} className="text-sm text-slate-400 text-center px-5 py-8">No users found.</td></tr>
            ) : users.map((user) => {
              const badge = ROLE_BADGES[user.role] ?? ROLE_BADGES.student;
              return (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0 flex items-center justify-center">
                          <span className="text-xs font-medium text-slate-400">{(user.full_name || '?')[0]}</span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user.full_name || '—'}</p>
                        <p className="text-xs text-slate-400 font-mono">{user.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-slate-600 px-5 py-4 max-w-[200px] truncate">{user.email}</td>
                  <td className="text-sm text-slate-600 px-5 py-4 whitespace-nowrap">{user.phone || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${badge.class}`}>{badge.label}</span>
                  </td>
                  <td className="px-5 py-4 text-sm">
                    {user.has_agent ? (
                      <div>
                        <Link href={`/admin/agents/${user.agent_slug || ''}`} className="text-emerald-600 hover:underline font-medium">
                          {user.agent_name}
                        </Link>
                        <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${user.agent_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {user.agent_status}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="text-sm text-slate-500 px-5 py-4 whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="text-sm text-slate-500 px-5 py-4 whitespace-nowrap">
                    {user.updated_at ? new Date(user.updated_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-sm whitespace-nowrap">
                      {user.role === 'student' && !user.has_agent && (
                        <button
                          onClick={() => {
                            setPromoteForm(promoteForm === user.id ? null : user.id);
                            setFormData({ name: user.full_name || '', phone: user.phone || '', whatsapp: user.phone || '' });
                          }}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          {promoteForm === user.id ? 'Cancel' : 'Make Agent'}
                        </button>
                      )}
                      {user.role === 'agent' && (
                        <>
                          <button onClick={() => handlePromoteToAdmin(user.id)} disabled={pendingUserId === user.id}
                            className="text-xs font-medium text-purple-600 hover:underline disabled:opacity-50">
                            {pendingUserId === user.id ? '...' : 'Make Admin'}
                          </button>
                          <button onClick={() => handleDemote(user.id, user.role)} disabled={pendingUserId === user.id}
                            className="text-xs font-medium text-amber-600 hover:underline disabled:opacity-50">
                            {pendingUserId === user.id ? '...' : 'Revoke Agent'}
                          </button>
                        </>
                      )}
                      {user.role === 'admin' && (
                        <button onClick={() => handleDemote(user.id, user.role)} disabled={pendingUserId === user.id}
                          className="text-xs font-medium text-amber-600 hover:underline disabled:opacity-50">
                          {pendingUserId === user.id ? '...' : 'Demote'}
                        </button>
                      )}
                    </div>
                    {promoteForm === user.id && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg space-y-2 border border-slate-200/80 min-w-[280px]">
                        <p className="text-xs font-medium text-slate-600">Promote to Agent</p>
                        <input type="text" placeholder="Full name" value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full text-sm px-2.5 py-1.5 border border-slate-200/80 rounded-lg bg-white" />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Phone" value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full text-sm px-2.5 py-1.5 border border-slate-200/80 rounded-lg bg-white" />
                          <input type="text" placeholder="WhatsApp (optional)" value={formData.whatsapp}
                            onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                            className="w-full text-sm px-2.5 py-1.5 border border-slate-200/80 rounded-lg bg-white" />
                        </div>
                        <div className="flex justify-end">
                          <Button size="sm" onClick={() => handlePromoteToAgent(user.id)}
                            disabled={promoteUserId === user.id} className="rounded-lg text-xs">
                            {promoteUserId === user.id ? 'Promoting...' : 'Promote to Agent'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {users.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 text-center text-sm text-slate-400 shadow-sm">No users found.</div>
        ) : users.map((user) => {
          const badge = ROLE_BADGES[user.role] ?? ROLE_BADGES.student;
          return (
            <div key={user.id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-100 shrink-0 flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-400">{(user.full_name || '?')[0]}</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{user.full_name || '—'}</p>
                    <p className="text-xs text-slate-400">{user.email}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.class}`}>{badge.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                <span>Phone: {user.phone || '—'}</span>
                <span>Joined: {new Date(user.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {user.updated_at && <span>Updated: {new Date(user.updated_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}</span>}
                <span>ID: {user.id.slice(0, 8)}...</span>
              </div>
              {user.has_agent && (
                <div className="text-xs bg-slate-50 rounded-lg p-2 flex items-center gap-2">
                  <span className="text-slate-500">Agent:</span>
                  <Link href={`/admin/agents/${user.agent_slug || ''}`} className="text-emerald-600 hover:underline font-medium">{user.agent_name}</Link>
                  <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${user.agent_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {user.agent_status}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 pt-1 flex-wrap">
                {user.role === 'student' && !user.has_agent && (
                  <button onClick={() => {
                    setPromoteForm(promoteForm === user.id ? null : user.id);
                    setFormData({ name: user.full_name || '', phone: user.phone || '', whatsapp: user.phone || '' });
                  }} className="text-xs font-medium text-blue-600 hover:underline">
                    {promoteForm === user.id ? 'Cancel' : 'Make Agent'}
                  </button>
                )}
                {user.role === 'agent' && (
                  <>
                    <button onClick={() => handlePromoteToAdmin(user.id)} disabled={pendingUserId === user.id}
                      className="text-xs font-medium text-purple-600 hover:underline disabled:opacity-50">
                      {pendingUserId === user.id ? '...' : 'Make Admin'}
                    </button>
                    <button onClick={() => handleDemote(user.id, user.role)} disabled={pendingUserId === user.id}
                      className="text-xs font-medium text-amber-600 hover:underline disabled:opacity-50">
                      {pendingUserId === user.id ? '...' : 'Revoke Agent'}
                    </button>
                  </>
                )}
                {user.role === 'admin' && (
                  <button onClick={() => handleDemote(user.id, user.role)} disabled={pendingUserId === user.id}
                    className="text-xs font-medium text-amber-600 hover:underline disabled:opacity-50">
                    {pendingUserId === user.id ? '...' : 'Demote'}
                  </button>
                )}
              </div>
              {promoteForm === user.id && (
                <div className="p-3 bg-slate-50 rounded-lg space-y-2 border border-slate-200/80">
                  <p className="text-xs font-medium text-slate-600">Promote to Agent</p>
                  <input type="text" placeholder="Full name" value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full text-sm px-2.5 py-1.5 border border-slate-200/80 rounded-lg bg-white" />
                  <input type="text" placeholder="Phone" value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full text-sm px-2.5 py-1.5 border border-slate-200/80 rounded-lg bg-white" />
                  <input type="text" placeholder="WhatsApp (optional)" value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full text-sm px-2.5 py-1.5 border border-slate-200/80 rounded-lg bg-white" />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => handlePromoteToAgent(user.id)}
                      disabled={promoteUserId === user.id} className="rounded-lg text-xs">
                      {promoteUserId === user.id ? 'Promoting...' : 'Promote to Agent'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
