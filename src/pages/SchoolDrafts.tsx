
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Clock,
    Loader2,
    School,
    Users,
    Edit,
    CheckCircle2,
    Database,
    Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StudentManager } from '@/components/students/StudentManager';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';

interface PrintBatch {
    id: string;
    batch_name: string;
    status: string;
    created_at: string;
    submitted_at: string | null;
    student_count: number;
}

export default function SchoolDrafts() {
    const navigate = useNavigate();
    const [batches, setBatches] = useState<PrintBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewBatchId, setReviewBatchId] = useState<string | null>(null);

    useEffect(() => {
        fetchBatches();
    }, []);

    const fetchBatches = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch batches for this school
            const { data: batchesData, error } = await supabase
                .from('print_batches' as any)
                .select('*')
                .eq('school_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Get counts
            const enhancedBatches = await Promise.all((batchesData || []).map(async (batch: any) => {
                const { count } = await supabase
                    .from('students')
                    .select('*', { count: 'exact', head: true })
                    .eq('print_batch_id', batch.id);
                return {
                    ...batch,
                    student_count: count || 0
                };
            }));

            setBatches(enhancedBatches as PrintBatch[]);
        } catch (error) {
            console.error('Error fetching drafts:', error);
            toast.error('Failed to load drafts');
        } finally {
            setLoading(false);
        }
    };

    const deleteBatch = async (batchId: string, batchName: string) => {
        if (!confirm(`Are you sure you want to delete "${batchName}" and all its students?`)) return;

        try {
            const { error: stuError } = await supabase.from('students').delete().eq('print_batch_id', batchId);
            if (stuError) throw stuError;

            const { error: batchError } = await supabase.from('print_batches' as any).delete().eq('id', batchId);
            if (batchError) throw batchError;

            toast.success("Batch deleted");
            setBatches(batches.filter(b => b.id !== batchId));
        } catch (err: any) {
            toast.error("Delete failed: " + err.message);
        }
    };

    const submitBatch = async (batch: PrintBatch) => {
        if (!confirm(`Submit "${batch.batch_name}" for printing?\n\nEnsure all data is correct. You cannot edit after submission.`)) return;

        try {
            const { error } = await supabase
                .from('print_batches' as any)
                .update({ status: 'submitted', submitted_at: new Date() })
                .eq('id', batch.id);

            if (error) throw error;
            toast.success("Batch Submitted!");
            fetchBatches();
        } catch (err: any) {
            toast.error("Submission failed: " + err.message);
        }
    };

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
            case 'submitted':
                return {
                    icon: <Clock className="w-5 h-5 text-blue-500" />,
                    text: 'Submitted',
                    bg: 'bg-blue-500/10',
                    border: 'border-blue-500/20',
                    textColor: 'text-blue-500'
                };
            default:
                return {
                    icon: <Edit className="w-5 h-5 text-yellow-500" />,
                    text: 'Draft',
                    bg: 'bg-yellow-500/10',
                    border: 'border-yellow-500/20',
                    textColor: 'text-yellow-500'
                };
        }
    };

    return (
        <DashboardLayout>
            <PageHeader
                title="Batch History"
                description="Manage your drafts and submitted batches."
            >
                <div className="flex gap-2">
                    <Button onClick={() => navigate('/new-batch')} className="gap-2">
                        + New Batch
                    </Button>
                </div>
            </PageHeader>

            <Dialog open={!!reviewBatchId} onOpenChange={(open) => !open && setReviewBatchId(null)}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-auto p-1">
                        {reviewBatchId && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-bold">Batch Details</h2>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setReviewBatchId(null)}
                                    >
                                        Close
                                    </Button>
                                </div>
                                <StudentManager batchId={reviewBatchId} />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
                    <p className="text-muted-foreground animate-pulse">Loading batches...</p>
                </div>
            ) : batches.length === 0 ? (
                <div className="text-center py-20 bg-muted/10 rounded-xl border border-dashed border-white/10">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-6">
                        <Database className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-medium mb-2">No batches found</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                        Create a new batch to start uploading student data.
                    </p>
                    <Button onClick={() => navigate('/new-batch')}>Create Batch</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    <AnimatePresence>
                        {batches.map((batch, index) => {
                            const status = getStatusConfig(batch.status);
                            return (
                                <motion.div
                                    key={batch.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
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
                                                            {new Date(batch.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className={`${status.textColor} ${status.border} bg-transparent`}>
                                                    {status.text}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center gap-2 mb-6 p-3 rounded-lg bg-black/20 border border-white/5">
                                                <Users className="w-4 h-4 text-muted-foreground" />
                                                <span className="font-medium text-sm">
                                                    {batch.student_count} Students
                                                </span>
                                            </div>

                                            <div className="flex gap-2">
                                                {batch.status === 'draft' ? (
                                                    <>
                                                        <Button
                                                            className="flex-1 gradient-primary shadow-lg shadow-primary/20"
                                                            onClick={() => setReviewBatchId(batch.id)}
                                                        >
                                                            <Edit className="h-3 w-3 mr-2" /> Review / Edit
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            className="border-white/10 hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/50"
                                                            onClick={() => submitBatch(batch)}
                                                        >
                                                            Submit
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="hover:bg-red-500/10 hover:text-red-500"
                                                            onClick={() => deleteBatch(batch.id, batch.batch_name)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        className="w-full border border-white/10"
                                                        onClick={() => setReviewBatchId(batch.id)}
                                                    >
                                                        View Details
                                                    </Button>
                                                )}
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
