import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Palette, Plus, Layout, Type, Image, QrCode } from 'lucide-react';

export default function DesignStudio() {
  return (
    <DashboardLayout>
      <PageHeader title="ID Card Design Studio" description="Create and manage professional ID card templates">
        <Button className="gradient-primary gap-2">
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Elements</h3>
              {[
                { icon: Type, label: 'Text Field' },
                { icon: Image, label: 'Photo Placeholder' },
                { icon: QrCode, label: 'QR Code' },
                { icon: Layout, label: 'Shape' },
              ].map((item) => (
                <Button key={item.label} variant="outline" className="w-full justify-start gap-2" size="sm">
                  <item.icon className="h-4 w-4" /> {item.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="aspect-[1.586/1] flex items-center justify-center bg-muted/30">
            <div className="text-center">
              <Palette className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">Canvas Editor</h3>
              <p className="text-sm text-muted-foreground mb-4">Click "New Template" to start designing</p>
              <Button className="gradient-primary gap-2">
                <Plus className="h-4 w-4" /> Create Template
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
