import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  CreditCard,
  Printer,
  FileCheck,
  ArrowRight,
  TrendingUp,
  Clock,
  AlertCircle,
  Activity,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion, Variants } from 'framer-motion';

interface DashboardStats {
  totalStudents: number;
  pendingApprovals: number;
  generatedCards: number;
  printJobsCompleted: number;
  totalSchools?: number;
  activeTemplates?: number;
}

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  details: any;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  },
};

export default function Dashboard() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    pendingApprovals: 0,
    generatedCards: 0,
    printJobsCompleted: 0,
    totalSchools: 0,
    activeTemplates: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role === 'school') {
      navigate('/upload');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { count: printedCount } = await supabase
          .from('print_jobs')
          .select('*', { count: 'exact', head: true })
          .in('status', ['printed', 'delivered']);

        if (role === 'admin') {
          const { count: schoolsCount } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'school' as any);

          const { count: templatesCount } = await supabase
            .from('id_templates')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');

          setStats(prev => ({
            ...prev,
            totalSchools: schoolsCount || 0,
            activeTemplates: templatesCount || 0,
            printJobsCompleted: printedCount || 0
          }));
        } else {
          const { count: studentCount } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true });

          const { count: pendingCount } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('verification_status', 'pending');

          const { count: cardsCount } = await supabase
            .from('id_cards')
            .select('*', { count: 'exact', head: true });

          setStats(prev => ({
            ...prev,
            totalStudents: studentCount || 0,
            pendingApprovals: pendingCount || 0,
            generatedCards: cardsCount || 0,
            printJobsCompleted: printedCount || 0
          }));
        }

        const { data: activityData } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentActivity(activityData || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (role) fetchDashboardData();
  }, [role, navigate]);

  const quickActions = [
    {
      title: 'Upload Students',
      description: 'Import student data via CSV',
      icon: Users,
      href: '/upload',
      roles: ['teacher'],
    },
    {
      title: 'Verify Students',
      description: 'Review pending approvals',
      icon: FileCheck,
      href: '/verification',
      roles: ['teacher'],
    },
    {
      title: 'Design Studio',
      description: 'Create ID card templates',
      icon: CreditCard,
      href: '/design-studio',
      roles: ['admin'],
    },
    {
      title: 'Print Jobs',
      description: 'Manage print queue',
      icon: Printer,
      href: '/print-jobs',
      roles: ['printer'],
    },
  ].filter((action) => action.roles.includes(role || ''));

  return (
    <DashboardLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <PageHeader
            title="Dashboard"
            description={`Welcome back! Here's an overview of your ID card management system.`}
          />
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary md:self-start mt-2">
            <Activity className="h-3 w-3 animate-pulse" />
            System Operational
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {role === 'admin' ? (
            <>
              <motion.div variants={itemVariants} className="h-full">
                <StatCard
                  title="Total Schools"
                  value={stats.totalSchools || 0}
                  icon={Users}
                  className="glass-card hover:bg-white/5 transition-colors h-full"
                  trend={{ value: 5, isPositive: true }}
                />
              </motion.div>
              <motion.div variants={itemVariants} className="h-full">
                <StatCard
                  title="Active Templates"
                  value={stats.activeTemplates || 0}
                  icon={CreditCard}
                  className="glass-card hover:bg-white/5 transition-colors h-full"
                />
              </motion.div>
              <motion.div variants={itemVariants} className="h-full">
                <StatCard
                  title="System Status"
                  value={100}
                  icon={FileCheck}
                  iconClassName="bg-blue-500/10"
                  description="All systems normal"
                  className="glass-card hover:bg-white/5 transition-colors h-full"
                />
              </motion.div>
            </>
          ) : (
            <>
              <motion.div variants={itemVariants}>
                <StatCard
                  title="Total Students"
                  value={stats.totalStudents}
                  icon={Users}
                  trend={{ value: 12, isPositive: true }}
                  className="glass-card"
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <StatCard
                  title="Pending Approvals"
                  value={stats.pendingApprovals}
                  icon={Clock}
                  iconClassName="bg-warning/10 text-warning"
                  description={stats.pendingApprovals > 0 ? 'Requires attention' : 'All caught up!'}
                  className="glass-card"
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <StatCard
                  title="Cards Generated"
                  value={stats.generatedCards}
                  icon={CreditCard}
                  trend={{ value: 8, isPositive: true }}
                  className="glass-card"
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <StatCard
                  title="Print Jobs"
                  value={stats.printJobsCompleted}
                  icon={Printer}
                  iconClassName="bg-success/10 text-success"
                  className="glass-card"
                />
              </motion.div>
            </>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Quick Actions */}
          <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
            <Card className="glass-card border-none">
              <CardHeader className="border-b border-white/5">
                <CardTitle className="text-lg flex items-center gap-2 font-light">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {quickActions.map((action, index) => (
                    <motion.button
                      key={action.href}
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.05)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(action.href)}
                      className="flex items-start gap-4 p-4 rounded-xl border border-white/5 bg-black/20 text-left group transition-all"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 group-hover:border-primary/50 transition-colors">
                        <action.icon className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium mb-1 text-white group-hover:text-primary transition-colors">
                          {action.title}
                        </h3>
                        <p className="text-sm text-muted-foreground group-hover:text-white/70 transition-colors">
                          {action.description}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-2 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0" />
                    </motion.button>
                  ))}

                  {role === 'admin' && (
                    <motion.button
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.05)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate('/settings')}
                      className="flex items-start gap-4 p-4 rounded-xl border border-white/5 bg-black/20 text-left group transition-all border-dashed hover:border-solid"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                        <Sparkles className="h-5 w-5 text-muted-foreground group-hover:text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium mb-1 text-muted-foreground group-hover:text-white transition-colors">
                          System Configuration
                        </h3>
                        <p className="text-sm text-muted-foreground/60">
                          Manage global settings
                        </p>
                      </div>
                    </motion.button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pending Approvals Alert */}
            {stats.pendingApprovals > 0 && (
              <motion.div variants={itemVariants}>
                <Card className="glass-card border-l-4 border-l-warning bg-warning/5">
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warning/10 animate-pulse">
                      <AlertCircle className="h-6 w-6 text-warning" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-white">Pending Verification</h3>
                      <p className="text-muted-foreground">
                        <span className="text-warning font-bold">{stats.pendingApprovals}</span> new student records require your approval before printing.
                      </p>
                    </div>
                    <Button
                      variant="default"
                      className="shrink-0 bg-warning hover:bg-warning/80 text-black font-semibold"
                      onClick={() => navigate('/verification')}
                    >
                      Review Now
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.div>

          {/* Recent Activity */}
          <motion.div variants={itemVariants}>
            <Card className="glass-card border-none h-full">
              <CardHeader className="border-b border-white/5">
                <CardTitle className="text-lg font-light">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {recentActivity.length > 0 ? (
                  <div className="space-y-6">
                    {recentActivity.map((activity, index) => (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + (index * 0.1) }}
                        key={activity.id}
                        className="flex items-start gap-3 relative"
                      >
                        {/* Timeline line */}
                        {index !== recentActivity.length - 1 && (
                          <div className="absolute left-[15px] top-8 bottom-[-24px] w-[2px] bg-white/5" />
                        )}

                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 z-10">
                          <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <p className="text-sm font-medium text-white">{activity.action}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {activity.entity_type.replace('_', ' ')}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {format(new Date(activity.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-4">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                    <p className="text-xs text-muted-foreground mt-1 opacity-50">
                      System logs will appear here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
