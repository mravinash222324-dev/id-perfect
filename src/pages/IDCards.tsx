
import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Download, Loader2, Printer, CheckCircle, Upload, Eye, X, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import jsPDF from 'jspdf';
import * as fabric from 'fabric';

export default function IDCards() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [bulkPhotos, setBulkPhotos] = useState<Map<string, File>>(new Map());
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewOverrides, setReviewOverrides] = useState<Map<string, any>>(new Map());
  const [withBorder, setWithBorder] = useState(false);

  // Handle Bulk Photo Selection
  const handleBulkPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileMap = new Map<string, File>();
      Array.from(e.target.files).forEach(file => {
        // Normalize filename: remove extension, lower case for flexible matching
        const name = file.name.split('.')[0].toLowerCase().trim();
        fileMap.set(name, file);
      });
      setBulkPhotos(fileMap);
      toast.success(`Loaded ${fileMap.size} photos ready for matching`);
    }
  };

  // Fetch Templates & Students

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templatesRes, studentsRes] = await Promise.all([
          supabase.from('id_templates').select('*').eq('status', 'active'),
          supabase.from('students').select('*').order('roll_number')
        ]);

        if (studentsRes.error) throw studentsRes.error;

        // Load local templates
        const localTemplates = JSON.parse(localStorage.getItem('id_templates_local') || '[]');
        const dbTemplates = templatesRes.data || [];

        // Merge without duplicates (if any)
        const mergedTemplates = [...dbTemplates, ...localTemplates];

        setTemplates(mergedTemplates);
        setStudents(studentsRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load initial data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Derive filters
  const uniqueClasses = Array.from(new Set(students.map(s => s.class).filter(Boolean)));
  const uniqueBatches = Array.from(new Set(students.map(s => s.batch).filter(Boolean)));

  const filteredStudents = students.filter(s => {
    const matchClass = selectedClass === 'all' || s.class === selectedClass;
    const matchBatch = selectedBatch === 'all' || s.batch === selectedBatch;
    return matchClass && matchBatch;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Add all FILTERED students to selection
      const newIds = filteredStudents.map(s => s.id);
      setSelectedStudents(prev => Array.from(new Set([...prev, ...newIds])));
    } else {
      // Remove FILTERED students from selection
      const filteredIds = new Set(filteredStudents.map(s => s.id));
      setSelectedStudents(prev => prev.filter(id => !filteredIds.has(id)));
    }
  };

  const handleStudentSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedStudents(prev => [...prev, id]);
    } else {
      setSelectedStudents(prev => prev.filter(sid => sid !== id));
    }
  };

  const generateCards = async () => {
    if (!selectedTemplate || selectedStudents.length === 0) {
      toast.error('Please select a template and at least one student');
      return;
    }

    setIsGenerating(true);
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return;

    // 1. Calculate Dimensions
    const widthPx = template.card_width || 1011;
    const heightPx = template.card_height || 638;

    // Convert pixels to mm for PDF (assuming 300 DPI)
    // 1 inch = 25.4 mm => pixels / 300 * 25.4
    const widthMm = (widthPx / 300) * 25.4;
    const heightMm = (heightPx / 300) * 25.4;

    const doc = new jsPDF({
      orientation: widthMm > heightMm ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [widthMm, heightMm]
    });

    // 2. Setup hidden canvas for rendering
    const canvasEl = document.createElement('canvas');
    canvasEl.width = widthPx;
    canvasEl.height = heightPx;

    try {
      // Loop through selected students
      for (let i = 0; i < selectedStudents.length; i++) {
        const studentId = selectedStudents[i];
        const student = students.find(s => s.id === studentId);
        if (!student) continue;

        if (i > 0) doc.addPage([widthMm, heightMm]);

        const canvas = new fabric.StaticCanvas(canvasEl);
        const cardOverride = reviewOverrides.get(studentId) || {};

        // --- FRONT SIDE ---
        const frontOverride = cardOverride.front;
        // If override exists, use it. Else use template.
        const frontSource = frontOverride || template.front_design;

        if (frontSource) {
          await canvas.loadFromJSON(frontSource);

          // Only perform replacements if NO override was used (override is already compiled)
          if (!frontOverride) {
            await performReplacements(canvas, student, bulkPhotos);
          }

          canvas.renderAll();
          const imgData = canvas.toDataURL({ format: 'png', multiplier: 1 });
          doc.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);

          if (withBorder) {
            doc.setLineWidth(0.5);
            doc.setDrawColor(0, 0, 0);
            doc.rect(0, 0, widthMm, heightMm);
          }
        }

        // --- BACK SIDE ---
        // Check if template has back design or if there's a back override
        const backSource = cardOverride.back || template.back_design;

        if (backSource) {
          // Add new page for back side
          doc.addPage([widthMm, heightMm]);

          canvas.clear();
          // Reset background if needed, though loadFromJSON usually handles it
          canvas.backgroundColor = '#ffffff';

          await canvas.loadFromJSON(backSource);

          // Only perform replacements if NO override was used
          if (!cardOverride.back) {
            await performReplacements(canvas, student, bulkPhotos);
          }

          canvas.renderAll();
          const imgData = canvas.toDataURL({ format: 'png', multiplier: 1 });
          doc.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);

          if (withBorder) {
            doc.setLineWidth(0.5);
            doc.setDrawColor(0, 0, 0);
            doc.rect(0, 0, widthMm, heightMm);
          }
        }

        canvas.dispose(); // Dispose canvas after use (re-created next loop, or we could reuse)
      }

      // 5. Download
      doc.save(`id_cards_batch_${Date.now()}.pdf`);
      toast.success(`Generated ID cards for ${selectedStudents.length} students`);

    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error('Failed to generate cards: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader title="Generate ID Cards" description="Select template and students to generate print-ready PDFs">
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsReviewOpen(true)}
            disabled={selectedStudents.length === 0 || !selectedTemplate}
          >
            <Eye className="h-4 w-4" />
            Review Batch
          </Button>
          <Button
            className="gradient-primary gap-2"
            onClick={generateCards}
            disabled={isGenerating || selectedStudents.length === 0 || !selectedTemplate}
          >
            {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Printer className="h-4 w-4" />}
            Generate PDF
          </Button>
        </div>
      </PageHeader>

      {/* Review Modal will go here */}
      <BatchReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        students={students.filter(s => selectedStudents.includes(s.id))}
        template={templates.find(t => t.id === selectedTemplate)}
        onSaveOverrides={(overrides) => setReviewOverrides(overrides)}
        initialOverrides={reviewOverrides}
        bulkPhotos={bulkPhotos}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Template</Label>
                <Select onValueChange={setSelectedTemplate} value={selectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length === 0 && !loading && (
                  <p className="text-xs text-destructive">No templates found. Create one in Design Studio.</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="include-border" checked={withBorder} onCheckedChange={(c) => setWithBorder(c as boolean)} />
                <Label htmlFor="include-border">Add Border to PDF</Label>
              </div>

              <div className="space-y-2">
                <Label>Bulk Photos (Optional)</Label>
                <div className="border border-dashed rounded-md p-4 text-center hover:bg-muted/50 transition-colors">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleBulkPhotoSelect}
                    className="hidden"
                    id="bulk-photo-upload"
                  />
                  <Label htmlFor="bulk-photo-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      {bulkPhotos.size > 0 ? (
                        <>
                          <CheckCircle className="h-6 w-6 text-green-500" />
                          <span className="text-sm font-medium text-green-600">{bulkPhotos.size} photos loaded</span>
                          <span className="text-xs text-muted-foreground">Click to change</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-6 w-6 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Upload Student Photos</span>
                          <span className="text-[10px] text-muted-foreground">(Matches Roll No. e.g. "123.jpg")</span>
                        </>
                      )}
                    </div>
                  </Label>
                </div>
              </div>

              <div className="p-4 bg-muted/40 rounded-lg space-y-2">
                <h4 className="font-semibold text-sm">Summary</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Students Selected:</span>
                  <span className="font-medium">{selectedStudents.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Est. Output:</span>
                  <span className="font-medium">{selectedStudents.length} pages</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Student Selection Panel */}
        <div className="lg:col-span-2">
          <Card className="h-full max-h-[600px] flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex flex-row items-center justify-between mb-4">
                <CardTitle className="text-lg">Select Students</CardTitle>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedStudents.includes(s.id))}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="select-all" className="cursor-pointer">Select All</Label>
                </div>
              </div>

              <div className="flex gap-2 mb-2">
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {uniqueClasses.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All Batches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Batches</SelectItem>
                    {uniqueBatches.map((b: any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto pt-0">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="animate-spin h-8 w-8 text-primary" />
                </div>
              ) : filteredStudents.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {filteredStudents.map(student => (
                    <div key={student.id} className="flex items-center space-x-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <Checkbox
                        id={`student-${student.id}`}
                        checked={selectedStudents.includes(student.id)}
                        onCheckedChange={(checked) => handleStudentSelect(student.id, checked as boolean)}
                      />
                      <Label htmlFor={`student-${student.id}`} className="flex-1 flex items-center justify-between cursor-pointer font-normal">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center">
                            {student.photo_url ? (
                              <img src={student.photo_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-primary">{student.name.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.roll_number}</p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {student.class} - {student.department}
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No students found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Helper for Replacements
async function performReplacements(canvas: any, student: any, bulkPhotos: Map<string, File>) {
  const objects = canvas.getObjects();
  // 1. Text Replacement
  objects.forEach((obj: any) => {
    if (obj.type === 'i-text' && obj.text?.includes('{{') && obj.text?.includes('}}')) {
      let newText = obj.text.replace(/{{(.*?)}}/g, (match: string, key: string) => {
        const cleanKey = key.trim();
        const val = student[cleanKey];
        // If value is undefined/null, return empty string or match? 
        // Returning match leaves the placeholder {{key}} which is better for debugging than invisible text.
        // But user said "otherwise it will blank".
        // Let's return empty string if it exists-but-empty, or match if key doesn't exist?
        // Safest: String(val) if val is not null/undefined.
        return (val !== null && val !== undefined) ? String(val) : match;
      });
      obj.set({ text: newText });
    }
    if (obj.data?.key) {
      const val = student[obj.data.key];
      // Force string conversion to prevent Fabric crashes with numbers/null
      const safeVal = (val !== null && val !== undefined) ? String(val) : '';
      // Only update if there is a value, or should we clear it? 
      // If we don't update, it keeps the placeholder/default.
      if (val !== null && val !== undefined) {
        obj.set({ text: safeVal });
      }
    }
  });

  // 2. Photo Replacement
  const photoPlaceholder = objects.find((obj: any) => obj.data?.isPhotoPlaceholder || (obj as any).isPhotoPlaceholder);
  if (photoPlaceholder) {
    try {
      let imgUrl = student.photo_url;
      // let isFile = false; // Disable revocation for debugging

      // Debug Matching
      if (!imgUrl && bulkPhotos.size > 0) {
        const rollKey = student.roll_number?.toLowerCase().trim();
        console.log(`[Photo Match] Trying to match student '${student.name}' (Roll: ${rollKey}) against ${bulkPhotos.size} photos.`);

        if (rollKey && bulkPhotos.has(rollKey)) {
          console.log(`[Photo Match] FOUND match for ${rollKey}`);
          const file = bulkPhotos.get(rollKey);
          if (file) {
            imgUrl = URL.createObjectURL(file);
            // isFile = true;
          }
        } else {
          // To help user debug, log near misses or sample keys
          console.log(`[Photo Match] NO match for ${rollKey}. Sample keys:`, Array.from(bulkPhotos.keys()).slice(0, 3));
        }
      }

      if (imgUrl) {
        const imgElement = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(e);
          img.src = imgUrl!;
        });
        const fabricImage = new fabric.Image(imgElement);
        // Start: Fit image into placeholder logic
        const phWidth = photoPlaceholder.width! * photoPlaceholder.scaleX!;
        const phHeight = photoPlaceholder.height! * photoPlaceholder.scaleY!;
        const phLeft = photoPlaceholder.left!;
        const phTop = photoPlaceholder.top!;

        const centerX = phLeft + (phWidth / 2);
        const centerY = phTop + (phHeight / 2);

        const scaleX = phWidth / fabricImage.width!;
        const scaleY = phHeight / fabricImage.height!;
        const scale = Math.max(scaleX, scaleY);

        fabricImage.set({
          left: centerX, top: centerY, originX: 'center', originY: 'center',
          scaleX: scale, scaleY: scale,
          clipPath: new fabric.Rect({
            left: 0, top: 0, width: phWidth / scale, height: phHeight / scale,
            originX: 'center', originY: 'center',
          })
        });
        canvas.remove(photoPlaceholder);
        canvas.add(fabricImage);
        // if (isFile) URL.revokeObjectURL(imgUrl); // Commented out for debugging
      }
    } catch (err) {
      console.warn(`Could not load photo for student ${student.name}`, err);
    }
  }
}

const BatchReviewModal = ({ isOpen, onClose, students, template, onSaveOverrides, initialOverrides, bulkPhotos }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentStudent = students[currentIndex];

  // Initialize Canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    console.log("Initializing review canvas...");
    // Safety check just in case template is undefined (though isOpen check in parent should handle it)
    const widthPx = template?.card_width || 1011;
    const heightPx = template?.card_height || 638;

    const newCanvas = new fabric.Canvas(canvasRef.current, {
      width: widthPx,
      height: heightPx,
      backgroundColor: '#ffffff',
      selection: true,
      renderOnAddRemove: false // Optimization: manual render
    });

    setCanvas(newCanvas);

    return () => {
      console.log("Disposing review canvas...");
      newCanvas.dispose().then(() => {
        console.log("Canvas disposed.");
      }).catch(err => console.error("Error disposing canvas:", err));
      setCanvas(null);
    };
  }, [isOpen, canvasRef.current, template?.card_width, template?.card_height]);


  // Load Student Data
  useEffect(() => {
    if (!canvas || !currentStudent || !template) return;

    const loadCard = async () => {
      canvas.clear();
      canvas.backgroundColor = '#ffffff';

      // Determine which source to use: override or template
      // Structure of reviewOverrides: map(studentId -> { front: json, back: json })
      const studentOverrides = initialOverrides.get(currentStudent.id) || {};
      const overrideJson = activeSide === 'front' ? studentOverrides.front : studentOverrides.back;

      const templateJson = activeSide === 'front' ? template.front_design : template.back_design;

      // If no template for this side (e.g. back is empty), just clear
      if (!overrideJson && !templateJson) {
        canvas.requestRenderAll();
        return;
      }

      const sourceJson = overrideJson || templateJson;
      console.log("Loading JSON source for side:", activeSide, sourceJson ? "Found" : "Missing");

      if (!sourceJson) {
        console.warn("No design found for", activeSide);
        canvas.requestRenderAll();
        return;
      }

      try {
        await canvas.loadFromJSON(sourceJson);
        console.log("Canvas loaded from JSON successfully.");
      } catch (err) {
        console.error("Failed to load canvas from JSON:", err);
        // Fallback or alert?
        toast.error("Error loading design template");
      }

      // If it was an override, it's already "baked" with data.
      // If it is the template, we need to replace placeholders.
      if (!overrideJson) {
        await performReplacements(canvas, currentStudent, bulkPhotos);
      } else {
        console.log("Using override, skipping replacements.");
      }

      canvas.requestRenderAll();
    };

    loadCard();

  }, [currentIndex, canvas, currentStudent, template, activeSide]);


  const handleSaveCurrent = () => {
    if (!canvas || !currentStudent) return;
    const json = canvas.toObject(['data', 'isPhotoPlaceholder', 'isPlaceholder', 'id', 'selectable']);

    // Get existing overrides for this student
    const existingStudentOverrides = initialOverrides.get(currentStudent.id) || {};

    // Create new override object merging existing with new
    const updatedStudentOverrides = {
      ...existingStudentOverrides,
      [activeSide]: json
    };

    const newOverrides = new Map(initialOverrides);
    newOverrides.set(currentStudent.id, updatedStudentOverrides);
    onSaveOverrides(newOverrides);
    toast.success(`Saved ${activeSide} side for ${currentStudent.name}`);
  };

  const nextStudent = () => {
    // Auto-save? Maybe optional.
    if (currentIndex < students.length - 1) setCurrentIndex(prev => prev + 1);
  };

  const prevStudent = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  // Keyboard nav
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextStudent();
      if (e.key === 'ArrowLeft') prevStudent();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <DialogTitle>Review ID Cards ({currentIndex + 1} / {students.length})</DialogTitle>
            <DialogDescription className="text-sm font-medium text-muted-foreground">{currentStudent?.name} - {currentStudent?.roll_number}</DialogDescription>
          </div>
          <div className="flex gap-2">
            <Tabs value={activeSide} onValueChange={(v) => setActiveSide(v as any)} className="mr-4">
              <TabsList>
                <TabsTrigger value="front">Front</TabsTrigger>
                <TabsTrigger value="back">Back</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button variant="outline" size="sm" onClick={handleSaveCurrent}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 bg-gray-100 flex items-center justify-center p-8 overflow-hidden">
          <div className="shadow-2xl bg-white" style={{ transform: 'scale(0.8)' }}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        <div className="p-4 border-t flex justify-between items-center bg-white">
          <Button variant="ghost" onClick={prevStudent} disabled={currentIndex === 0}>
            <ChevronLeft className="w-4 h-4 mr-2" /> Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            Use arrow keys to navigate. Click text to edit. Drag photo to adjust.
          </div>

          <Button variant="ghost" onClick={nextStudent} disabled={currentIndex === students.length - 1}>
            Next <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
