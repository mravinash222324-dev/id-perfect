import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { CanvasEditor } from '@/components/id-card/CanvasEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Maximize2 } from 'lucide-react';

// Standard card sizes
const CARD_SIZES = [
  { name: 'CR80 (Standard ID)', width: 1011, height: 638 },
  { name: 'CR79 (Adhesive Back)', width: 998, height: 625 },
  { name: 'CR100 (Government)', width: 1253, height: 880 },
  { name: 'Custom', width: 0, height: 0 },
];

export default function DesignStudio() {
  const [cardSize, setCardSize] = useState(CARD_SIZES[0]);
  const [customWidth, setCustomWidth] = useState(1011);
  const [customHeight, setCustomHeight] = useState(638);
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [canvasData, setCanvasData] = useState<any>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

  const effectiveWidth = cardSize.name === 'Custom' ? customWidth : cardSize.width;
  const effectiveHeight = cardSize.name === 'Custom' ? customHeight : cardSize.height;

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
      const { front_design, back_design } = canvasData || {};

      const { error } = await supabase.from('id_templates').insert({
        name: templateName,
        description: description,
        front_design: front_design,
        back_design: back_design,
        card_width: effectiveWidth,
        card_height: effectiveHeight,
        status: 'active'
      });

      if (error) throw error;

      toast.success('Template saved successfully!');
      setIsSaveDialogOpen(false);
      setTemplateName('');
      setDescription('');
    } catch (err: any) {
      console.warn('Database save failed, falling back to local storage:', err);

      const newTemplate = {
        id: `local-${Date.now()}`,
        name: templateName,
        description: description,
        front_design: canvasData.front_design,
        back_design: canvasData.back_design,
        card_width: effectiveWidth,
        card_height: effectiveHeight,
        status: 'active',
        created_at: new Date().toISOString(),
        is_local: true
      };

      const storedTemplates = JSON.parse(localStorage.getItem('id_templates_local') || '[]');
      storedTemplates.push(newTemplate);
      localStorage.setItem('id_templates_local', JSON.stringify(storedTemplates));

      toast.info('Template saved locally (Database permission restricted)');
      setIsSaveDialogOpen(false);
      setTemplateName('');
      setDescription('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader title="ID Card Design Studio" description="Create professional ID card templates with our visual editor">
        <div className="flex items-center gap-4">
          {/* Card Size Selector */}
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <Select 
              value={cardSize.name} 
              onValueChange={(v) => {
                const size = CARD_SIZES.find(s => s.name === v);
                if (size) setCardSize(size);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARD_SIZES.map(size => (
                  <SelectItem key={size.name} value={size.name}>
                    {size.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Dimensions */}
          {cardSize.name === 'Custom' && (
            <div className="flex items-center gap-2">
              <Maximize2 className="h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(Number(e.target.value))}
                className="w-20 h-9"
                placeholder="Width"
              />
              <span className="text-muted-foreground">×</span>
              <Input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(Number(e.target.value))}
                className="w-20 h-9"
                placeholder="Height"
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>
          )}
        </div>
      </PageHeader>

      {/* Canvas Editor */}
      <div className="h-[calc(100vh-180px)]">
        <CanvasEditor 
          onSave={handleEditorSave} 
          width={effectiveWidth} 
          height={effectiveHeight}
        />
      </div>

      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input 
                value={templateName} 
                onChange={e => setTemplateName(e.target.value)} 
                placeholder="e.g. Student ID 2024" 
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Optional description for this template" 
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Card Size: {effectiveWidth} × {effectiveHeight} px
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveTemplateToDb} disabled={isSaving || !templateName}>
              {isSaving ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}