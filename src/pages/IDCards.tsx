import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Plus } from 'lucide-react';

export default function IDCards() {
  return (
    <DashboardLayout>
      <PageHeader title="ID Cards" description="Generate and manage student ID cards">
        <Button className="gradient-primary gap-2">
          <Plus className="h-4 w-4" /> Generate Cards
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="text-center py-12">
          <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No ID cards generated yet</h3>
          <p className="text-muted-foreground mb-4">Create a template and generate cards for approved students</p>
          <Button className="gradient-primary gap-2">
            <Plus className="h-4 w-4" /> Generate Cards
          </Button>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
