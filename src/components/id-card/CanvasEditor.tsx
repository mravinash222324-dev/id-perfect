import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Type, Image, Square, Circle, QrCode, User, Calendar, Hash, Droplets,
  GraduationCap, Building, Trash2, Copy, Layers, ChevronUp, ChevronDown,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Save, Upload,
  Grid3X3, Eye, EyeOff,
} from 'lucide-react';

interface CanvasEditorProps {
  onSave?: (data: { front_design: any; back_design: any }) => void;
  width?: number;
  height?: number;
}

const SAMPLE_STUDENT = {
  name: 'John Doe', roll_number: 'STU2024001', class: '10th Grade',
  department: 'Science', batch: '2024-2025', dob: '2008-05-15',
  blood_group: 'O+', guardian_name: 'Jane Doe',
};

const PLACEHOLDER_FIELDS = [
  { key: '{{name}}', label: 'Student Name', icon: User },
  { key: '{{roll_number}}', label: 'Roll Number', icon: Hash },
  { key: '{{class}}', label: 'Class', icon: GraduationCap },
  { key: '{{department}}', label: 'Department', icon: Building },
  { key: '{{batch}}', label: 'Batch', icon: Calendar },
  { key: '{{dob}}', label: 'Date of Birth', icon: Calendar },
  { key: '{{blood_group}}', label: 'Blood Group', icon: Droplets },
  { key: '{{guardian_name}}', label: 'Guardian Name', icon: User },
];

const FONT_FAMILIES = ['Inter', 'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana'];

