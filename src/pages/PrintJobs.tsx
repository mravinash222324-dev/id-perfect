import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Printer,
    Edit,
    Upload,
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/ui/status-badge';
import { generateA4BatchPDF } from '@/utils/printGenerator';
import { BatchPhotoUploadDialog } from '@/components/students/BatchPhotoUploadDialog';
import { StudentManager } from '@/components/students/StudentManager';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

interface PrintBatch {
    id: string;
    batch_name: string;
    status: string;
    created_at: string;
    submitted_at: string | null;
    school_name?: string;
    student_count?: number;
    school_id: string;
    template_id?: string;
}

export default function PrintJobs() {
    const [batches, setBatches] = useState<PrintBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSchool, setSelectedSchool] = useState<string>('all');
    const [uploadBatchId, setUploadBatchId] = useState<string | null>(null);
    const [reviewBatchId, setReviewBatchId] = useState<string | null>(null);

    // Derive unique schools from the loaded batches
    const schools = batches.reduce((acc: any[], batch) => {
        if (batch.school_id && !acc.find(s => s.id === batch.school_id)) {
            acc.push({ id: batch.school_id, name: batch.school_name || 'Unknown' });
        }
        return acc;
    }, []);

    useEffect(() => {
        fetchBatches();
        // fetchSchools removed as we derive from batches now
    }, []);

    const fetchBatches = async () => {
        try {
            setLoading(true);

            // Cast to 'any' to bypass TS errors if type definitions are outdated
            const { data: batchesData, error } = await supabase
                .from('print_batches' as any)
                .select('*')
                .order('submitted_at', { ascending: false, nullsFirst: false });

            if (error) throw error;

            const enhancedBatches = await Promise.all((batchesData || []).map(async (batch: any) => {
                // Get student count
                const { count } = await (supabase as any)
                    .from('students')
                    .select('*', { count: 'exact', head: true })
                    .eq('print_batch_id', batch.id);

                // Get school name
                let schoolName = 'Unknown School';
                if (batch.school_id) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('institution_name, full_name')
                        .eq('user_id', batch.school_id)
                        .single();
                    if (profile) schoolName = profile.institution_name || profile.full_name || 'Unknown School';
                }

                return {
                    ...batch,
                    student_count: count || 0,
                    school_name: schoolName
                };
            }));

            setBatches(enhancedBatches as PrintBatch[]);
        } catch (error) {
            console.error('Error fetching print jobs:', error);
            toast.error('Failed to load print jobs');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintParams = async (batch: PrintBatch) => {
        try {
            const { data: students, error } = await supabase
                .from('students' as any)
                .select('*')
                .eq('print_batch_id', batch.id);

            if (error || !students || students.length === 0) {
                toast.error("No students found in this batch");
                return;
            }

            toast.info("Preparing print files... (This may take a moment)");
            await supabase.from('print_batches' as any).update({ status: 'processing' }).eq('id', batch.id);
            // Optimistic update or refetch
            fetchBatches();

            let templateData: any = null;
            if (batch.template_id) {
                const { data: tmpl } = await supabase.from('id_templates').select('*').eq('id', batch.template_id).single();
                templateData = tmpl;
            }
            if (!templateData && batch.school_id) {
                const { data: tmpls } = await supabase.from('id_templates').select('*').contains('assigned_schools', [batch.school_id]);
                if (tmpls && tmpls.length > 0) {
                    templateData = tmpls[0];
                    await supabase.from('print_batches' as any).update({ template_id: templateData.id }).eq('id', batch.id);
                    toast.info(`Auto-selected template: ${templateData.name}`);
                }
            }

            if (!templateData) {
                toast.error("No template found assigned to this school.");
                return;
            }

            const { renderCardSide } = await import('@/utils/cardRenderer');
            const width = templateData.card_width || 1011;
            const height = templateData.card_height || 638;
            const imageDatums: { front: string, back?: string }[] = [];

            for (const student of students) {
                let frontDesign = templateData.front_design;
                if (frontDesign?.front_design) frontDesign = frontDesign.front_design;
                const frontImg = await renderCardSide(frontDesign, student, width, height);
                if (frontImg) imageDatums.push({ front: frontImg });
            }

            if (imageDatums.length === 0) {
                toast.error("Failed to render cards.");
                return;
            }

            const success = await generateA4BatchPDF(imageDatums, `${batch.batch_name}_print.pdf`, { width, height });

            if (success) {
                await supabase.from('print_batches' as any).update({ status: 'completed', completed_at: new Date() }).eq('id', batch.id);
                toast.success("Batch Print Job Completed");
                fetchBatches();
            } else {
                toast.error("PDF generation returned failure.");
            }
        } catch (err: any) {
            console.error(err);
            toast.error("Process failed: " + err.message);
        }
    };

    const filteredBatches = batches.filter(batch =>
        selectedSchool === 'all' || batch.school_id === selectedSchool
    );

    return (
        <DashboardLayout>
            <PageHeader
                title="Print Shop Dashboard"
                description="Manage submitted batches and generate print files"
            >
                {/* Global button removed as requested */}
            </PageHeader>

            <BatchPhotoUploadDialog
                open={!!uploadBatchId}
                onOpenChange={(open) => !open && setUploadBatchId(null)}
                batchId={uploadBatchId}
                onUploadComplete={() => {
                    toast.success("Photos uploaded. You can now review data and see matches.");
                    setUploadBatchId(null);
                }}
            />

            {/* Review Data Dialog - Controlled by reviewBatchId */}
            <Dialog open={!!reviewBatchId} onOpenChange={(open) => !open && setReviewBatchId(null)}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-auto">
                        {reviewBatchId && <StudentManager batchId={reviewBatchId} />}
                    </div>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Incoming Print Jobs</CardTitle>
                    <div className="w-[200px]">
                        <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by School" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Schools</SelectItem>
                                {schools.map((s: any) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">Loading...</div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Batch Name</TableHead>
                                        <TableHead>School</TableHead>
                                        <TableHead>Students</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Submitted At</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredBatches.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                No print jobs found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredBatches.map((batch) => (
                                            <TableRow key={batch.id}>
                                                <TableCell className="font-medium">{batch.batch_name}</TableCell>
                                                <TableCell>{batch.school_name}</TableCell>
                                                <TableCell>{batch.student_count}</TableCell>
                                                <TableCell>
                                                    <StatusBadge status={batch.status as any} />
                                                </TableCell>
                                                <TableCell className="text-sm text-gray-500">
                                                    {batch.submitted_at ? new Date(batch.submitted_at).toLocaleString() : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setUploadBatchId(batch.id)}
                                                        >
                                                            <Upload className="h-4 w-4 mr-1" /> Photos
                                                        </Button>

                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setReviewBatchId(batch.id)}
                                                        >
                                                            <Edit className="h-4 w-4 mr-1" /> Review
                                                        </Button>

                                                        <Button size="sm" className="gradient-primary" onClick={() => handlePrintParams(batch)}>
                                                            <Printer className="h-4 w-4 mr-1" /> Print
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
