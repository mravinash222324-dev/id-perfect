import { useState, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Download,
  Loader2,
  X,
  Trash2,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface UploadResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function UploadData() {
  const [file, setFile] = useState<File | null>(null);
  const [batchName, setBatchName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [existingBatches, setExistingBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    setLoadingBatches(true);
    try {
      // Fetch all batches. In a real app with 10k+ rows, this should be an RPC or a separate table.
      // For now, we fetch distinct batches by selecting 'batch' column.
      const { data, error } = await supabase
        .from('students')
        .select('batch, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by batch name to get counts or just unique names
      const batches = new Map();
      data?.forEach((item: any) => {
        if (item.batch) {
          if (!batches.has(item.batch)) {
            batches.set(item.batch, { name: item.batch, count: 0, last_upload: item.created_at });
          }
          batches.get(item.batch).count++;
        }
      });

      setExistingBatches(Array.from(batches.values()));

    } catch (err) {
      console.error("Error fetching batches:", err);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      setFile(droppedFile);
      setBatchName(droppedFile.name.replace('.csv', '')); // Default batch name
      setUploadResult(null);
    } else {
      toast.error('Please upload a CSV file');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setBatchName(selectedFile.name.replace('.csv', '')); // Default batch name
      setUploadResult(null);
    }
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Basic CSV parsing (doesn't handle commas inside quotes)
      const values = lines[i].split(',').map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }

    return rows;
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!batchName.trim()) {
      toast.error("Please enter a batch name");
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        toast.error('No valid data found in CSV');
        return;
      }

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      // Check if batch exists? We assume append is okay, or user wants to add to existing batch.

      for (const row of rows) {
        try {
          const studentData = {
            roll_number: row.roll_number || row.id || row.student_id || `STU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: row.name || row.student_name || row.full_name || 'Unknown',
            email: row.email || null,
            phone: row.phone || row.mobile || null,
            dob: row.dob || row.date_of_birth || null,
            blood_group: row.blood_group || row.blood_type || null,
            class: row.class || row.grade || null,
            department: row.department || row.dept || null,
            batch: batchName.trim(), // USE THE USER PROVIDED BATCH NAME
            guardian_name: row.guardian_name || row.parent_name || null,
            address: row.address || null,
            verification_status: 'pending',
          };

          const { error } = await supabase.from('students').insert(studentData);

          if (error) {
            if (error.code === '23505') {
              // Duplicate Roll Number
              // Try Updating instead?
              // The user said "collision... select batch is priority".
              // If we are uploading New Data, maybe we should UPSERT?
              // Let's try upsert if insert fails, OR just upsert by default logic if we want to "Replace".
              // But 'students' table PK is UUID. Roll Number is unique key? 
              // If roll number is unique constraint, we have a problem if different batches share roll numbers.
              // Assuming Roll Number is globally unique for now based on constraint.
              // Let's report dupes.
              errors.push(`Duplicate roll number: ${studentData.roll_number}`);
            } else {
              errors.push(`Row ${success + failed + 1}: ${error.message}`);
            }
            failed++;
          } else {
            success++;
          }
        } catch (err) {
          failed++;
          errors.push(`Row ${success + failed}: Parse error`);
        }
      }

      setUploadResult({ success, failed, errors });

      if (success > 0) {
        toast.success(`Successfully imported ${success} student(s) into batch "${batchName}"`);
        fetchBatches(); // Refresh list
      }
      if (failed > 0) {
        toast.warning(`${failed} record(s) failed to import`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to process file');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteBatch = async (batchToDelete: string) => {
    if (!confirm(`Are you sure you want to delete ALL students in batch "${batchToDelete}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase.from('students').delete().eq('batch', batchToDelete);
      if (error) throw error;
      toast.success(`Batch "${batchToDelete}" deleted.`);
      fetchBatches();
    } catch (err) {
      console.error("Delete failed", err);
      toast.error("Failed to delete batch");
    }
  }

  const downloadTemplate = () => {
    const headers = 'roll_number,name,email,phone,dob,blood_group,class,department,guardian_name,address';
    const sampleRow = 'STU001,John Doe,john@example.com,+1234567890,2000-01-15,A+,10th,Science,Jane Doe,123 Main St';
    const csv = `${headers}\n${sampleRow}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Student Data Management"
        description="Import new students or manage existing batches"
      >
        <Button variant="outline" onClick={downloadTemplate} className="gap-2">
          <Download className="h-4 w-4" />
          Download Template
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Area */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                Upload CSV Batch
              </CardTitle>
              <CardDescription>Upload a CSV file and assign it a batch name.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                  file && 'border-success bg-success/5'
                )}
              >
                {file ? (
                  <div className="space-y-4">
                    <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-success/10">
                      <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFile(null);
                        setUploadResult(null);
                        setBatchName('');
                      }}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-primary/10">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        Drag & Drop CSV, or{' '}
                        <Label
                          htmlFor="file-upload"
                          className="text-primary cursor-pointer hover:underline"
                        >
                          browse
                        </Label>
                      </p>
                    </div>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {file && (
                <div className="space-y-2">
                  <Label>Batch Name</Label>
                  <Input
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="e.g. Class 10 - 2024"
                  />
                  <p className="text-xs text-muted-foreground">This name will be used to filter matching photos and students later.</p>

                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || !batchName.trim()}
                    className="w-full mt-2 gradient-primary"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import Batch
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {uploadResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Import Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-success/10 text-center">
                      <p className="text-3xl font-bold text-success">
                        {uploadResult.success}
                      </p>
                      <p className="text-sm text-muted-foreground">Successful</p>
                    </div>
                    <div className="p-4 rounded-lg bg-destructive/10 text-center">
                      <p className="text-3xl font-bold text-destructive">
                        {uploadResult.failed}
                      </p>
                      <p className="text-sm text-muted-foreground">Failed</p>
                    </div>
                  </div>

                  {uploadResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        Errors
                      </p>
                      <div className="max-h-48 overflow-auto rounded-lg border border-border p-3 bg-muted/30">
                        {uploadResult.errors.map((error, index) => (
                          <p key={index} className="text-xs text-muted-foreground">
                            {error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Existing Batches List */}
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> Existing Batches</CardTitle>
            <CardDescription>Manage your uploaded student data groups</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {loadingBatches ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
            ) : existingBatches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Name</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingBatches.map((batch) => (
                    <TableRow key={batch.name}>
                      <TableCell className="font-medium">{batch.name}</TableCell>
                      <TableCell className="text-right">{batch.count}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteBatch(batch.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No batches found.</p>
                <p className="text-xs">Upload a CSV to create a batch.</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* CSV Format Guide */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">CSV Format Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium">Column</th>
                  <th className="text-left py-2 pr-4 font-medium">Required</th>
                  <th className="text-left py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-xs">roll_number</td>
                  <td className="py-2 pr-4">Yes</td>
                  <td className="py-2">Unique student identifier</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-xs">name</td>
                  <td className="py-2 pr-4">Yes</td>
                  <td className="py-2">Full name of the student</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-xs">email</td>
                  <td className="py-2 pr-4">No</td>
                  <td className="py-2">Student email address</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
