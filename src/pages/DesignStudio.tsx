
import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { CanvasEditor } from '@/components/id-card/CanvasEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

export default function DesignStudio() {
  const [cardWidth, setCardWidth] = useState(1011);
  const [cardHeight, setCardHeight] = useState(638);
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [canvasData, setCanvasData] = useState<any>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

  const handleEditorSave = (data: any) => {
    setCanvasData(data);
    setIsSaveDialogOpen(true);
  };

  const saveTemplateToDb = async () => {
    if (!templateName || !canvasData) {
      toast.error('Template name is required');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from('id_templates').insert({
        name: templateName,
        description: description,
        front_design: canvasData,
        card_width: cardWidth,
        card_height: cardHeight,
        status: 'active'
      });

      if (error) throw error;

      toast.success('Template saved successfully!');
    } catch (err: any) {
      console.warn('Database save failed, falling back to local storage:', err);

      // Fallback: Save to Local Storage
      const newTemplate = {
        id: `local-${Date.now()}`,
        name: templateName,
        description: description,
        front_design: canvasData,
        card_width: cardWidth,
        card_height: cardHeight,
        status: 'active',
        created_at: new Date().toISOString(),
        is_local: true
      };

      const storedTemplates = JSON.parse(localStorage.getItem('id_templates_local') || '[]');
      storedTemplates.push(newTemplate);
      localStorage.setItem('id_templates_local', JSON.stringify(storedTemplates));

      toast.info('Template saved locally (Database permission restricted)');
    } finally {
      setIsSaving(false);
      setIsSaveDialogOpen(false);
      setTemplateName('');
      setDescription('');
    }
  };

  return (
    <DashboardLayout>
      <PageHeader title="ID Card Design Studio" description="Create and manage professional ID card templates">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>W:</Label>
            <Input
              type="number"
              value={cardWidth}
              onChange={(e) => setCardWidth(Number(e.target.value))}
              className="w-20 h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label>H:</Label>
            <Input
              type="number"
              value={cardHeight}
              onChange={(e) => setCardHeight(Number(e.target.value))}
              className="w-20 h-9"
            />
          </div>
          <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
            {/* This button is just a trigger, the real save comes from the editor callback */}
            <DialogTrigger asChild>
              <Button className="gradient-primary gap-2 invisible">
                Save
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Student ID 2024" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                <Button onClick={saveTemplateToDb} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Template'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <div className="h-[calc(100vh-200px)]">
        <CanvasEditor onSave={handleEditorSave} width={cardWidth} height={cardHeight} />
      </div>
    </DashboardLayout>
  );
}
