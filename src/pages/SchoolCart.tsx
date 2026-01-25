
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Clock,
    ShoppingCart,
    Users,
    Eye,
    CheckCircle2,
    Trash2,
    ArrowRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StudentManager } from '@/components/students/StudentManager';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';

interface PrintBatch {
    id: string;
    batch_name: string;
    status: string;
    created_at: string;
    submitted_at: string | null;
    student_count: number;
}

export default function SchoolCart() {
    const navigate = useNavigate();
    const [batches, setBatches] = useState<PrintBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewBatchId, setViewBatchId] = useState<string | null>(null);

    useEffect(() => {
        fetchCart();
    }, []);

    const fetchCart = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch 'carted' and submitted/history batches
            const { data: batchesData, error } = await supabase
                .from('print_batches' as any)
                .select('*')
                .eq('school_id', user.id)
                .neq('status', 'draft') // Fetch everything except drafts
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
            console.error('Error fetching cart:', error);
            toast.error('Failed to load cart');
        } finally {
            setLoading(false);
        }
    };

    const removeFromCart = async (batchId: string, batchName: string) => {
        if (!confirm(`Remove "${batchName}" from cart? This will move it back to Drafts.`)) return;

        try {
            const { error } = await supabase
                .from('print_batches' as any)
                .update({ status: 'draft' })
                .eq('id', batchId);

            if (error) throw error;
            toast.success("Moved back to Drafts");
            setBatches(batches.filter(b => b.id !== batchId));
        } catch (err: any) {
            toast.error("Action failed: " + err.message);
        }
    };

    const placeOrder = async (batch: PrintBatch) => {
        if (!confirm(`Place Order for "${batch.batch_name}"?\n\nThis will send it to the printing team.`)) return;

        try {
            const { error } = await supabase
                .from('print_batches' as any)
                .update({ status: 'submitted', submitted_at: new Date() })
                .eq('id', batch.id);

            if (error) throw error;
            toast.success("Order Placed Successfully!");
            fetchCart();
        } catch (err: any) {
            toast.error("Order failed: " + err.message);
        }
    };

    return (
        <DashboardLayout>
            <PageHeader
                title="Shopping Cart"
                description="Review and place orders for your ID card batches."
            >
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate('/drafts')}>
                        Back to Drafts
                    </Button>
                </div>
            </PageHeader>

            <Dialog open={!!viewBatchId} onOpenChange={(open) => !open && setViewBatchId(null)}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogTitle className="sr-only">Review Order</DialogTitle>
                    <DialogDescription className="sr-only">Read-only view of the batch</DialogDescription>
                    <div className="flex-1 overflow-auto p-1">
                        {viewBatchId && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-bold">Review Batch Content</h2>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setViewBatchId(null)}
                                    >
                                        Close
                                    </Button>
                                </div>
                                {/* Read Only Mode */}
                                <StudentManager batchId={viewBatchId} readOnly={true} />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
                    <p className="text-muted-foreground animate-pulse">Loading cart...</p>
                </div>
            ) : batches.length === 0 ? (
                <div className="text-center py-20 bg-muted/10 rounded-xl border border-dashed border-white/10">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-6">
                        <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-medium mb-2">Your Cart is Empty</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                        Go to Drafts to verify and add batches here.
                    </p>
                    <Button onClick={() => navigate('/drafts')}>Go to Drafts</Button>
                </div>
            ) : (
                <div className="space-y-4">
                    <AnimatePresence>
                        {batches.map((batch, index) => (
                            <motion.div
                                key={batch.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.05 }}
                            >
                                <div className="glass-card flex flex-col md:flex-row items-center p-4 gap-4 border-white/5 group hover:border-primary/20 transition-all">
                                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                                        <ShoppingCart className="w-6 h-6 text-primary" />
                                    </div>

                                    <div className="flex-1 text-center md:text-left">
                                        <h3 className="font-semibold text-lg">{batch.batch_name}</h3>
                                        <div className="flex items-center justify-center md:justify-start gap-3 text-sm text-muted-foreground mt-1">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Added: {new Date(batch.created_at).toLocaleDateString()}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                {batch.student_count} Cards
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setViewBatchId(batch.id)}
                                            className="flex-1 md:flex-none border border-white/10"
                                        >
                                            <Eye className="w-4 h-4 mr-2" />
                                            View
                                        </Button>

                                        {batch.status === 'carted' ? (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-destructive"
                                                    onClick={() => removeFromCart(batch.id, batch.batch_name)}
                                                    title="Move back to Drafts"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    className="flex-1 md:flex-none gradient-primary px-6 shadow-lg shadow-primary/20"
                                                    onClick={() => placeOrder(batch)}
                                                >
                                                    Place Order
                                                    <ArrowRight className="w-4 h-4 ml-2" />
                                                </Button>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-md text-green-500 font-medium text-sm">
                                                <CheckCircle2 className="w-4 h-4" />
                                                {batch.status === 'submitted' ? 'Order Placed' : batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    <div className="mt-8 p-6 glass-card border-primary/20 bg-primary/5 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold">Total Batches: {batches.length}</h3>
                            <p className="text-muted-foreground">Ready to act on {batches.reduce((acc, b) => acc + b.student_count, 0)} cards total.</p>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
