
import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CanvasEditor, CanvasEditorRef } from '@/components/id-card/CanvasEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DesignStudio() {
  // Fixed Standard Size: CR80 @ 300 DPI (Landscape Default)
  // 85.6mm -> ~1011 px
  // 54mm -> ~638 px
  const [cardWidth] = useState(1011);
  const [cardHeight] = useState(638);
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [canvasData, setCanvasData] = useState<any>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

  const editorRef = useRef<CanvasEditorRef>(null);
  const navigate = useNavigate();

  const handleEditorSave = (data: any) => {
    setCanvasData(data);
    setIsSaveDialogOpen(true);
  };

  const [schools, setSchools] = useState<any[]>([]);
  const [assignedSchoolIds, setAssignedSchoolIds] = useState<string[]>([]);

  const toggleSchoolAssignment = (schoolId: string) => {
    setAssignedSchoolIds(prev =>
      prev.includes(schoolId)
        ? prev.filter(id => id !== schoolId)
        : [...prev, schoolId]
    );
  };

  useEffect(() => {
    if (isSaveDialogOpen) {
      const fetchSchools = async () => {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('role', ['school', 'teacher'] as any);

        if (!roleData) return;
        const userIds = roleData.map(r => r.user_id);

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', userIds);

        if (profileData) setSchools(profileData);
      };
      fetchSchools();
    }
  }, [isSaveDialogOpen]);

  const saveTemplateToDb = async () => {
    if (!templateName || !canvasData) {
      toast.error('Template name is required');
      return;
    }

    setIsSaving(true);
    try {
      // Extract data including new dimensions
      const { front_design, back_design, card_width, card_height, orientation, csv_headers } = canvasData || {};

      // Use dimensions from canvas if available, else fallback to defaults
      const finalWidth = card_width || cardWidth;
      const finalHeight = card_height || cardHeight;

      const { error } = await supabase.from('id_templates').insert({
        name: templateName,
        description: description,
        front_design: front_design,
        back_design: back_design,
        card_width: finalWidth,
        card_height: finalHeight,
        orientation: orientation, // Ensure table has this column or store in metadata? Assuming card width/height is sufficient.
        csv_headers: csv_headers,
        status: 'active',
        assigned_schools: assignedSchoolIds.length > 0 ? assignedSchoolIds : null
      } as any);

      if (error) throw error;

      toast.success('Template saved successfully!');
    } catch (err: any) {
      console.warn('Database save failed, falling back to local storage:', err);

      const { front_design, back_design, card_width, card_height, orientation, csv_headers } = canvasData || {};
      const finalWidth = card_width || cardWidth;
      const finalHeight = card_height || cardHeight;

      const newTemplate = {
        id: `local-${Date.now()}`,
        name: templateName,
        description: description,
        front_design: canvasData, // Keep full object for local? Or structure same as DB?
        card_width: finalWidth,
        card_height: finalHeight,
        status: 'active',
        created_at: new Date().toISOString(),
        is_local: true,
        assigned_schools: assignedSchoolIds
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
      setAssignedSchoolIds([]);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative">
      {/* Absolute Header for Maximum Space */}
      <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none z-50 flex items-center justify-between px-6">
        <div className="pointer-events-auto">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-2 glass hover:bg-white/10 text-white border-white/10 rounded-full h-10 px-4">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="pointer-events-auto">
          <Button className="gradient-primary gap-2 rounded-full h-10 px-6 shadow-lg shadow-primary/20" onClick={() => editorRef.current?.triggerSave()}>
            <Save className="h-4 w-4" />
            Save Template
          </Button>
        </div>
      </div>

      <div className="flex-1 w-full h-full">
        <CanvasEditor ref={editorRef} onSave={handleEditorSave} width={cardWidth} height={cardHeight} />
      </div>

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
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

            <div className="space-y-2 pt-2 border-t">
              <Label>Assign to Specific Schools (Optional)</Label>
              <div className="text-xs text-muted-foreground mb-2">
                If none selected, template will be available to ALL schools.
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                {schools.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-2">No schools found</div>
                ) : (
                  schools.map(school => (
                    <div key={school.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`school-${school.id}`}
                        checked={assignedSchoolIds.includes(school.user_id)}
                        onChange={() => toggleSchoolAssignment(school.user_id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor={`school-${school.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {school.full_name} {school.institution_name ? `(${school.institution_name})` : ''}
                      </label>
                    </div>
                  ))
                )}
              </div>
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
  );
}

