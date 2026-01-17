import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Printer,
    Edit,
    Upload,
    CheckCircle2,
    Clock,
    Loader2,
    FileText,
    School,
    Users,
    AlertCircle,
    Download
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateA4BatchPDF } from '@/utils/printGenerator';
import { BatchPhotoUploadDialog } from '@/components/students/BatchPhotoUploadDialog';
import { StudentManager } from '@/components/students/StudentManager';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';

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

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'completed':
                return {
                    icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
                    text: 'Completed',
                    bg: 'bg-green-500/10',
                    border: 'border-green-500/20',
                    textColor: 'text-green-500'
                };
            case 'processing':
                return {
                    icon: <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />,
                    text: 'Processing',
                    bg: 'bg-blue-500/10',
                    border: 'border-blue-500/20',
                    textColor: 'text-blue-500'
                };
            default:
                return {
                    icon: <Clock className="w-5 h-5 text-yellow-500" />,
                    text: 'Pending',
                    bg: 'bg-yellow-500/10',
                    border: 'border-yellow-500/20',
                    textColor: 'text-yellow-500'
                };
        }
    };

    return (
        <DashboardLayout>
            <PageHeader
                title="Print Shop Dashboard"
                description="Manage submitted batches and generate print files"
            >
                <div className="w-[200px]">
                    <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                        <SelectTrigger className="glass border-white/10">
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

            <Dialog open={!!reviewBatchId} onOpenChange={(open) => !open && setReviewBatchId(null)}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-auto">
                        {reviewBatchId && <StudentManager batchId={reviewBatchId} />}
                    </div>
                </DialogContent>
            </Dialog>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
                    <p className="text-muted-foreground animate-pulse">Loading batches...</p>
                </div>
            ) : filteredBatches.length === 0 ? (
                <div className="text-center py-20 bg-muted/10 rounded-xl border border-dashed border-white/10">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-6">
                        <Printer className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-medium mb-2">No print jobs found</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                        Batches submitted by schools will appear here for processing and printing.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    <AnimatePresence>
                        {filteredBatches.map((batch, index) => {
                            const status = getStatusConfig(batch.status);
                            return (
                                <motion.div
                                    key={batch.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2, delay: index * 0.05 }}
                                >
                                    <div className="group relative glass-card p-0 overflow-hidden hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 border-white/5 hover:border-primary/20 bg-gradient-to-br from-white/5 to-transparent">
                                        <div className={`absolute top-0 left-0 w-1 h-full ${status.bg} ${status.border} border-r transition-all`} />

                                        <div className="p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex gap-3 items-start">
                                                    <div className={`p-2 rounded-lg ${status.bg} border ${status.border}`}>
                                                        {status.icon}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-lg leading-tight mb-1 text-white group-hover:text-primary transition-colors">
                                                            {batch.batch_name}
                                                        </h3>
                                                        <div className="flex items-center text-xs text-muted-foreground">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            {batch.submitted_at ? new Date(batch.submitted_at).toLocaleDateString() : 'Draft'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className={`${status.textColor} ${status.border} bg-transparent`}>
                                                    {status.text}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                                <div className="flex flex-col p-3 rounded-lg bg-black/20 border border-white/5">
                                                    <span className="text-xs text-muted-foreground mb-1 flex items-center">
                                                        <School className="w-3 h-3 mr-1" /> Institution
                                                    </span>
                                                    <span className="font-medium text-sm truncate" title={batch.school_name}>
                                                        {batch.school_name || 'Unknown'}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col p-3 rounded-lg bg-black/20 border border-white/5">
                                                    <span className="text-xs text-muted-foreground mb-1 flex items-center">
                                                        <Users className="w-3 h-3 mr-1" /> Records
                                                    </span>
                                                    <span className="font-medium text-sm">
                                                        {batch.student_count} Students
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 mt-auto pt-4 border-t border-white/5">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="flex-1 h-9 text-xs border border-white/10 hover:bg-white/10 text-muted-foreground hover:text-white"
                                                    onClick={() => setReviewBatchId(batch.id)}
                                                >
                                                    <Edit className="h-3 w-3 mr-2" /> Review
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="flex-1 h-9 text-xs border border-white/10 hover:bg-white/10 text-muted-foreground hover:text-white"
                                                    onClick={() => setUploadBatchId(batch.id)}
                                                >
                                                    <Upload className="h-3 w-3 mr-2" /> Photos
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className={`flex-1 h-9 text-xs font-semibold shadow-lg ${batch.status === 'completed'
                                                            ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20'
                                                            : 'gradient-primary shadow-primary/20'
                                                        }`}
                                                    onClick={() => handlePrintParams(batch)}
                                                >
                                                    {batch.status === 'completed' ? (
                                                        <><Download className="h-3 w-3 mr-2" /> Download</>
                                                    ) : (
                                                        <><Printer className="h-3 w-3 mr-2" /> Generate</>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </DashboardLayout>
    );
}
