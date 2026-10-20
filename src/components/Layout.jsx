import { useState } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Dumbbell, Library, Clapperboard, ShieldCheck, Users, BarChart3,
  FileText, FlaskConical, HeartPulse, UsersRound, Video, BookOpen, Bot, User, Activity, MessageSquare, MoreHorizontal
} from 'lucide-react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import InvitationBanner from '@/components/InvitationBanner';

// `roles` limits an item to those roles; omitted means everyone. This only
// tidies navigation — every page and backend function enforces access itself.
const COACH = ['coach', 'admin'];
const NAV_GROUPS = [
  { label: 'Train', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/planner', label: 'Workout Planner', icon: Dumbbell },
    { to: '/exercise-library', label: 'Exercise Library', icon: Library },
    { to: '/video-feed', label: 'Video Feed', icon: Clapperboard },
  ]},
  { label: 'Monitor', items: [
    { to: '/performance', label: 'Testing & Performance', icon: BarChart3 },
    { to: '/wellness', label: 'Load & Wellness', icon: HeartPulse },
    { to: '/movement', label: 'Video Analysis', icon: Video },
    { to: '/rehab', label: 'Return-to-Play', icon: ShieldCheck },
  ]},
  { label: 'Connect', items: [
    { to: '/messages', label: 'Messages', icon: MessageSquare },
    { to: '/athletes', label: 'Athletes', icon: Users, roles: COACH },
    { to: '/teams', label: 'Teams', icon: UsersRound, roles: COACH },
  ]},
  { label: 'Resources', items: [
    { to: '/assistant', label: 'AI Assistant', icon: Bot },
    { to: '/research', label: 'Research Hub', icon: FlaskConical, roles: COACH },
    { to: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
    { to: '/reports', label: 'Reports', icon: FileText },
  ]},
];

const MOBILE_PRIMARY = {
  coach: ['/', '/athletes', '/planner', '/performance', '/messages'],
  athlete: ['/', '/planner', '/wellness', '/performance', '/messages'],
};

function navFor(role) {
  return NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) }))
    .filter((g) => g.items.length);
}

export default function Layout() {
  const { user, loading } = useCurrentUser();
  const [moreOpen, setMoreOpen] = useState(false);
  if (loading) return <div className="h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  if (user && !user.onboarded && user.role !== 'admin') return <Navigate to="/onboarding" replace />;

  const role = user?.role === 'admin' ? 'coach' : user?.role || 'athlete';
  const groups = navFor(user?.role || 'athlete');
  const all = groups.flatMap((g) => g.items);
  const mobile = (MOBILE_PRIMARY[role] || MOBILE_PRIMARY.athlete).map((to) => all.find((i) => i.to === to)).filter(Boolean);

  return (
    <div className="min-h-screen arctic-gradient">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-sidebar/70 backdrop-blur-xl z-30">
        <div className="flex items-center gap-2.5 px-6 h-16 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
            <Activity className="w-5 h-5 text-primary-foreground" aria-hidden />
          </div>
          <div className="leading-tight">
            <p className="font-semibold text-sm">Performance360</p>
            <p className="text-[11px] text-muted-foreground capitalize">{user?.role === 'admin' ? 'Administrator' : role} workspace</p>
          </div>
        </div>
        <nav aria-label="Main" className="flex-1 p-3 space-y-4 overflow-y-auto scrollbar-thin">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'text-sidebar-foreground hover:bg-sidebar-accent'
                      }`
                    }
                  >
                    <item.icon className="w-[18px] h-[18px]" aria-hidden />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <NavLink to="/profile" className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}>
            <User className="w-[18px] h-[18px]" /> Profile
          </NavLink>
        </div>
      </aside>

      <div className="lg:pl-64">
        <main className="pb-24 lg:pb-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6">
          {user && user.role !== 'coach' && user.role !== 'admin' && <InvitationBanner user={user} />}
          <Outlet />
        </main>
      </div>

      <nav aria-label="Primary" className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-6">
          {mobile.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}
              className={({ isActive }) => `flex flex-col items-center justify-center py-2 text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              <item.icon className="w-5 h-5 mb-0.5" aria-hidden />
              <span className="max-w-[64px] truncate">{item.label.split(' ')[0]}</span>
            </NavLink>
          ))}
          <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog"
            className="flex flex-col items-center justify-center py-2 text-[10px] font-medium text-muted-foreground">
            <MoreHorizontal className="w-5 h-5 mb-0.5" aria-hidden />More
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMoreOpen(false)}>
          <div role="dialog" aria-label="All pages" className="absolute bottom-0 inset-x-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            {groups.map((g) => (
              <div key={g.label} className="mb-3">
                <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</p>
                <div className="grid grid-cols-2 gap-1">
                  {g.items.map((item) => (
                    <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMoreOpen(false)}
                      className={({ isActive }) => `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
                      <item.icon className="w-4 h-4" aria-hidden />{item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
            <NavLink to="/profile" onClick={() => setMoreOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-accent"><User className="w-4 h-4" aria-hidden />Profile</NavLink>
          </div>
        </div>
      )}
    </div>
  );
}