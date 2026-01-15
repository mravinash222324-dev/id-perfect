import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Palette,
  Printer,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  title: string;
  icon: React.ElementType;
  href: string;
  roles?: ('admin' | 'teacher' | 'printer' | 'school')[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    roles: ['admin', 'teacher', 'printer'],
  },
  {
    title: 'School Management',
    icon: Users,
    href: '/admin/schools',
    roles: ['admin'],
  },
  /* Students and Upload Data removed as per refactor to Print Jobs dashboard */

  {
    title: 'Design Studio',
    icon: Palette,
    href: '/design-studio',
    roles: ['admin'],
  },
  {
    title: 'Print Jobs',
    icon: Printer,
    href: '/print-jobs',
    roles: ['printer', 'admin'],
  },
  {
    title: 'Settings',
    icon: Settings,
    href: '/settings',
    roles: ['admin'],
  },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, role, user } = useAuth();

  const filteredNavItems = navItems.filter(item =>
    !item.roles || (role && item.roles.includes(role))
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <aside
      className={cn(
        'relative flex flex-col glass border-r border-white/5 transition-all duration-300 ease-in-out z-50',
        collapsed ? 'w-[70px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">RAZ ID</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Card Systems</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20 mx-auto">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      {/* Collapse button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 h-6 w-6 rounded-full border bg-card shadow-md hover:bg-accent"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3 pt-6">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Button
              key={item.href}
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3 transition-all',
                isActive && 'bg-primary/10 text-primary font-medium',
                collapsed && 'justify-center px-2'
              )}
              onClick={() => navigate(item.href)}
            >
              <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
              {!collapsed && <span>{item.title}</span>}
            </Button>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-3">
        <Separator className="mb-3" />
        {!collapsed && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10',
            collapsed && 'justify-center px-2'
          )}
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}
