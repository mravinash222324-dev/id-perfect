import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Upload, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BatchPhotoUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUploadComplete?: () => void;
}

export function BatchPhotoUploadDialog({ open, onOpenChange, onUploadComplete }: BatchPhotoUploadDialogProps) {
    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const [photoUploadProgress, setPhotoUploadProgress] = useState<{ processed: number, total: number, success: number, failed: number } | null>(null);

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setPhotoFiles(Array.from(e.target.files));
        }
    };

    const handleBulkPhotoUpload = async () => {
        if (photoFiles.length === 0) return;

        setPhotoUploadProgress({ processed: 0, total: photoFiles.length, success: 0, failed: 0 });

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch minimal student data for matching
            // Note: This relies on RLS to return the correct students (all for admin, school-specific for school)
            const { data: studentsData, error: stuError } = await supabase
                .from('students')
                .select('id, roll_number, photo_ref');

            if (stuError || !studentsData) {
                toast.error("No students found to match photos against.");
                setPhotoUploadProgress(null);
                return;
            }

            // Explicit cast to avoid type inference issues
            const students = studentsData as any[];

            if (!students || students.length === 0) {
                toast.error("No students found to match photos against.");
                setPhotoUploadProgress(null);
                return;
            }

            // Create lookup maps
            const rollMap = new Map();
            const refMap = new Map();

            students.forEach(s => {
                if (s.roll_number) rollMap.set(s.roll_number.toLowerCase().trim(), s.id);
                if (s.photo_ref) refMap.set(s.photo_ref.toLowerCase().trim(), s.id);
            });

            let successCount = 0;
            let failCount = 0;

            // Process files
            for (const file of photoFiles) {
                const name = file.name; // e.g. "IMG_123.jpg"
                const nameKey = name.toLowerCase().trim();
                const nameNoExt = name.split('.')[0].toLowerCase().trim(); // "img_123"

                // Try to find match
                // 1. Exact 'photo_ref' match (e.g. csv had "IMG_123.jpg")
                let studentId = refMap.get(nameKey);

                // 2. 'photo_ref' match without extension (e.g. csv had "IMG_123")
                if (!studentId) studentId = refMap.get(nameNoExt);

                // 3. Roll number match (exact filename)
                if (!studentId) studentId = rollMap.get(nameKey);

                // 4. Roll number match (no extension)
                if (!studentId) studentId = rollMap.get(nameNoExt);

                if (studentId) {
                    try {
                        // Upload to Storage
                        const fileExt = name.split('.').pop();
                        const storagePath = `${studentId}-${Date.now()}.${fileExt}`;

                        const { error: uploadErr } = await supabase.storage
                            .from('student-photos')
                            .upload(storagePath, file, { upsert: true });

                        if (uploadErr) throw uploadErr;

                        const { data: { publicUrl } } = supabase.storage
                            .from('student-photos')
                            .getPublicUrl(storagePath);

                        // Update Student Record
                        await supabase
                            .from('students')
                            .update({ photo_url: publicUrl })
                            .eq('id', studentId);

                        successCount++;
                    } catch (err) {
                        console.error(`Failed to upload ${name}`, err);
                        failCount++;
                    }
                } else {
                    // No match found
                    failCount++;
                }

                setPhotoUploadProgress(prev => ({
                    ...prev!,
                    processed: prev!.processed + 1,
                    success: successCount,
                    failed: failCount
                }));
            }

            toast.success(`Photos Processed: ${successCount} matched & uploaded, ${failCount} unmatched.`);
            setPhotoFiles([]);
            setPhotoUploadProgress(null);
            if (onUploadComplete) onUploadComplete();

        } catch (error) {
            console.error("Bulk upload error:", error);
            toast.error("An error occurred during bulk upload.");
            setPhotoUploadProgress(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Batch Photo Upload</DialogTitle>
                    <DialogDescription>
                        Upload multiple photos to automatically match them with students.
                        Matches are made by <b>Original Filename</b> (csv 'photo_ref') or <b>Roll Number</b>.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
                        <input
                            type="file"
                            id="dialog-bulk-photos"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoSelect}
                        />
                        <Label htmlFor="dialog-bulk-photos" className="cursor-pointer block">
                            {photoFiles.length > 0 ? (
                                <div className="space-y-2">
                                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                                    <p className="font-medium text-green-600">{photoFiles.length} Photos Selected</p>
                                    <p className="text-xs text-muted-foreground">Click to change selection</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                                    <p className="font-medium">Select Photos Directory</p>
                                    <p className="text-xs text-muted-foreground">Select multiple files (Ctrl+Click or Drag selection)</p>
                                </div>
                            )}
                        </Label>
                    </div>

                    {photoFiles.length > 0 && (
                        <div className="space-y-2">
                            {photoUploadProgress && (
                                <div className="text-sm space-y-1">
                                    <div className="flex justify-between">
                                        <span>Processing... {photoUploadProgress.processed}/{photoUploadProgress.total}</span>
                                        <span>{Math.round((photoUploadProgress.processed / photoUploadProgress.total) * 100)}%</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-300"
                                            style={{ width: `${(photoUploadProgress.processed / photoUploadProgress.total) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Matched: {photoUploadProgress.success} | Failed/Unmatched: {photoUploadProgress.failed}
                                    </p>
                                </div>
                            )}

                            <Button
                                onClick={handleBulkPhotoUpload}
                                disabled={!!photoUploadProgress}
                                className="w-full"
                            >
                                {photoUploadProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Start Photo Matching & Upload
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
