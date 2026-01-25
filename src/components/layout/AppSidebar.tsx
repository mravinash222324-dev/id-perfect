import { useState, useEffect } from 'react';
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
  Database,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';

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
    title: 'New Card',
    icon: CreditCard,
    href: '/new-batch',
    roles: ['school', 'teacher'],
  },
  {
    title: 'Drafts',
    icon: Database,
    href: '/drafts',
    roles: ['school', 'teacher'],
  },
  {
    title: 'View Cart',
    icon: ShoppingCart,
    href: '/cart',
    roles: ['school', 'teacher'],
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

  const sidebarVariants = {
    expanded: { width: 260 },
    collapsed: { width: 70 },
  };

  return (
    <motion.aside
      initial="expanded"
      animate={collapsed ? "collapsed" : "expanded"}
      variants={sidebarVariants}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative flex flex-col h-screen z-50 overflow-hidden border-r border-white/5 bg-[#0f0f13]/80 backdrop-blur-xl shadow-2xl"
    >
      {/* Dynamic Glow Line */}
      <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-primary/50 to-transparent opacity-50" />

      {/* Header */}
      <div className="flex h-20 items-center justify-between px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20 group cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
            <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <CreditCard className="h-5 w-5 text-white" />
          </div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col whitespace-nowrap"
              >
                <span className="text-xl font-bold tracking-tight text-white">
                  RAZ <span className="text-red-500">ID</span>
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Card Systems</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-24 h-6 w-6 rounded-full border border-white/10 bg-[#0A0A0E] shadow-lg hover:bg-primary hover:text-white transition-all z-50 text-muted-foreground"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 p-3 mt-4">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} key={item.href}>
              <Button
                variant="ghost"
                onClick={() => navigate(item.href)}
                className={cn(
                  'w-full relative overflow-hidden group transition-all duration-300',
                  collapsed ? 'justify-center px-2' : 'justify-start gap-4',
                  isActive
                    ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute inset-0 bg-primary/5 border-l-2 border-primary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}

                <item.icon className={cn(
                  'h-5 w-5 shrink-0 transition-colors z-10',
                  isActive ? 'text-primary drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]' : 'group-hover:text-white'
                )} />

                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="font-medium z-10"
                    >
                      {item.title}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-3 mt-auto">
        <div className={cn(
          "rounded-xl bg-white/5 border border-white/5 p-3 transition-all duration-300",
          collapsed ? "items-center justify-center flex" : ""
        )}>
          {!collapsed && (
            <div className="mb-3 px-1">
              <p className="text-sm font-semibold text-white truncate">{user?.email?.split('@')[0]}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
          )}

          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={cn(
              "w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20 transition-all",
              collapsed ? "justify-center p-0 h-9 w-9" : "justify-start gap-3"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </div>
    </motion.aside>
  );
}
