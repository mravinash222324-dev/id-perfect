import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Users, Eye } from 'lucide-react';

interface Student {
  id: string;
  roll_number: string;
  name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  blood_group: string | null;
  class: string | null;
  department: string | null;
  guardian_name: string | null;
  address: string | null;
  batch: string | null;
  verification_status: string;
  photo_url: string | null;
}

export default function Verification() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchPendingStudents();
  }, []);

  const fetchPendingStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: false });

    if (!error) setStudents(data || []);
    setLoading(false);
  };

  const handleVerify = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('students')
      .update({
        verification_status: status,
        verified_by: user?.id,
        verified_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`Student ${status}`);
      setStudents(students.filter((s) => s.id !== id));
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Student Verification"
        description="Review and approve pending student records"
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : students.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => (
            <Card key={student.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    {student.photo_url ? (
                      <img src={student.photo_url} alt={student.name} className="h-full w-full object-cover" />
                    ) : (
                      <Users className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{student.name}</h3>
                    <p className="text-sm text-muted-foreground font-mono">{student.roll_number}</p>
                    <StatusBadge status="pending" className="mt-2" />
                  </div>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground mb-6">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-medium text-foreground">Class:</span> {student.class || '-'}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Dept:</span> {student.department || '-'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-medium text-foreground">Batch:</span> {student.batch || '-'}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Blood:</span> {student.blood_group || '-'}
                    </div>
                  </div>

                  <div>
                    <span className="font-medium text-foreground">Email:</span> {student.email || '-'}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Phone:</span> {student.phone || '-'}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">DOB:</span> {student.dob || '-'}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Guardian:</span> {student.guardian_name || '-'}
                  </div>
                  <div className="line-clamp-2" title={student.address || ''}>
                    <span className="font-medium text-foreground">Address:</span> {student.address || '-'}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-success hover:bg-success/90" onClick={() => handleVerify(student.id, 'approved')}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleVerify(student.id, 'rejected')}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">All caught up!</h3>
            <p className="text-muted-foreground">No pending verifications</p>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
