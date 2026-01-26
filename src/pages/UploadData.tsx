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
import { getRequiredFields, validateStudent } from '@/utils/studentValidation';

interface UploadResult {
  success: number;
  failed: number;
  verified: number;
  unverified: number;
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
      // Improved CSV regex to handle quoted commas
      // Matches commas not inside quotes
      const values = lines[i].match(/(?:\"([^\"]*)\")|([^,]+)|(?<=,)(?=,)|^(?=,)|(?<=,)$/g) || [];
      // Clean up values: remove quotes if present, trim
      const cleanedValues = values.map(v => {
        if (!v) return '';
        const trimmed = v.trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          return trimmed.slice(1, -1).trim();
        }
        return trimmed.replace(/^,|,$/g, '').trim(); // Remove leading/trailing commas from split artifacts if any
      });

      // The above regex is tricky. Let's use a simpler split approach for robustness
      // split by , but ignore inside quotes
      const matches = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
      // Fallback if match fails (e.g. empty fields)
      let rowValues: string[] = [];

      if (matches) {
        rowValues = matches.map(m => m.replace(/^"|"$/g, '').trim());
      } else {
        // Fallback to simple split if regex fails completely (unlikely for valid CSVs but safe)
        rowValues = lines[i].split(',').map(v => v.trim());
      }

      // Fix: The regex above might miss empty fields between commas (e.g. ,,).
      // Better approach:
      const rowData = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = rowData[index] || '';
      });
      rows.push(row);
    }

    return rows;
  };

  const handleUnifiedProcess = async () => {
    if (!file) {
      toast.error('Please upload a CSV file');
      return;
    }
    if (!batchName.trim()) {
      toast.error("Please enter a batch name");
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      // 1. Create Batch
      const { data: { user } } = await supabase.auth.getUser();
      const { data: batchData, error: batchError } = await supabase
        .from('print_batches' as any)
        .insert([{
          batch_name: batchName,
          school_id: user?.id,
          status: 'draft'
        }])
        .select()
        .single();

      if (batchError) throw batchError;
      const batchId = (batchData as any).id;

      // 2. Process CSV
      const text = await file.text();
      const rows = parseCSV(text);
      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      // Create lookup maps for photo matching
      const rollMap = new Map();
      const refMap = new Map();

      // Insert Students
      for (const row of rows) {
        try {
          const rollNumber = row.roll_number || row.id || row.student_id || `STU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const photoRef = row.photo_ref || row.photo_name || row.filename || row.image_name || null;

          const studentData = {
            roll_number: rollNumber,
            name: row.name || row.student_name || row.full_name || '', // Changed from 'Unknown' to empty string for validation
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
            school_id: user?.id,
            photo_ref: photoRef
          };

          const { data: insertedStudent, error } = await supabase
            .from('students')
            .insert(studentData)
            .select('id, roll_number, photo_ref')
            .single();

          if (error) {
            errors.push(`Row ${success + failed + 1}: ${error.message}`);
            failed++;
          } else {
            success++;
            // Populate maps for photo matching
            if (insertedStudent) {
              if (insertedStudent.roll_number) rollMap.set(String(insertedStudent.roll_number).toLowerCase().trim(), insertedStudent.id);
              if (insertedStudent.photo_ref) refMap.set(String(insertedStudent.photo_ref).toLowerCase().trim(), insertedStudent.id);
            }
          }
        } catch (err) {
          failed++;
          errors.push(`Row parsing error`);
        }
      }

      // 3. Process Photos
      let photosMatched = 0;
      if (photoFiles.length > 0) {
        toast.info("Uploading and matching photos...");

        for (const pFile of photoFiles) {
          const name = pFile.name;
          const nameKey = name.toLowerCase().trim();
          const nameNoExt = name.substring(0, name.lastIndexOf('.')) || name;
          const nameNoExtLower = nameNoExt.toLowerCase().trim();

          let studentId = refMap.get(nameKey) || refMap.get(nameNoExtLower) || rollMap.get(nameKey) || rollMap.get(nameNoExtLower);

          if (studentId) {
            try {
              const fileExt = name.split('.').pop();
              const storagePath = `${studentId}-${Date.now()}.${fileExt}`;
              await supabase.storage.from('student-photos').upload(storagePath, pFile, { upsert: true });
              const { data: { publicUrl } } = supabase.storage.from('student-photos').getPublicUrl(storagePath);

              await supabase.from('students').update({ photo_url: publicUrl }).eq('id', studentId);
              photosMatched++;
            } catch (e) {
              console.error("Photo upload failed", e);
            }
          }
        }
      }

      // 4. Calculate Verified Status accurately using Shared Validation Logic
      // Fetch all students for this batch to validate them fully
      const { data: batchStudents } = await supabase
        .from('students')
        .select('*')
        .eq('print_batch_id', batchId);

      let verifiedCount = 0;
      let unverifiedCount = 0;

      if (batchStudents) {
        // Get Template for validation rules
        let reqFields: string[] = ['name', 'roll_number', 'photo_url'];
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: tmpls } = await supabase
            .from('id_templates')
            .select('*')
            .contains('assigned_schools', [user.id])
            .limit(1);
          if (tmpls && tmpls.length > 0) {
            reqFields = getRequiredFields(tmpls[0]);
          }
        }

        batchStudents.forEach(s => {
          const errors = validateStudent(s, reqFields);
          if (errors.length === 0) {
            verifiedCount++;
          } else {
            unverifiedCount++;
          }
        });
      } else {
        // Fallback if fetch fails
        verifiedCount = photosMatched;
        unverifiedCount = success - photosMatched;
      }

      setUploadResult({
        success,
        failed,
        verified: verifiedCount,
        unverified: unverifiedCount,
        errors
      });
      toast.success(`Batch Created! Imported ${success} students, Matched ${photosMatched} photos.`);

      // Clear Form
      setFile(null);
      setPhotoFiles([]);
      setBatchName('');
      fetchBatches();

      // Navigation to Drafts will happen via the user clicking the new "Drafts" link or we can auto-redirect
      // For now, let's just show success

    } catch (error: any) {
      console.error('Process error:', error);
      toast.error('Failed to create batch: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotoFiles(Array.from(e.target.files));
    }
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
          title="New Card Batch"
          description="Import student data and manage ID card photos."
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <Button
              onClick={downloadTemplate}
              className="gap-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 hover:shadow-[0_0_15px_rgba(124,58,237,0.3)] transition-all duration-300"
            >
              <Download className="h-4 w-4" />
              Download Smart Template
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="gap-2 border-white/10 bg-white/5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </PageHeader>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Column: Actions (Uploads) */}
          <div className="lg:col-span-12 xl:col-span-8 space-y-8">

            {/* Unified Upload Card */}
            <Card className="relative overflow-hidden border-white/10 shadow-2xl bg-black/40 backdrop-blur-xl hover:shadow-primary/20 transition-all duration-300 group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-white">Create New Batch</CardTitle>
                    <CardDescription className="text-muted-foreground">Upload CSV and matched photos in one go.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 relative z-10">
                {/* Batch Name Input */}
                <div className="space-y-2">
                  <Label htmlFor="batch-name" className="text-sm font-medium text-slate-300">Batch Name</Label>
                  <Input
                    id="batch-name"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="e.g. Class 10 - 2024"
                    className="h-11 bg-black/20 border-white/10 text-white focus:ring-primary/50"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* CSV Upload Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className={cn(
                      'relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 cursor-pointer group/drop min-h-[160px] flex flex-col items-center justify-center',
                      file ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 hover:border-primary/50 hover:bg-white/5'
                    )}
                  >
                    {file ? (
                      <div className="space-y-2 animate-in zoom-in-50 duration-300">
                        <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto" />
                        <p className="font-semibold text-white text-sm">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <FileSpreadsheet className="h-8 w-8 text-primary/50 mx-auto group-hover/drop:text-primary transition-colors" />
                        <p className="font-medium text-sm text-slate-300">Upload CSV</p>
                        <p className="text-xs text-muted-foreground">Drag & drop or click</p>
                      </div>
                    )}
                    <Input id="file-upload" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                  </div>

                  {/* Photos Upload Zone */}
                  <div className="relative border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-pink-500/50 hover:bg-pink-500/5 transition-all duration-300 min-h-[160px] flex flex-col items-center justify-center relative cursor-pointer group/photo">
                    <input
                      type="file"
                      id="bulk-photos"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                    <Label htmlFor="bulk-photos" className="cursor-pointer block w-full h-full flex flex-col items-center justify-center">
                      {photoFiles.length > 0 ? (
                        <div className="space-y-2">
                          <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto drop-shadow-md" />
                          <p className="font-semibold text-emerald-400 text-sm">{photoFiles.length} Photos</p>
                          <p className="text-xs text-muted-foreground">Ready to match</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-8 w-8 text-pink-400/50 mx-auto group-hover/photo:text-pink-400 transition-colors" />
                          <p className="font-medium text-sm text-slate-300">Upload Photos</p>
                          <p className="text-xs text-muted-foreground">Select folder (Optional)</p>
                        </div>
                      )}
                    </Label>
                  </div>
                </div>

                <Button
                  onClick={handleUnifiedProcess}
                  disabled={isUploading || !batchName.trim() || !file}
                  className="w-full h-12 bg-gradient-to-r from-primary to-violet-600 text-white shadow-lg disabled:opacity-50 hover:shadow-primary/20 text-lg font-medium"
                >
                  {isUploading ? <Loader2 className="animate-spin mr-2" /> : "Confirm & Process Batch"}
                </Button>
              </CardContent>
            </Card>

            {/* Results Section */}
            {uploadResult && (
              <div className="animate-in fade-in slide-in-from-top-4">
                <Card className="border-l-4 border-l-emerald-500 shadow-xl bg-black/60 backdrop-blur border-t-0 border-r-0 border-b-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                      <FileCheck className="h-5 w-5 text-emerald-500" />
                      Import Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">

                      {/* Total Uploaded */}
                      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <div className="text-2xl font-bold text-blue-400">{uploadResult.success}</div>
                        <div className="text-xs font-medium text-blue-500/70 uppercase tracking-wide">Total Students</div>
                      </div>

                      {/* Verified (Complete) */}
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="text-2xl font-bold text-emerald-400">{uploadResult.verified}</div>
                        <div className="text-xs font-medium text-emerald-500/70 uppercase tracking-wide">Verified (Complete)</div>
                      </div>

                      {/* Unverified (Incomplete) */}
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <div className="text-2xl font-bold text-amber-400">{uploadResult.unverified}</div>
                        <div className="text-xs font-medium text-amber-500/70 uppercase tracking-wide">Unverified (No Photo)</div>
                      </div>

                      {/* Failed (Errors) */}
                      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                        <div className="text-2xl font-bold text-rose-400">{uploadResult.failed}</div>
                        <div className="text-xs font-medium text-rose-500/70 uppercase tracking-wide">Failed Rows</div>
                      </div>
                    </div>
                    {uploadResult.errors.length > 0 && (
                      <div className="p-4 rounded-xl bg-black/20 border border-white/5 max-h-40 overflow-y-auto custom-scrollbar">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-rose-400 mb-2">
                          <AlertCircle className="h-4 w-4" /> Import Errors
                        </h4>
                        <ul className="space-y-1">
                          {uploadResult.errors.map((err, i) => (
                            <li key={i} className="text-xs text-slate-400 font-mono">• {err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Navigation to Drafts Hint */}
            <div className="text-center p-6 border border-white/5 rounded-xl bg-white/[0.02]">
              <p className="text-muted-foreground mb-4">Looking for your existing batches?</p>
              <Button variant="outline" onClick={() => navigate('/drafts')} className="gap-2 border-white/10 hover:bg-white/5">
                Visit Drafts & History
              </Button>
            </div>
          </div>

          {/* Right Column: Template Preview */}
          < div className="lg:col-span-12 xl:col-span-4 space-y-6" >
            <div className="sticky top-6">
              <Card className="overflow-hidden border-white/10 shadow-2xl bg-black/40 backdrop-blur-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg text-white">
                    <CardIcon className="h-5 w-5 text-primary" />
                    Your ID Template
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Live preview of your school's assigned design.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-8 pt-4">
                  {previewImage ? (
                    <div className="relative group w-full">
                      <div className="absolute -inset-1 bg-gradient-to-r from-primary to-violet-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500" />
                      <div className="relative rounded-lg overflow-hidden bg-black/50 shadow-2xl transform group-hover:scale-[1.02] transition-all duration-500 border border-white/10">
                        <img
                          src={previewImage}
                          alt="ID Preview"
                          className="w-full h-auto object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 w-full flex items-center justify-center border-2 border-dashed border-white/10 rounded-lg bg-white/5">
                      <span className="text-muted-foreground text-sm">No template assigned</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CSV Guide */}
              <Card className="mt-6 border-white/10 shadow-xl bg-black/40 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Quick Guide</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-xs font-bold border border-primary/20">1</div>
                      <p className="text-slate-300"><span className="font-semibold text-white">Download Template</span> to get the correct headers.</p>
                    </div>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-xs font-bold border border-primary/20">2</div>
                      <p className="text-slate-300"><span className="font-semibold text-white">Fill Data</span> ensuring unique Roll Numbers.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-xs font-bold border border-primary/20">3</div>
                      <p className="text-slate-300"><span className="font-semibold text-white">Upload Photos</span> matching the exact filenames in your CSV.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div >
        </div >
      </div >
    </DashboardLayout >
  );
}
