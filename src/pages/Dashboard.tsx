import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface DashboardStats {
  totalStudents: number;
  pendingApprovals: number;
  generatedCards: number;
  printJobsCompleted: number;
}

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  details: any;
}

export default function Dashboard() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    pendingApprovals: 0,
    generatedCards: 0,
    printJobsCompleted: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch students count
        const { count: studentCount } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true });

        // Fetch pending approvals
        const { count: pendingCount } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('verification_status', 'pending');

        // Fetch generated cards
        const { count: cardsCount } = await supabase
          .from('id_cards')
          .select('*', { count: 'exact', head: true });

        // Fetch completed print jobs
        const { count: printedCount } = await supabase
          .from('print_jobs')
          .select('*', { count: 'exact', head: true })
          .in('status', ['printed', 'delivered']);

        // Fetch recent activity
        const { data: activityData } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        setStats({
          totalStudents: studentCount || 0,
          pendingApprovals: pendingCount || 0,
          generatedCards: cardsCount || 0,
          printJobsCompleted: printedCount || 0,
        });

        setRecentActivity(activityData || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const quickActions = [
    {
      title: 'Upload Students',
      description: 'Import student data via CSV',
      icon: Users,
      href: '/upload',
      roles: ['admin', 'teacher'],
    },
    {
      title: 'Verify Students',
      description: 'Review pending approvals',
      icon: FileCheck,
      href: '/verification',
      roles: ['admin', 'teacher'],
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
      roles: ['admin', 'printer'],
    },
  ].filter((action) => action.roles.includes(role || ''));

  return (
    <DashboardLayout>
      <PageHeader
        title="Dashboard"
        description={`Welcome back! Here's an overview of your ID card management system.`}
      />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Students"
          value={stats.totalStudents}
          icon={Users}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={Clock}
          iconClassName="bg-warning/10"
          description={stats.pendingApprovals > 0 ? 'Requires attention' : 'All caught up!'}
        />
        <StatCard
          title="Cards Generated"
          value={stats.generatedCards}
          icon={CreditCard}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Print Jobs Done"
          value={stats.printJobsCompleted}
          icon={Printer}
          iconClassName="bg-success/10"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {quickActions.map((action) => (
                  <button
                    key={action.href}
                    onClick={() => navigate(action.href)}
                    className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-left group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <action.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium mb-1 group-hover:text-primary transition-colors">
                        {action.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals Alert */}
          {stats.pendingApprovals > 0 && (
            <Card className="mt-6 border-warning/50 bg-warning/5">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10">
                  <AlertCircle className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Pending Student Approvals</h3>
                  <p className="text-sm text-muted-foreground">
                    {stats.pendingApprovals} student{stats.pendingApprovals !== 1 ? 's' : ''} waiting for verification
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/verification')}
                  className="shrink-0"
                >
                  Review Now
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.entity_type}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(activity.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Activity will appear here as you use the system
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
