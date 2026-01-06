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

import { CreditCard as CardIcon } from 'lucide-react'; // Rename to avoid conflict if Card is imported for UI

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
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    fetchBatches();
    fetchAssignedTemplate();
  }, []);

  const fetchAssignedTemplate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find template assigned to this school
      const { data: tmpls } = await supabase
        .from('id_templates')
        .select('*')
        .contains('assigned_schools', [user.id]);

      if (tmpls && tmpls.length > 0) {
        // Use the first assigned template
        const template = tmpls[0];

        // Dynamically import renderer to avoid initial load weight if possible, or just statically import if fine.
        // Since we are lazy loading in other places, let's dynamic import here too.
        const { renderCardSide } = await import('@/utils/cardRenderer');

        // Create dummy student data for preview
        const dummyStudent = {
          name: 'Rahul Kumar',
          roll_number: 'STU-2024-001',
          class: 'Class X',
          department: 'Science',
          blood_group: 'B+',
          dob: '2008-05-15',
          address: '42, Gandhi Road, Mumbai',
          phone: '+91 98765 43210',
          email: 'rahul.k@school.com',
          guardian_name: 'Suresh Kumar',
          photo_url: null // Will use placeholder if any
        };

        const width = template.card_width || 1011;
        const height = template.card_height || 638;

        // Unwrap design if needed
        let design = (template as any).front_design;
        if (design?.front_design) design = design.front_design; // Handle nested structure

        if (design) {
          const img = await renderCardSide(design, dummyStudent, width, height);
          setPreviewImage(img);
        }
      }
    } catch (error) {
      console.error("Error fetching template preview:", error);
    }
  };

  const fetchBatches = async () => {
    setLoadingBatches(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Only fetch batches for THIS school
      const { data, error } = await supabase
        .from('print_batches' as any)
        .select('*')
        .eq('school_id', user?.id) // Filter by school!
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExistingBatches(data || []);
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

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoUploadProgress, setPhotoUploadProgress] = useState<{ processed: number, total: number, success: number, failed: number } | null>(null);

  // ... existing logic ...

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Handle comma inside quotes simple regex or library (using simple split for now as per code style)
      // If complex CSV needed, we should suggest library, but simple split is extant.
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

      // 1. Create Print Batch Record
      const { data: batchData, error: batchError } = await supabase
        .from('print_batches' as any)
        .insert([{
          batch_name: batchName,
          school_id: (await supabase.auth.getUser()).data.user?.id,
          status: 'draft'
        }])
        .select()
        .single();

      if (batchError) {
        toast.error("Failed to crate batch: " + batchError.message);
        setIsUploading(false);
        return;
      }

      const batchId = (batchData as any).id;

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

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
            batch: batchName.trim(),
            print_batch_id: batchId,
            guardian_name: row.guardian_name || row.parent_name || null,
            address: row.address || null,
            verification_status: 'approved',
            school_id: (await supabase.auth.getUser()).data.user?.id,
            photo_ref: row.photo_ref || row.photo_name || row.filename || row.image_name || null // Capture photo ref
          };

          const { error } = await supabase.from('students').insert(studentData);

          if (error) {
            if (error.code === '23505') {
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
        fetchBatches();
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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotoFiles(Array.from(e.target.files));
    }
  };

  const handleBulkPhotoUpload = async () => {
    if (photoFiles.length === 0) return;

    setPhotoUploadProgress({ processed: 0, total: photoFiles.length, success: 0, failed: 0 });

    // We need to fetch all candidates to match against
    // Optimization: Just fetch students for recent batches or ALL approved students for this school?
    // Let's matching against ALL students for this school to be safe.

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch minimal student data for matching
    const { data: studentsData, error: stuError } = await supabase
      .from('students')
      .select('id, roll_number, photo_ref')
      .eq('school_id', user.id);

    if (stuError || !studentsData) {
      toast.error("No students found to match photos against.");
      setPhotoUploadProgress(null);
      return;
    }

    // Explicit cast to avoid type inference issues
    const students = studentsData as any[];

    if (!students) {
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
  };

  // ... deleteBatch, downloadTemplate ... //


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setBatchName(selectedFile.name.replace('.csv', '')); // Default batch name
      setUploadResult(null);
    }
  };

  const deleteBatch = async (batchName: string) => {
    if (!confirm(`Are you sure you want to delete batch "${batchName}"?`)) return;

    try {
      // 1. Delete Students
      const { error: stuError } = await supabase.from('students').delete().eq('batch', batchName);
      if (stuError) throw stuError;

      // 2. Delete Batch Record
      await supabase.from('print_batches' as any).delete().eq('batch_name', batchName);

      toast.success(`Batch "${batchName}" deleted.`);
      fetchBatches();
    } catch (err) {
      console.error("Delete failed", err);
      toast.error("Failed to delete batch");
    }
  }

  const downloadTemplate = () => {
    const headers = 'roll_number,name,email,phone,dob,blood_group,class,department,guardian_name,address,photo_ref';
    const sampleRow = 'STU001,John Doe,john@example.com,+1234567890,2000-01-15,A+,10th,Science,Jane Doe,123 Main St,img_123.jpg';
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
            {/* ... */}
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

          {/* BULK PHOTO UPLOAD CARD */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Batch Photo Upload
              </CardTitle>
              <CardDescription>
                Upload multiple photos. They will be auto-matched to students based on <b>Original Filename</b> (csv 'photo_ref') or <b>Roll Number</b>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
                <input
                  type="file"
                  id="bulk-photos"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                <Label htmlFor="bulk-photos" className="cursor-pointer block">
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

        {/* Right Column: Template Preview & Batches */}
        <div className="space-y-6">
          {/* TEMPLATE PREVIEW CARD */}
          {previewImage && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CardIcon className="h-5 w-5 text-primary" />
                  Your ID Card Template
                </CardTitle>
                <CardDescription>This is how your students' ID cards will look.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex justify-center pb-6">
                {/* Updated max height for cleaner look */}
                <div className="relative rounded-lg overflow-hidden shadow-lg border border-border bg-white" style={{ maxWidth: '300px' }}>
                  <img src={previewImage} alt="ID Card Preview" className="w-full h-auto object-contain" />
                </div>
              </CardContent>
            </Card>
          )}

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
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">
                          {batch.batch_name}
                          <br />
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${batch.status === 'completed' ? 'bg-green-100 text-green-800' :
                            batch.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                              batch.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                            }`}>
                            {batch.status?.toUpperCase() || 'DRAFT'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {new Date(batch.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {batch.status === 'draft' && (
                              <Button size="sm" variant="default" className="h-7 text-xs" onClick={async () => {
                                if (confirm("Submit this batch to the Print Shop? You won't be able to edit it easily after.")) {
                                  await supabase.from('print_batches' as any).update({ status: 'submitted', submitted_at: new Date() }).eq('id', batch.id);
                                  toast.success("Batch Submited!");
                                  fetchBatches();
                                }
                              }}>
                                Submit
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteBatch(batch.batch_name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
                  <td className="py-2 pr-4 font-mono text-xs">photo_ref</td>
                  <td className="py-2 pr-4">No</td>
                  <td className="py-2">Original filename (e.g. img_123.jpg) for auto-matching</td>
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
