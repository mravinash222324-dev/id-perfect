
import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Printer,
  Edit,
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

interface PrintBatch {
  id: string;
  batch_name: string;
  status: string; // Changed to string to match easy DB types, or custom union
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
            .eq('id', batch.school_id)
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
      // 1. Fetch Students
      const { data: students, error } = await supabase
        .from('students' as any)
        .select('*')
        .eq('print_batch_id', batch.id);

      if (error || !students || students.length === 0) {
        toast.error("No students found in this batch");
        return;
      }

      toast.info("Preparing print files... (This may take a moment)");
      // Update status to processing
      await supabase.from('print_batches' as any).update({ status: 'processing' }).eq('id', batch.id);
      fetchBatches(); // Refresh UI

      // 2. Prepare Template
      let templateData: any = null;

      // Check if batch already has a template
      if (batch.template_id) {
        const { data: tmpl } = await supabase.from('id_templates').select('*').eq('id', batch.template_id).single();
        templateData = tmpl;
      }

      // Fallback: Find template assigned to this school
      if (!templateData && batch.school_id) {
        // id_templates has an array column 'assigned_schools'. We need to find rows where this array contains batch.school_id.
        const { data: tmpls } = await supabase
          .from('id_templates')
          .select('*')
          .contains('assigned_schools', [batch.school_id]);

        if (tmpls && tmpls.length > 0) {
          templateData = tmpls[0]; // Auto-select the first one
          // Optionally update the batch to link this template permanently
          await supabase.from('print_batches' as any).update({ template_id: templateData.id }).eq('id', batch.id);
          toast.info(`Auto-selected template: ${templateData.name}`);
        }
      }

      if (!templateData) {
        toast.error("No template found assigned to this school. Please assign a template in Design Studio.");
        return;
      }

      // 3. Render Images
      // Dynamically import renderer
      const { renderCardSide } = await import('@/utils/cardRenderer');

      const width = templateData.card_width || 1011;
      const height = templateData.card_height || 638;

      const imageDatums: { front: string, back?: string }[] = [];

      for (const student of students) {
        // Prepare Front
        let frontDesign = templateData.front_design;
        if (frontDesign?.front_design) frontDesign = frontDesign.front_design; // Unwrap legacy

        const frontImg = await renderCardSide(frontDesign, student, width, height);

        // Prepare Back (Optional - Future Proofing)
        // const backImg = ... 

        if (frontImg) {
          imageDatums.push({ front: frontImg });
        }
      }

      if (imageDatums.length === 0) {
        toast.error("Failed to render cards. Check template configuration.");
        return;
      }

      // 4. Generate PDF
      // Note: generateA4BatchPDF returns a boolean success flag, not the PDF object.
      // It handles calling doc.save() internally.
      const success = await generateA4BatchPDF(
        imageDatums,
        `${batch.batch_name}_print.pdf`,
        { width, height } // Pass dimensions for aspect ratio calculation
      );

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


  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [schools, setSchools] = useState<any[]>([]);

  const fetchSchools = async () => {
    // Cast to any to avoid "excessively deep" type error
    const result = await (supabase as any).from('profiles').select('id, user_metadata, institution_name').eq('role', 'school');
    const { data } = result;

    if (data) {
      // Fallback to metadata if institution_name column is empty (though it should be populated now)
      const formatted = data.map((s: any) => ({
        id: s.id,
        name: s.institution_name || (s.user_metadata as any)?.institution_name || 'Unknown School'
      }));
      setSchools(formatted);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchSchools();
  }, []);



  // ... fetchBatches logic ...

  const filteredBatches = batches.filter(batch =>
    selectedSchool === 'all' || batch.school_id === selectedSchool
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Print Shop Dashboard"
        description="Manage submitted batches and generate print files"
      />

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
                {schools.map(s => (
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
                            {/* Review Action */}
                            <Button size="sm" variant="outline" onClick={() => {
                              // Navigate to students page filtered by this batch
                              window.location.href = `/students?batchId=${batch.id}`;
                            }}>
                              <Edit className="h-4 w-4 mr-1" /> Review Data
                            </Button>

                            {/* Print Action */}
                            <Button size="sm" className="gradient-primary" onClick={() => handlePrintParams(batch)}>
                              <Printer className="h-4 w-4 mr-1" /> Print (A4)
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
