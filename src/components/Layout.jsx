import { NavLink, Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Dumbbell, Library, Clapperboard, ShieldCheck, Users, BarChart3,
  FileText, FlaskConical, HeartPulse, UsersRound, Video, BookOpen, Bot, User, Activity
} from 'lucide-react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import InvitationBanner from '@/components/InvitationBanner';

const NAV_GROUPS = [
  { label: 'Train', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/planner', label: 'Workout Planner', icon: Dumbbell },
    { to: '/exercise-library', label: 'Exercise Library', icon: Library },
    { to: '/video-feed', label: 'Video Feed', icon: Clapperboard },
  ]},
  { label: 'Monitor', items: [
    { to: '/performance', label: 'Testing & Performance', icon: BarChart3 },
    { to: '/wellness', label: 'Training Load & Wellness', icon: HeartPulse },
    { to: '/movement', label: 'Video Analysis', icon: Video },
  ]},
  { label: 'Plan & Recover', items: [
    { to: '/rehab', label: 'Rehabilitation Planner', icon: ShieldCheck },
    { to: '/athletes', label: 'Athlete Management', icon: Users },
    { to: '/teams', label: 'Team Management', icon: UsersRound },
  ]},
  { label: 'Resources', items: [
    { to: '/assistant', label: 'AI Assistant', icon: Bot },
    { to: '/research', label: 'Research Hub', icon: FlaskConical },
    { to: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
    { to: '/reports', label: 'Athlete Reports', icon: FileText },
  ]},
];

const ALL = NAV_GROUPS.flatMap((g) => g.items);

export default function Layout() {
  const { user, loading } = useCurrentUser();
  if (loading) return <div className="h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  if (user && !user.onboarded && user.role !== 'admin') return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen arctic-gradient">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-sidebar/70 backdrop-blur-xl z-30">
        <div className="flex items-center gap-2.5 px-6 h-16 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <p className="font-semibold text-sm">ApexMotion</p>
            <p className="text-[11px] text-muted-foreground">Performance Lab</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto scrollbar-thin">
          {NAV_GROUPS.map((group) => (
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
                    <item.icon className="w-[18px] h-[18px]" />
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
          {user?.role === 'athlete' && <InvitationBanner user={user} />}
          <Outlet />
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="flex overflow-x-auto scrollbar-thin">
          {ALL.slice(0, 8).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-2 px-3 text-[10px] font-medium shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`
              }
            >
              <item.icon className="w-5 h-5 mb-0.5" />
              <span className="max-w-[60px] truncate">{item.label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}