export function CanvasEditor({ onSave, width = 1011, height = 638 }: CanvasEditorProps) {
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);
  const [frontCanvas, setFrontCanvas] = useState<fabric.Canvas | null>(null);
  const [backCanvas, setBackCanvas] = useState<fabric.Canvas | null>(null);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('Inter');
  const [fontColor, setFontColor] = useState('#000000');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [opacity, setOpacity] = useState(100);

  const activeCanvas = activeSide === 'front' ? frontCanvas : backCanvas;

  useEffect(() => {
    if (!frontCanvasRef.current || !backCanvasRef.current) return;
    const front = new fabric.Canvas(frontCanvasRef.current, { width, height, backgroundColor: '#ffffff', selection: true, preserveObjectStacking: true });
    const back = new fabric.Canvas(backCanvasRef.current, { width, height, backgroundColor: '#ffffff', selection: true, preserveObjectStacking: true });
    setFrontCanvas(front);
    setBackCanvas(back);
    return () => { front.dispose(); back.dispose(); };
  }, [width, height]);

  useEffect(() => {
    if (!activeCanvas) return;
    const handleSelection = () => {
      const selected = activeCanvas.getActiveObject();
      setSelectedObject(selected || null);
      if (selected?.type === 'textbox') {
        const t = selected as fabric.Textbox;
        setFontSize(t.fontSize || 24);
        setFontFamily(t.fontFamily || 'Inter');
        setFontColor(t.fill as string || '#000000');
        setIsBold(t.fontWeight === 'bold');
        setIsItalic(t.fontStyle === 'italic');
        setIsUnderline(t.underline || false);
        setOpacity((t.opacity || 1) * 100);
      }
    };
    activeCanvas.on('selection:created', handleSelection);
    activeCanvas.on('selection:updated', handleSelection);
    activeCanvas.on('selection:cleared', () => setSelectedObject(null));
    return () => { activeCanvas.off('selection:created'); activeCanvas.off('selection:updated'); activeCanvas.off('selection:cleared'); };
  }, [activeCanvas]);

  const addText = (placeholder?: string) => {
    if (!activeCanvas) return;
    const text = new fabric.Textbox(placeholder || 'Double-click to edit', { left: 100, top: 100, fontSize: 24, fontFamily: 'Inter', fill: placeholder ? '#1e40af' : '#000000', width: 200 });
    if (placeholder) { (text as any).isPlaceholder = true; (text as any).placeholderKey = placeholder; }
    activeCanvas.add(text);
    activeCanvas.setActiveObject(text);
    activeCanvas.renderAll();
    toast.success('Text added');
  };

  const addPlaceholder = (field: typeof PLACEHOLDER_FIELDS[0]) => addText(field.key);

  const addImage = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !activeCanvas) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const img = await fabric.Image.fromURL(ev.target?.result as string);
        img.scaleToWidth(150);
        img.set({ left: 100, top: 100 });
        activeCanvas.add(img);
        activeCanvas.setActiveObject(img);
        activeCanvas.renderAll();
        toast.success('Image added');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const addPhotoPlaceholder = () => {
    if (!activeCanvas) return;
    const rect = new fabric.Rect({ width: 120, height: 150, fill: '#f3f4f6', stroke: '#3b82f6', strokeWidth: 2, strokeDashArray: [5, 5], rx: 8, ry: 8 });
    const text = new fabric.Text('{{photo}}', { fontSize: 14, fontFamily: 'Inter', fill: '#6b7280', originX: 'center', originY: 'center', left: 60, top: 75 });
    const group = new fabric.Group([rect, text], { left: 100, top: 100 });
    (group as any).isPhotoPlaceholder = true;
    activeCanvas.add(group);
    activeCanvas.setActiveObject(group);
    activeCanvas.renderAll();
    toast.success('Photo placeholder added');
  };

  const addRectangle = () => { if (!activeCanvas) return; const r = new fabric.Rect({ left: 100, top: 100, width: 150, height: 100, fill: '#e5e7eb', stroke: '#9ca3af', strokeWidth: 1, rx: 8, ry: 8 }); activeCanvas.add(r); activeCanvas.setActiveObject(r); activeCanvas.renderAll(); };
  const addCircle = () => { if (!activeCanvas) return; const c = new fabric.Circle({ left: 100, top: 100, radius: 50, fill: '#e5e7eb', stroke: '#9ca3af', strokeWidth: 1 }); activeCanvas.add(c); activeCanvas.setActiveObject(c); activeCanvas.renderAll(); };
  const addQRPlaceholder = () => { if (!activeCanvas) return; const r = new fabric.Rect({ width: 80, height: 80, fill: '#f9fafb', stroke: '#d1d5db', strokeWidth: 1 }); const t = new fabric.Text('QR', { fontSize: 16, fontFamily: 'Inter', fill: '#6b7280', originX: 'center', originY: 'center', left: 40, top: 40 }); const g = new fabric.Group([r, t], { left: 100, top: 100 }); (g as any).isQRPlaceholder = true; activeCanvas.add(g); activeCanvas.setActiveObject(g); activeCanvas.renderAll(); };

  const deleteSelected = () => { if (!activeCanvas || !selectedObject) return; activeCanvas.remove(selectedObject); setSelectedObject(null); activeCanvas.renderAll(); };
  const duplicateSelected = async () => { if (!activeCanvas || !selectedObject) return; const c = await selectedObject.clone(); c.set({ left: (selectedObject.left || 0) + 20, top: (selectedObject.top || 0) + 20 }); activeCanvas.add(c); activeCanvas.setActiveObject(c); activeCanvas.renderAll(); };
  const bringForward = () => { if (!activeCanvas || !selectedObject) return; activeCanvas.bringObjectForward(selectedObject); activeCanvas.renderAll(); };
  const sendBackward = () => { if (!activeCanvas || !selectedObject) return; activeCanvas.sendObjectBackwards(selectedObject); activeCanvas.renderAll(); };

  const updateTextStyle = (prop: string, val: any) => { if (!activeCanvas || !selectedObject || selectedObject.type !== 'textbox') return; (selectedObject as fabric.Textbox).set(prop as any, val); activeCanvas.renderAll(); };
  const alignText = (a: 'left' | 'center' | 'right') => updateTextStyle('textAlign', a);

  const uploadBackground = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !activeCanvas) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const img = await fabric.Image.fromURL(ev.target?.result as string);
        const scale = Math.max(width / (img.width || 1), height / (img.height || 1));
        img.scale(scale);
        img.set({ left: 0, top: 0, selectable: false, evented: false });
        activeCanvas.getObjects().forEach(o => { if ((o as any).isBackground) activeCanvas.remove(o); });
        (img as any).isBackground = true;
        activeCanvas.add(img);
        activeCanvas.sendObjectToBack(img);
        activeCanvas.renderAll();
        toast.success('Background uploaded');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const togglePreview = () => {
    if (!activeCanvas) return;
    activeCanvas.getObjects().forEach(obj => {
      if ((obj as any).isPlaceholder && obj.type === 'textbox') {
        const t = obj as fabric.Textbox;
        const k = (obj as any).placeholderKey;
        if (!previewMode) { (obj as any).originalText = t.text; t.set('text', SAMPLE_STUDENT[k.replace(/[{}]/g, '') as keyof typeof SAMPLE_STUDENT] || k); }
        else { t.set('text', (obj as any).originalText || k); }
      }
    });
    setPreviewMode(!previewMode);
    activeCanvas.renderAll();
  };

  const handleSave = () => {
    if (!frontCanvas || !backCanvas) return;
    const filter = (c: fabric.Canvas) => { const j = c.toJSON(); (j as any).objects = ((j as any).objects || []).filter((o: any) => !o.excludeFromExport); return j; };
    onSave?.({ front_design: filter(frontCanvas), back_design: filter(backCanvas) });
  };

  return (
    <div className="flex h-full gap-4 bg-muted/30 p-4 rounded-xl">
      <div className="w-64 bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b bg-muted/50"><h3 className="font-semibold text-sm">Elements</h3></div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Basic</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => addText()} className="h-16 flex-col gap-1"><Type className="h-5 w-5" /><span className="text-xs">Text</span></Button>
                <Button variant="outline" size="sm" onClick={addImage} className="h-16 flex-col gap-1"><Image className="h-5 w-5" /><span className="text-xs">Image</span></Button>
                <Button variant="outline" size="sm" onClick={addRectangle} className="h-16 flex-col gap-1"><Square className="h-5 w-5" /><span className="text-xs">Rectangle</span></Button>
                <Button variant="outline" size="sm" onClick={addCircle} className="h-16 flex-col gap-1"><Circle className="h-5 w-5" /><span className="text-xs">Circle</span></Button>
              </div>
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Dynamic Fields</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={addPhotoPlaceholder} className="h-16 flex-col gap-1"><User className="h-5 w-5" /><span className="text-xs">Photo</span></Button>
                <Button variant="outline" size="sm" onClick={addQRPlaceholder} className="h-16 flex-col gap-1"><QrCode className="h-5 w-5" /><span className="text-xs">QR Code</span></Button>
              </div>
              <div className="mt-2 space-y-1">
                {PLACEHOLDER_FIELDS.map((f) => (<Button key={f.key} variant="ghost" size="sm" onClick={() => addPlaceholder(f)} className="w-full justify-start h-8 text-xs"><f.icon className="h-3.5 w-3.5 mr-2" />{f.label}</Button>))}
              </div>
            </div>
            <Separator />
            <div><Label className="text-xs text-muted-foreground mb-2 block">Background</Label><Button variant="outline" size="sm" onClick={uploadBackground} className="w-full"><Upload className="h-4 w-4 mr-2" />Upload Background</Button></div>
          </div>
        </ScrollArea>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <Tabs value={activeSide} onValueChange={(v) => setActiveSide(v as 'front' | 'back')} className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <TabsList><TabsTrigger value="front">Front Side</TabsTrigger><TabsTrigger value="back">Back Side</TabsTrigger></TabsList>
            <div className="flex items-center gap-2">
              <Button variant={previewMode ? "default" : "outline"} size="sm" onClick={togglePreview}>{previewMode ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}{previewMode ? 'Edit' : 'Preview'}</Button>
              <Button onClick={handleSave} className="gradient-primary"><Save className="h-4 w-4 mr-1" />Save Design</Button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-muted/50 rounded-xl p-4 overflow-auto">
            <TabsContent value="front" className="m-0"><div className="bg-white rounded-lg shadow-xl border" style={{ width, height }}><canvas ref={frontCanvasRef} /></div></TabsContent>
            <TabsContent value="back" className="m-0"><div className="bg-white rounded-lg shadow-xl border" style={{ width, height }}><canvas ref={backCanvasRef} /></div></TabsContent>
          </div>
        </Tabs>
      </div>
      <div className="w-72 bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b bg-muted/50"><h3 className="font-semibold text-sm">Properties</h3></div>
        <ScrollArea className="flex-1 p-4">
          {selectedObject ? (
            <div className="space-y-4">
              <div className="flex gap-2"><Button variant="outline" size="sm" onClick={duplicateSelected} className="flex-1"><Copy className="h-4 w-4 mr-1" />Duplicate</Button><Button variant="destructive" size="sm" onClick={deleteSelected} className="flex-1"><Trash2 className="h-4 w-4 mr-1" />Delete</Button></div>
              <div><Label className="text-xs text-muted-foreground mb-2 block">Layer</Label><div className="flex gap-2"><Button variant="outline" size="sm" onClick={bringForward} className="flex-1"><ChevronUp className="h-4 w-4 mr-1" />Forward</Button><Button variant="outline" size="sm" onClick={sendBackward} className="flex-1"><ChevronDown className="h-4 w-4 mr-1" />Back</Button></div></div>
              <Separator />
              {selectedObject.type === 'textbox' && (<>
                <div><Label className="text-xs text-muted-foreground mb-2 block">Font</Label><Select value={fontFamily} onValueChange={(v) => { setFontFamily(v); updateTextStyle('fontFamily', v); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FONT_FAMILIES.map(f => (<SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>))}</SelectContent></Select></div>
                <div><Label className="text-xs text-muted-foreground mb-2 block">Size: {fontSize}px</Label><Slider value={[fontSize]} min={8} max={72} step={1} onValueChange={([v]) => { setFontSize(v); updateTextStyle('fontSize', v); }} /></div>
                <div><Label className="text-xs text-muted-foreground mb-2 block">Color</Label><div className="flex gap-2"><Input type="color" value={fontColor} onChange={(e) => { setFontColor(e.target.value); updateTextStyle('fill', e.target.value); }} className="w-12 h-9 p-1" /><Input value={fontColor} onChange={(e) => { setFontColor(e.target.value); updateTextStyle('fill', e.target.value); }} className="flex-1" /></div></div>
                <div><Label className="text-xs text-muted-foreground mb-2 block">Style</Label><div className="flex gap-1"><Button variant={isBold ? "default" : "outline"} size="sm" onClick={() => { setIsBold(!isBold); updateTextStyle('fontWeight', !isBold ? 'bold' : 'normal'); }}><Bold className="h-4 w-4" /></Button><Button variant={isItalic ? "default" : "outline"} size="sm" onClick={() => { setIsItalic(!isItalic); updateTextStyle('fontStyle', !isItalic ? 'italic' : 'normal'); }}><Italic className="h-4 w-4" /></Button><Button variant={isUnderline ? "default" : "outline"} size="sm" onClick={() => { setIsUnderline(!isUnderline); updateTextStyle('underline', !isUnderline); }}><Underline className="h-4 w-4" /></Button></div></div>
                <div><Label className="text-xs text-muted-foreground mb-2 block">Align</Label><div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => alignText('left')}><AlignLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => alignText('center')}><AlignCenter className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => alignText('right')}><AlignRight className="h-4 w-4" /></Button></div></div>
              </>)}
              <div><Label className="text-xs text-muted-foreground mb-2 block">Opacity: {opacity}%</Label><Slider value={[opacity]} min={0} max={100} step={1} onValueChange={([v]) => { setOpacity(v); selectedObject.set('opacity', v / 100); activeCanvas?.renderAll(); }} /></div>
            </div>
          ) : (<div className="text-center text-muted-foreground py-8"><Layers className="h-12 w-12 mx-auto mb-3 opacity-50" /><p className="text-sm">Select an element to edit</p></div>)}
        </ScrollArea>
      </div>
    </div>
  );
}
