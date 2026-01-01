
import { useState, useEffect } from 'react';
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

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  const applyPreset = (value: string) => {
    switch (value) {
      case 'cr80-landscape':
        setCardWidth(1011);
        setCardHeight(638);
        break;
      case 'cr80-portrait':
        setCardWidth(638);
        setCardHeight(1011);
        break;
      case 'cr79-landscape':
        setCardWidth(991);
        setCardHeight(602);
        break;
      case 'cr79-portrait':
        setCardWidth(602);
        setCardHeight(991);
        break;
      case 'cr100-landscape':
        setCardWidth(1167);
        setCardHeight(791);
        break;
      case 'cr100-portrait':
        setCardWidth(791);
        setCardHeight(1167);
        break;
      case 'business-landscape':
        setCardWidth(1050);
        setCardHeight(600);
        break;
      case 'business-portrait':
        setCardWidth(600);
        setCardHeight(1050);
        break;
      case 'a7-landscape':
        setCardWidth(1240);
        setCardHeight(874);
        break;
      case 'a7-portrait':
        setCardWidth(874);
        setCardHeight(1240);
        break;
      case 'a4-portrait':
        setCardWidth(2480);
        setCardHeight(3508);
        break;
      case 'a4-landscape':
        setCardWidth(3508);
        setCardHeight(2480);
        break;
    }
  };

  /* ------------------- NEW: School Assignment Logic ------------------- */
  const [schools, setSchools] = useState<any[]>([]);
  const [assignedSchoolIds, setAssignedSchoolIds] = useState<string[]>([]);

  // Fetch schools when dialog opens
  useEffect(() => {
    if (isSaveDialogOpen) {
      const fetchSchools = async () => {
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('role', ['school', 'teacher'] as any); // Fetch both for now

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

  const toggleSchoolAssignment = (schoolId: string) => {
    setAssignedSchoolIds(prev =>
      prev.includes(schoolId)
        ? prev.filter(id => id !== schoolId)
        : [...prev, schoolId]
    );
  };
  /* ------------------------------------------------------------------- */

  const saveTemplateToDb = async () => {
    if (!templateName || !canvasData) {
      toast.error('Template name is required');
      return;
    }

    setIsSaving(true);
    try {
      // canvasData structure from CanvasEditor: { front_design: Object, back_design: Object }
      const { front_design, back_design } = canvasData || {};

      const { error } = await supabase.from('id_templates').insert({
        name: templateName,
        description: description,
        front_design: front_design, // Save actual front JSON
        back_design: back_design,   // Save actual back JSON
        card_width: cardWidth,
        card_height: cardHeight,
        status: 'active',
        assigned_schools: assignedSchoolIds.length > 0 ? assignedSchoolIds : null // Save assignments
      } as any); // Cast as any because types might be stale

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
      setAssignedSchoolIds([]); // Reset
    }
  };

  return (
    <DashboardLayout>
      <PageHeader title="ID Card Design Studio" description="Create and manage professional ID card templates">
        <div className="flex items-center gap-4">
          <div className="w-64">
            <Select onValueChange={applyPreset} defaultValue="cr80-landscape">
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Size Preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cr80-landscape">CR80 Standard (Landscape)</SelectItem>
                <SelectItem value="cr80-portrait">CR80 Standard (Portrait)</SelectItem>
                <SelectItem value="cr79-landscape">CR79 Adhesive (Landscape)</SelectItem>
                <SelectItem value="cr79-portrait">CR79 Adhesive (Portrait)</SelectItem>
                <SelectItem value="cr100-landscape">CR100 Oversize (Landscape)</SelectItem>
                <SelectItem value="cr100-portrait">CR100 Oversize (Portrait)</SelectItem>
                <SelectItem value="business-landscape">Business Card (3.5"x2")</SelectItem>
                <SelectItem value="a7-landscape">A7 Badge (Landscape)</SelectItem>
                <SelectItem value="a7-portrait">A7 Badge (Portrait)</SelectItem>
                <SelectItem value="a4-portrait">A4 Document (Portrait)</SelectItem>
                <SelectItem value="a4-landscape">A4 Document (Landscape)</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

                {/* School Assignment Section */}
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
      </PageHeader>

      <div className="h-[calc(100vh-200px)]">
        <CanvasEditor onSave={handleEditorSave} width={cardWidth} height={cardHeight} />
      </div>
    </DashboardLayout>
  );
}
