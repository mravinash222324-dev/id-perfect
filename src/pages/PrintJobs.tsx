import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Printer } from 'lucide-react';

export default function PrintJobs() {
  return (
    <DashboardLayout>
      <PageHeader title="Print Jobs" description="Manage print queue and delivery status" />
      <Card>
        <CardContent className="text-center py-12">
          <Printer className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No print jobs</h3>
          <p className="text-muted-foreground">Print jobs will appear here when you send cards for printing</p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
