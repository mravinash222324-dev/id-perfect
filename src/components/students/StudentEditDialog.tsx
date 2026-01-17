import { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CreditCard, AlignLeft, AlignCenter, AlignRight, Bold } from 'lucide-react';
import { performReplacements } from '@/utils/cardRenderer';
import * as fabric from 'fabric';

interface StudentEditDialogProps {
    student: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export function StudentEditDialog({ student, open, onOpenChange, onSave }: StudentEditDialogProps) {
    const [formData, setFormData] = useState<any>(student || {});
    const [loading, setLoading] = useState(false);
    const [template, setTemplate] = useState<any>(null);
    const [zoomLevel, setZoomLevel] = useState(0.6);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null);

    useEffect(() => {
        if (student) {
            setFormData(student);
            fetchTemplate(student.school_id);
        }
    }, [student]);

    // Initialize Canvas
    useEffect(() => {
        if (!open || !canvasRef.current) return;

        // Dispose prev if exists
        if (fabricCanvasRef.current) {
            fabricCanvasRef.current.dispose();
        }

        const canvas = new fabric.Canvas(canvasRef.current, {
            preserveObjectStacking: true,
            selection: true,
            renderOnAddRemove: false // OPTIMIZATION: Manual render only
        });
        fabricCanvasRef.current = canvas;

        // Load design if template ready
        if (template && formData) {
            loadCanvasDesign();
        }

        return () => {
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.dispose();
                fabricCanvasRef.current = null;
            }
        }
    }, [open, template]); // Re-init if template loads (or open changes)

    // Watch form data changes to update canvas text
    useEffect(() => {
        if (fabricCanvasRef.current && template) {
            // Re-run replacements on existing objects to update text
            performReplacements(fabricCanvasRef.current, formData).then(() => {
                fabricCanvasRef.current?.requestRenderAll();
            });
        }
    }, [formData]);

    const fetchTemplate = async (schoolId: string) => {
        if (!schoolId) return;
        const { data } = await supabase
            .from('id_templates')
            .select('*')
            .contains('assigned_schools', [schoolId]);

        if (data && data.length > 0) {
            setTemplate(data[0]);
        }
    };

    const loadCanvasDesign = async () => {
        if (!fabricCanvasRef.current || !template) return;

        const canvas = fabricCanvasRef.current;
        let designSource = null;

        // 1. Check for Student Override
        if (formData.design_overrides) {
            designSource = formData.design_overrides;
        } else {
            // 2. Fallback to Template
            // Legacy unwrap logic
            let design = (template as any).front_design;
            if (design?.front_design) design = design.front_design;
            designSource = design;
        }

        if (!designSource) return;

        // Set dimensions (visual scaling handled by CSS, logic dimensions match template)
        const width = template.card_width || 1011;
        const height = template.card_height || 638;
        canvas.setDimensions({ width, height });

        // Load
        setTimeout(async () => {
            try {
                // If source is string, parse
                let src = designSource;
                if (typeof src === 'string') src = JSON.parse(src);

                await canvas.loadFromJSON(src);

                // Initial Replacement
                // Initial Replacement
                await performReplacements(canvas, formData);

                // Upgrade I-Text to Textbox for wrapping & Unlock objects
                const objects = canvas.getObjects();
                const replacements: { old: fabric.Object, new: fabric.Object }[] = [];

                objects.forEach((obj) => {
                    let targetObj = obj;

                    // Upgrade i-text to textbox if it's not already
                    if (obj.type === 'i-text') {
                        // Convert to Textbox
                        const textObj = obj as fabric.IText;

                        // Manually copy properties to avoid TS issues with toObject types
                        const textbox = new fabric.Textbox(textObj.text || '', {
                            left: textObj.left,
                            top: textObj.top,
                            width: textObj.width || 100, // Reset width or keep?
                            height: textObj.height,
                            scaleX: textObj.scaleX,
                            scaleY: textObj.scaleY,
                            fill: textObj.fill,
                            fontSize: textObj.fontSize,
                            fontFamily: textObj.fontFamily,
                            fontWeight: textObj.fontWeight,
                            fontStyle: textObj.fontStyle,
                            originX: textObj.originX,
                            originY: textObj.originY,
                            textAlign: textObj.textAlign,
                            data: (textObj as any).data,
                            splitByGrapheme: false, // Normal word wrap
                        });
                        replacements.push({ old: obj, new: textbox });
                        targetObj = textbox;
                    }

                    // Unlock
                    if (targetObj.type === 'i-text' || targetObj.type === 'image' || targetObj.type === 'text' || targetObj.type === 'textbox') {
                        targetObj.set({
                            selectable: true,
                            hasControls: true,
                            hasBorders: true,
                            lockMovementX: false,
                            lockMovementY: false,
                            lockScalingX: false, // Allow resize
                            lockScalingY: false,
                            lockUniScaling: false // Allow changing aspect ratio for textbox (width vs height)
                        });
                    }
                });

                // Apply replacements
                replacements.forEach(rep => {
                    canvas.remove(rep.old);
                    canvas.add(rep.new);
                });

                // Attach Event Listeners for 2-Way Sync
                canvas.on('text:changed', (e) => {
                    const obj = e.target;
                    if (!obj) return;

                    // Identify the key mapped to this object
                    const key = (obj as any).data?.key || (obj as any).key;

                    // Or try to infer from text {{key}} pattern if still present (unlikely after replace)
                    if (key && formData.hasOwnProperty(key)) {
                        // Update form data without triggering the useEffect loop endlessly
                        // We need a way to setFormData without triggering re-render of canvas text
                        // But setFormData WILL trigger useEffect.
                        // We can add a flag or check equality in useEffect.
                        setFormData((prev: any) => ({
                            ...prev,
                            [key]: (obj as any).text
                        }));
                    }
                });

                canvas.renderAll();
            } catch (e) {
                console.error("Error loading design", e);
                toast.error("Could not load card design");
            }
        }, 10);
    };

    const addText = () => {
        if (!fabricCanvasRef.current) return;
        const textbox = new fabric.Textbox('New Text', {
            left: 50,
            top: 50,
            width: 200,
            fontSize: 20,
            fill: 'black',
            selectable: true,
            hasControls: true
        });
        fabricCanvasRef.current.add(textbox);
        fabricCanvasRef.current.setActiveObject(textbox);
        fabricCanvasRef.current.requestRenderAll();
        // toast.success("Added new text box"); // Remove toast to avoid spam
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const modifyAppularSelection = (property: string, value: string) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const activeObject = canvas.getActiveObject();
        if (!activeObject) {
            toast.error("Please select a text element first");
            return;
        }

        // Handle bold toggle specially
        if (property === 'fontWeight' && value === 'bold') {
            const current = (activeObject as any).fontWeight;
            (activeObject as any).set('fontWeight', current === 'bold' ? 'normal' : 'bold');
        } else {
            // Apply other properties directly
            (activeObject as any).set(property, value);
        }

        canvas.requestRenderAll();
        // Since we modified spacing/font, we might want to verify bounds, but Fabric handles this well.
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${student.id}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('student-photos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('student-photos')
                .getPublicUrl(filePath);

            setFormData({ ...formData, photo_url: publicUrl }); // Update local form
            toast.success("Photo uploaded to preview");
        } catch (err: any) {
            console.error(err);
            toast.error("Photo upload failed: " + (err.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);

        // Capture specific design state (position, scale of elements)
        let designOverrides = null;
        if (fabricCanvasRef.current) {
            // We save the entire canvas state as the override for this student
            // This includes their specific layout tweaks
            designOverrides = fabricCanvasRef.current.toObject(['data', 'id', 'selectable', 'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY', 'originalFontSize']);
            // Note: toJSON saves the CURRENT text content. 
            // If we want to keep "variables" dynamic later, this might be an issue if we re-render this overrides JSON.
            // But our performReplacements replaces text based on {{keys}} or data.keys.
            // Fabric's toJSON preserves 'data' properties. 
            // So when we load this back, performReplacements will see 'data.key' and update the text again with potentially new data. 
            // So it should work fine!
        }

        try {
            const { error } = await supabase
                .from('students')
                .update({
                    name: formData.name,
                    roll_number: formData.roll_number,
                    class: formData.class,
                    department: formData.department,
                    blood_group: formData.blood_group,
                    phone: formData.phone,
                    email: formData.email,
                    photo_url: formData.photo_url,
                    address: formData.address,
                    address_font_size: formData.address_font_size, // Keep this legacy field or clear it?
                    design_overrides: designOverrides
                })
                .eq('id', student.id);

            if (error) throw error;
            toast.success("Student updated");
            onSave();
            onOpenChange(false);
        } catch (err: any) {
            console.error(err);
            toast.error("Update failed");
        } finally {
            setLoading(false);
        }
    };

    // Zoom Wheel Handler (Touchpad support) - Native Listener for Passive control
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault(); // PREVENT BROWSER ZOOM
                e.stopPropagation();

                const delta = e.deltaY;
                const sensitivity = 0.005;
                const zoomStep = delta * sensitivity;

                setZoomLevel(prev => {
                    const newZoom = prev - zoomStep;
                    return Math.min(Math.max(newZoom, 0.1), 3.0);
                });
            }
        };

        // Must be passive: false to allow preventDefault
        container.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, [open]); // Re-attach when dialog opens

    const formatLabel = (key: string) => {
        return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const ignoredKeys = ['id', 'created_at', 'school_id', 'print_batch_id', 'design_overrides', 'photo_url', 'verification_status', 'address_font_size', 'updated_at', 'submitted_at'];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] h-[95vh] flex flex-col p-4 outline-none">
                <DialogHeader>
                    <DialogTitle>Edit Student & Customize Layout</DialogTitle>
                </DialogHeader>

                <div className="flex flex-1 gap-6 overflow-hidden min-h-0">

                    {/* Preview - Interactive Canvas (Now Left/Main) */}
                    <div
                        ref={containerRef}
                        className="flex-1 bg-black/20 rounded-xl p-6 border border-white/10 flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-sm"
                    >
                        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
                            <div className="glass p-2 rounded-xl shadow-sm pointer-events-auto flex items-center gap-2 border border-white/10">
                                <strong>Tools:</strong>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => modifyAppularSelection('textAlign', 'left')} title="Align Left"><AlignLeft className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => modifyAppularSelection('textAlign', 'center')} title="Align Center"><AlignCenter className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => modifyAppularSelection('textAlign', 'right')} title="Align Right"><AlignRight className="h-4 w-4" /></Button>
                                <div className="w-px h-4 bg-gray-300 mx-1" />
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => modifyAppularSelection('fontWeight', 'bold')} title="Bold"><Bold className="h-4 w-4" /></Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs ml-2" onClick={addText}>+ Text</Button>
                            </div>
                            <div className="flex gap-2 pointer-events-auto">
                                <Button size="sm" variant="secondary" onClick={() => setZoomLevel(Math.max(0.1, zoomLevel - 0.1))} className="shadow-lg">-</Button>
                                <span className="glass px-2 py-1 rounded-md text-sm min-w-[3rem] text-center flex items-center justify-center shadow-lg border border-white/10 font-mono">
                                    {Math.round(zoomLevel * 100)}%
                                </span>
                                <Button size="sm" variant="secondary" onClick={() => setZoomLevel(Math.min(3.0, zoomLevel + 0.1))} className="shadow-lg">+</Button>
                                <Button size="sm" variant="outline" onClick={() => setZoomLevel(0.6)} className="shadow-lg glass border-white/10 hover:bg-white/10">Reset</Button>
                            </div>
                        </div>
                        <div className="w-full h-full overflow-auto flex items-center justify-center custom-scrollbar">
                            {/* Wrapper to scale canvas to fit screen if needed */}
                            <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center', transition: 'transform 0.05s ease-out' }}>
                                <canvas ref={canvasRef} />
                            </div>
                        </div>
                    </div>

                    {/* Form - Scrollable (Right Panel) */}
                    <div className="w-[350px] space-y-4 overflow-y-auto pl-2 border-l border-white/10 pr-2">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase">Student Details</h3>
                            {Object.keys(formData).map((key) => {
                                if (ignoredKeys.includes(key)) return null;
                                return (
                                    <div key={key} className="space-y-2">
                                        <Label>{formatLabel(key)}</Label>
                                        {key === 'address' ? (
                                            <Textarea name={key} value={formData[key] || ''} onChange={handleChange} className="min-h-[80px]" />
                                        ) : (
                                            <Input name={key} value={formData[key] || ''} onChange={handleChange} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-2 pt-4 border-t border-white/10">
                            <Label>Photo</Label>
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded bg-muted flex items-center justify-center overflow-hidden border border-white/10">
                                    {formData.photo_url ? (
                                        <img src={formData.photo_url} className="w-full h-full object-cover" />
                                    ) : <CreditCard className="h-6 w-6 text-muted-foreground" />}
                                </div>
                                <Input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={loading} className="text-sm cursor-pointer" />
                            </div>
                        </div>
                    </div>


                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
