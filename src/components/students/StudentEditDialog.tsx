
import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, CreditCard } from 'lucide-react';
import { renderCardSide } from '@/utils/cardRenderer';

interface StudentEditDialogProps {
    student: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export function StudentEditDialog({ student, open, onOpenChange, onSave }: StudentEditDialogProps) {
    const [formData, setFormData] = useState<any>(student || {});
    const [loading, setLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [template, setTemplate] = useState<any>(null);

    useEffect(() => {
        if (student) {
            setFormData(student);
            fetchTemplate(student.school_id);
        }
    }, [student]);

    useEffect(() => {
        // Debounce preview generation
        const timer = setTimeout(() => {
            if (template && formData) {
                generatePreview();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [formData, template]);

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

    const generatePreview = async () => {
        if (!template) return;

        // Legacy unwrap logic
        let design = (template as any).front_design;
        if (design?.front_design) design = design.front_design;

        if (design) {
            const width = template.card_width || 1011;
            const height = template.card_height || 638;
            const img = await renderCardSide(design, formData, width, height); // Render full size, let CSS scale
            setPreviewImage(img);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Student & Preview Card</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Form */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input name="name" value={formData.name || ''} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label>Roll Number</Label>
                                <Input name="roll_number" value={formData.roll_number || ''} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label>Class</Label>
                                <Input name="class" value={formData.class || ''} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label>Department</Label>
                                <Input name="department" value={formData.department || ''} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input name="phone" value={formData.phone || ''} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label>Blood Group</Label>
                                <Input name="blood_group" value={formData.blood_group || ''} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Address</Label>
                            <Input name="address" value={formData.address || ''} onChange={handleChange} />
                        </div>

                        <div className="space-y-2">
                            <Label>Photo</Label>
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded bg-muted flex items-center justify-center overflow-hidden border">
                                    {formData.photo_url ? (
                                        <img src={formData.photo_url} className="w-full h-full object-cover" />
                                    ) : <CreditCard className="h-6 w-6 text-muted-foreground" />}
                                </div>
                                <Input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={loading} />
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="flex flex-col items-center justify-center bg-muted/20 rounded-lg p-6 border-2 border-dashed border-muted-foreground/20">
                        <h3 className="text-sm font-medium mb-4 text-muted-foreground">Live Card Preview</h3>
                        {previewImage ? (
                            <img
                                src={previewImage}
                                alt="Preview"
                                className="max-w-full shadow-lg rounded"
                                style={{ maxHeight: '400px', objectFit: 'contain' }}
                            />
                        ) : (
                            <div className="text-center text-muted-foreground">
                                {template ? "Generating preview..." : "No template assigned to this school."}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
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
