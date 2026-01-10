import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
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
  Database,
  LogOut,
  FileCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { CreditCard as CardIcon } from 'lucide-react'; // Rename to avoid conflict if Card is imported for UI
import { extractTemplateFields } from '@/utils/templateHelper';

interface UploadResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function UploadData() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

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
    const { data: studentsData, error: stuError } = await (supabase as any)
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

  const downloadTemplate = async () => {
    // 1. Defaut Base Headers
    const mandatoryFields = ['roll_number', 'name', 'photo_ref'];
    let dynamicFields = new Set<string>();

    // 2. Try to fetch assigned template to get specific fields
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: tmpls } = await supabase
          .from('id_templates')
          .select('*')
          .contains('assigned_schools', [user.id])
          .limit(1); // Assuming one main template for now

        if (tmpls && tmpls.length > 0) {
          const template = tmpls[0];
          const frontFields = extractTemplateFields((template as any).front_design);
          const backFields = extractTemplateFields((template as any).back_design);

          // Merge fields
          frontFields.forEach(f => dynamicFields.add(f));
          backFields.forEach(f => dynamicFields.add(f));
        }
      }
    } catch (e) {
      console.error("Error fetching template for CSV generation:", e);
    }

    // 3. Construct Final Header List
    // Always start with mandatory
    const headersList = [...mandatoryFields];

    // Add dynamic fields (excluding mandatory ones if they were detected)
    dynamicFields.forEach(f => {
      if (!mandatoryFields.includes(f)) {
        headersList.push(f);
      }
    });

    // Add standard optional fields if they are NOT in dynamic (to be safe? or strict?)
    // Requirement says: "if design having only name class phone photo then... must have ONLY that column"
    // So we should be STRICT if dynamic fields were found.
    // However, if NO dynamic fields found (e.g. blank design or fail), fallback to comprehensive default?

    if (dynamicFields.size === 0) {
      // Fallback to default comprehensive list
      ['email', 'phone', 'dob', 'blood_group', 'class', 'department', 'guardian_name', 'address', 'photo_ref'].forEach(f => {
        if (!headersList.includes(f)) headersList.push(f);
      });
    }

    // 4. Generate Sample Row
    const sampleRow = headersList.map(h => {
      if (h === 'roll_number') return 'STU001';
      if (h === 'name') return 'John Doe';
      if (h === 'email') return 'john@example.com';
      if (h === 'phone') return '9876543210';
      if (h === 'dob') return '2000-01-01';
      if (h === 'photo_ref') return 'img_001.jpg';
      return `Sample ${h}`; // Generic fallback
    }).join(',');

    const csvHeaderIdx = headersList.join(',');
    const csv = `${csvHeaderIdx}\n${sampleRow}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'school_student_template.csv';
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Template downloaded based on your assigned ID design.");
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <PageHeader
          title="Student Data Management"
          description="Import and manage your student records with ease."
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <Button
              onClick={downloadTemplate}
              className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
            >
              <Download className="h-4 w-4" />
              Download Smart Template
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="gap-2 border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </PageHeader>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Column: Actions (Uploads) */}
          <div className="lg:col-span-12 xl:col-span-8 space-y-8">

            {/* Quick Actions Grid */}
            <div className="grid md:grid-cols-2 gap-6">

              {/* CSV Upload Card */}
              <Card className="relative overflow-hidden border-none shadow-2xl bg-white/80 backdrop-blur-xl hover:shadow-3xl transition-all duration-300 group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardHeader className="relative z-10">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <FileSpreadsheet className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">Import CSV Batch</CardTitle>
                  <CardDescription className="text-gray-500">
                    Upload your student data (CSV).
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer group/drop',
                      isDragging
                        ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]'
                        : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50',
                      file && 'border-emerald-500 bg-emerald-50/30'
                    )}
                  >
                    {file ? (
                      <div className="space-y-4 animate-in zoom-in-50 duration-300">
                        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-100 shadow-inner">
                          <CheckCircle className="h-8 w-8 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg text-slate-800">{file.name}</p>
                          <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            setUploadResult(null);
                            setBatchName('');
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="h-20 w-full flex items-center justify-center">
                          <div className="relative">
                            <div className="absolute inset-0 bg-indigo-200 rounded-full blur-xl opacity-20 animate-pulse" />
                            <Upload className="relative h-10 w-10 text-indigo-400 group-hover/drop:text-indigo-600 transition-colors duration-300" />
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-slate-700">
                            Drag & drop or <span className="text-indigo-600 font-semibold underlin-offset-4 hover:underline">browse</span>
                          </p>
                          <p className="text-xs text-slate-400 mt-1">Supports .csv files</p>
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
                    <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-bottom-4">
                      <Label htmlFor="batch-name" className="text-sm font-semibold text-slate-700">Batch Name</Label>
                      <Input
                        id="batch-name"
                        value={batchName}
                        onChange={(e) => setBatchName(e.target.value)}
                        placeholder="e.g. Class 10 - 2024"
                        className="h-11 border-slate-200 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      />
                      <Button
                        onClick={handleUpload}
                        disabled={isUploading || !batchName.trim()}
                        className="w-full h-11 bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg disabled:opacity-50 hover:from-black hover:to-slate-900 transition-all rounded-lg font-medium"
                      >
                        {isUploading ? <Loader2 className="animate-spin mr-2" /> : "Start Import"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Photo Upload Card */}
              <Card className="relative overflow-hidden border-none shadow-2xl bg-white/80 backdrop-blur-xl hover:shadow-3xl transition-all duration-300 group">
                <div className="absolute inset-0 bg-gradient-to-bl from-pink-50/50 via-rose-50/30 to-orange-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardHeader className="relative z-10">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Upload className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">Batch Photos</CardTitle>
                  <CardDescription className="text-gray-500">
                    Auto-match & upload student photos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 relative z-10">
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-pink-300 hover:bg-pink-50/30 transition-all duration-300 relative group/photo">
                    <input
                      type="file"
                      id="bulk-photos"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                    <Label htmlFor="bulk-photos" className="cursor-pointer block">
                      <div className="flex flex-col items-center gap-3">
                        {photoFiles.length > 0 ? (
                          <>
                            <CheckCircle className="h-10 w-10 text-emerald-500 drop-shadow-md" />
                            <span className="font-semibold text-emerald-700">{photoFiles.length} Photos Selected</span>
                          </>
                        ) : (
                          <>
                            <div className="p-3 bg-rose-50 rounded-full group-hover/photo:bg-white transition-colors">
                              <Upload className="h-6 w-6 text-rose-500" />
                            </div>
                            <span className="text-sm font-medium text-slate-600">Select Folder</span>
                          </>
                        )}
                      </div>
                    </Label>
                  </div>

                  {photoFiles.length > 0 && (
                    <div className="space-y-4 animate-in slide-in-from-bottom-2">
                      {photoUploadProgress && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-semibold uppercase text-slate-500 tracking-wider">
                            <span>Processing</span>
                            <span>{Math.round((photoUploadProgress.processed / photoUploadProgress.total) * 100)}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-300 ease-out"
                              style={{ width: `${(photoUploadProgress.processed / photoUploadProgress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <Button
                        onClick={handleBulkPhotoUpload}
                        disabled={!!photoUploadProgress}
                        className="w-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg disabled:opacity-50"
                      >
                        {photoUploadProgress ? <Loader2 className="animate-spin mr-2" /> : "Start Photo Match"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

            {/* Results Section */}
            {uploadResult && (
              <div className="animate-in fade-in slide-in-from-top-4">
                <Card className="border-l-4 border-l-slate-800 shadow-xl bg-white/90 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-emerald-600" />
                      Import Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                        <div className="text-2xl font-bold text-emerald-700">{uploadResult.success}</div>
                        <div className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Success</div>
                      </div>
                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                        <div className="text-2xl font-bold text-rose-700">{uploadResult.failed}</div>
                        <div className="text-xs font-medium text-rose-600 uppercase tracking-wide">Failed</div>
                      </div>
                    </div>
                    {uploadResult.errors.length > 0 && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-rose-600 mb-2">
                          <AlertCircle className="h-4 w-4" /> Import Errors
                        </h4>
                        <ul className="space-y-1">
                          {uploadResult.errors.map((err, i) => (
                            <li key={i} className="text-xs text-slate-600 font-mono">• {err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Existing Batches List (Enhanced) */}
            <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-bold text-slate-800">Recent Batches</CardTitle>
                    <CardDescription>Manage and submit your data batches.</CardDescription>
                  </div>
                  <Database className="h-5 w-5 text-slate-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-100 overflow-hidden bg-white/50">
                  {loadingBatches ? (
                    <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>
                  ) : existingBatches.length > 0 ? (
                    <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow>
                          <TableHead className="font-semibold text-slate-700">Batch Info</TableHead>
                          <TableHead className="text-right font-semibold text-slate-700">Created</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {existingBatches.map((batch) => (
                          <TableRow key={batch.id} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell>
                              <div className="font-medium text-slate-900">{batch.batch_name}</div>
                              <div className="mt-1">
                                <span className={cn(
                                  "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                  batch.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                    batch.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                                      batch.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                                        'bg-slate-100 text-slate-600'
                                )}>
                                  {batch.status || 'DRAFT'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs text-slate-500">
                              {new Date(batch.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-2">
                                {batch.status === 'draft' && (
                                  <Button
                                    size="sm"
                                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                                    onClick={async () => {
                                      if (confirm("Submit this batch?")) {
                                        await supabase.from('print_batches' as any).update({ status: 'submitted', submitted_at: new Date() }).eq('id', batch.id);
                                        toast.success("Batch Submitted!");
                                        fetchBatches();
                                      }
                                    }}
                                  >
                                    Submit
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
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
                    <div className="p-12 text-center">
                      <p className="text-slate-500 mb-2">No batches yet</p>
                      <p className="text-xs text-slate-400">Import a CSV to get started</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right Column: Template Preview */}
          <div className="lg:col-span-12 xl:col-span-4 space-y-6">
            <div className="sticky top-6">
              <Card className="overflow-hidden border-none shadow-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CardIcon className="h-5 w-5 text-indigo-400" />
                    Your ID Template
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Live preview of your school's assigned design.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-8 pt-4">
                  {previewImage ? (
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg blur opacity-50 group-hover:opacity-100 transition duration-500" />
                      <div className="relative rounded-lg overflow-hidden bg-white shadow-2xl transform group-hover:scale-[1.02] transition-all duration-500">
                        <img
                          src={previewImage}
                          alt="ID Preview"
                          className="max-w-full w-auto max-h-[400px] object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 w-full flex items-center justify-center border-2 border-dashed border-slate-600/50 rounded-lg bg-slate-800/50">
                      <span className="text-slate-500 text-sm">No template assigned</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CSV Guide */}
              <Card className="mt-6 border-none shadow-xl bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Quick Guide</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                      <p className="text-slate-600"><span className="font-semibold text-slate-900">Download Template</span> to get the correct headers.</p>
                    </div>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                      <p className="text-slate-600"><span className="font-semibold text-slate-900">Fill Data</span> ensuring unique Roll Numbers.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 text-xs font-bold">3</div>
                      <p className="text-slate-600"><span className="font-semibold text-slate-900">Upload Photos</span> matching the exact filenames in your CSV.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>

  );
}
