
import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Download, Loader2, Printer, CheckCircle, Upload } from 'lucide-react';
import jsPDF from 'jspdf';
import * as fabric from 'fabric';

export default function IDCards() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [withBorder, setWithBorder] = useState(false);
  const [bulkPhotos, setBulkPhotos] = useState<Map<string, File>>(new Map());

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(students.map(s => s.id));
    } else {
      setSelectedStudents([]);
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

        await new Promise<void>((resolve) => {
          canvas.loadFromJSON(template.front_design, () => {
            canvas.setWidth(widthPx);
            canvas.setHeight(heightPx);
            resolve();
          });
        });

        // 1. Text Replacement
        const objects = canvas.getObjects();
        objects.forEach((obj: any) => {
          // Check for placeholder text {{key}}
          if (obj.type === 'i-text' && obj.text?.includes('{{') && obj.text?.includes('}}')) {
            // Simple regex replace for all keys in the text
            let newText = obj.text.replace(/{{(.*?)}}/g, (match: string, key: string) => {
              const cleanKey = key.trim();
              return student[cleanKey] || match; // Keep placeholder if no data
            });
            obj.set({ text: newText });
          }
          // Use 'key' meta property if set (for stable placeholders)
          if (obj.data?.key) {
            const val = student[obj.data.key];
            if (val) obj.set({ text: val });
          }
        });

        // 2. Photo Replacement
        // Find the placeholder object
        const photoPlaceholder = objects.find((obj: any) => obj.data?.isPhotoPlaceholder || (obj as any).isPhotoPlaceholder);

        if (photoPlaceholder) {
          try {
            let imgUrl = student.photo_url;
            let isFile = false;

            // If no DB URL, check bulk photos
            if (!imgUrl && bulkPhotos.size > 0) {
              // Try exact roll number match
              const rollKey = student.roll_number?.toLowerCase().trim();
              if (rollKey && bulkPhotos.has(rollKey)) {
                const file = bulkPhotos.get(rollKey);
                if (file) {
                  imgUrl = URL.createObjectURL(file);
                  isFile = true;
                }
              }
            }

            // Fallback default avatar if needed (optional)
            // if (!imgUrl) imgUrl = '...';

            if (imgUrl) {
              const imgElement = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous'; // Important for CORS if using external URLs
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

              // Calculate center of placeholder
              const centerX = phLeft + (phWidth / 2);
              const centerY = phTop + (phHeight / 2);

              // Scale image to cover placeholder area
              const scaleX = phWidth / fabricImage.width!;
              const scaleY = phHeight / fabricImage.height!;
              const scale = Math.max(scaleX, scaleY); // 'Cover' fit

              fabricImage.set({
                left: centerX,
                top: centerY,
                originX: 'center',
                originY: 'center',
                scaleX: scale,
                scaleY: scale,
                clipPath: new fabric.Rect({
                  left: 0,
                  top: 0,
                  width: phWidth / scale, // Inverse scale for clip path
                  height: phHeight / scale,
                  originX: 'center',
                  originY: 'center',
                })
              });

              // Replace placeholder with actual image
              canvas.remove(photoPlaceholder);
              canvas.add(fabricImage);

              if (isFile) URL.revokeObjectURL(imgUrl); // Cleanup blob URL
            }
          } catch (err) {
            console.warn(`Could not load photo for student ${student.name}`, err);
          }
        }

        canvas.renderAll();

        // 4. Render to Image -> PDF
        const imgData = canvas.toDataURL({ format: 'png', multiplier: 1 });
        doc.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);

        // Add Border if selected
        if (withBorder) {
          doc.setLineWidth(0.5);
          doc.setDrawColor(0, 0, 0); // Black border
          doc.rect(0, 0, widthMm, heightMm);
        }

        canvas.dispose(); // Dispose canvas after each use
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
        <Button
          className="gradient-primary gap-2"
          onClick={generateCards}
          disabled={isGenerating || selectedStudents.length === 0 || !selectedTemplate}
        >
          {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Printer className="h-4 w-4" />}
          Generate PDF
        </Button>
      </PageHeader>

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
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Select Students</CardTitle>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectedStudents.length === students.length && students.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="cursor-pointer">Select All</Label>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto pt-0">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="animate-spin h-8 w-8 text-primary" />
                </div>
              ) : students.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {students.map(student => (
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
