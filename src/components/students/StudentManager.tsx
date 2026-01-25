import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
    Search,
    Plus,
    MoreHorizontal,
    Edit,
    Trash2,
    Users,
    Upload,
    AlertCircle,
    CheckCircle2,
    XCircle,
    FileDown,
    Loader2
} from 'lucide-react';
import { StudentEditDialog } from '@/components/students/StudentEditDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { extractTemplateVars } from '@/utils/cardRenderer';
import { generateBatchProofPDF } from '@/utils/pdfGenerator';

interface Student {
    id: string;
    roll_number: string;
    name: string;
    email: string | null;
    phone: string | null;
    class: string | null;
    department: string | null;
    verification_status: string;
    photo_url: string | null;
    created_at: string;
    school_id: string;
    print_batch_id: string;
}

interface StudentManagerProps {
    batchId: string;
    readOnly?: boolean;
}

export function StudentManager({ batchId, readOnly = false }: StudentManagerProps) {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [requiredFields, setRequiredFields] = useState<string[]>([]);

    useEffect(() => {
        if (batchId) {
            fetchData();
        }
    }, [batchId]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Students
            const { data: studentsData, error: studentError } = await (supabase as any)
                .from('students')
                .select('*')
                .eq('print_batch_id', batchId)
                .order('created_at', { ascending: false });

            if (studentError) throw studentError;

            // 2. Fetch Template to determine validation rules
            // We need school_id from batch or student. Let's get it from first student or auth?
            // Safer to get from auth user as this is school dashboard
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: tmpls } = await supabase
                    .from('id_templates')
                    .select('*')
                    .contains('assigned_schools', [user.id])
                    .limit(1);

                if (tmpls && tmpls.length > 0) {
                    const template = tmpls[0];

                    const frontVars = extractTemplateVars((template as any).front_design);
                    const backVars = extractTemplateVars((template as any).back_design);
                    const allVars = new Set([...frontVars, ...backVars, 'name', 'roll_number', 'photo_url']); // Mandatory
                    setRequiredFields(Array.from(allVars));
                } else {
                    // Fallback defaults if no template
                    setRequiredFields(['name', 'roll_number', 'class', 'photo_url']);
                }
            }

            setStudents((studentsData || []) as any[]);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to fetch batch data');
        } finally {
            setLoading(false);
        }
    };

    const validateStudent = (student: Student) => {
        const errors: string[] = [];

        // Always Required
        if (!student.name || student.name.trim() === '') errors.push('Name');
        if (!student.roll_number || student.roll_number.trim() === '') errors.push('Roll Number');
        if (!student.photo_url) errors.push('Photo');

        // Dynamic Validation based on Template
        // We skip name/roll/photo as they are handled above
        requiredFields.forEach(field => {
            if (['name', 'roll_number', 'photo_url', 'id', 'created_at'].includes(field)) return;

            // For other fields like class, department, blood_group, phone etc.
            // Check if they are empty
            const val = (student as any)[field];
            if (!val || String(val).trim() === '') {
                // Format field name for UI
                const label = field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ');
                errors.push(label);
            }
        });

        return errors;
    };

    const processedStudents = useMemo(() => {
        return students.map(student => {
            const errors = validateStudent(student);
            return {
                ...student,
                isValid: errors.length === 0,
                errors
            };
        });
    }, [students, requiredFields]);

    const filteredStudents = processedStudents.filter(student => {
        // 1. Search Filter
        const matchesSearch =
            student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.email?.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        // 2. Tab Filter
        if (activeTab === 'verified') return student.isValid;
        if (activeTab === 'unverified') return !student.isValid;
        return true;
    });

    const stats = useMemo(() => {
        const total = processedStudents.length;
        const verified = processedStudents.filter(s => s.isValid).length;
        const unverified = total - verified;
        return { total, verified, unverified };
    }, [processedStudents]);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this student?')) return;

        try {
            const { error } = await supabase.from('students').delete().eq('id', id);
            if (error) throw error;

            setStudents(students.filter((s) => s.id !== id));
            toast.success('Student deleted successfully');
        } catch (error) {
            console.error('Error deleting student:', error);
            toast.error('Failed to delete student');
        }
    };

    const handlePhotoUpload = async (file: File, studentId: string) => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${studentId}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('student-photos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('student-photos')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from('students')
                .update({ photo_url: publicUrl })
                .eq('id', studentId);

            if (updateError) throw updateError;

            setStudents(students.map(s => s.id === studentId ? { ...s, photo_url: publicUrl } : s));
            toast.success('Photo uploaded successfully');
        } catch (error) {
            console.error('Error uploading photo:', error);
            toast.error('Failed to upload photo');
        }
    };

    const handleEditClick = (student: Student) => {
        setEditingStudent(student);
        setIsEditOpen(true);
    };

    const [generatingPdf, setGeneratingPdf] = useState(false);

    // ... existing code ...

    const handleDownloadProof = async () => {
        try {
            setGeneratingPdf(true);
            toast.info("Generating Proof PDF... This may take a moment.");

            // Get Template
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user found");

            const { data: tmpls } = await supabase
                .from('id_templates')
                .select('*')
                .contains('assigned_schools', [user.id])
                .limit(1);

            if (!tmpls || tmpls.length === 0) {
                toast.error("No ID Card Template assigned. Cannot generate proof.");
                return;
            }
            const template = tmpls[0];

            // Filter: Enforce only VALID/VERIFIED students for Proof PDF
            const studentsToPrint = filteredStudents.filter(s => s.isValid);

            if (studentsToPrint.length === 0) {
                toast.error("No students to print in current view.");
                return;
            }

            const pdf = await generateBatchProofPDF(studentsToPrint, template, {
                watermarkUrl: '/razid_watermark.png'
            });

            pdf.save(`Proof_Batch_${batchId}_${activeTab}.pdf`);
            toast.success("PDF Downloaded successfully!");

        } catch (error) {
            console.error("Error generating PDF", error);
            toast.error("Failed to generate PDF");
        } finally {
            setGeneratingPdf(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                {/* Search Bar */}
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search students..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <div className="flex items-center gap-2">
                    {/* PDF Dowload Button */}
                    <Button
                        variant="outline"
                        onClick={handleDownloadProof}
                        disabled={generatingPdf || loading}
                        className="gap-2"
                    >
                        {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                        Proof PDF
                    </Button>

                    {/* Tabs for Filtering */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                        <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
                            <TabsTrigger value="all">
                                All <span className="ml-2 text-xs bg-muted-foreground/20 px-1.5 rounded-full">{stats.total}</span>
                            </TabsTrigger>
                            <TabsTrigger value="verified" className="data-[state=active]:text-emerald-500">
                                Verified <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-500 px-1.5 rounded-full">{stats.verified}</span>
                            </TabsTrigger>
                            <TabsTrigger value="unverified" className="data-[state=active]:text-rose-500">
                                Unverified <span className="ml-2 text-xs bg-rose-500/20 text-rose-500 px-1.5 rounded-full">{stats.unverified}</span>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : filteredStudents.length > 0 ? (
                <div className="rounded-lg border border-border overflow-hidden max-h-[60vh] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[300px]">Student Details</TableHead>
                                <TableHead className="w-[100px]">Photo</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Class/Dept</TableHead>
                                {!readOnly && <TableHead className="w-[50px]"></TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredStudents.map((student) => (
                                <TableRow key={student.id} className="hover:bg-muted/30">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center overflow-hidden border ${student.isValid ? 'border-border' : 'border-rose-500/50 bg-rose-500/10'}`}>
                                                {student.photo_url ? (
                                                    <img
                                                        src={student.photo_url}
                                                        alt={student.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <Users className={`h-5 w-5 ${student.isValid ? 'text-primary' : 'text-rose-500'}`} />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{student.name || <span className="text-rose-500 italic">No Name</span>}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs text-muted-foreground">{student.roll_number || 'No ID'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Label htmlFor={`photo-${student.id}`} className={`cursor-pointer p-2 rounded-md hover:bg-muted transition-colors ${!student.photo_url ? 'animate-pulse bg-rose-500/10 text-rose-500' : ''}`}>
                                                        <Upload className="h-4 w-4" />
                                                    </Label>
                                                </TooltipTrigger>
                                                <TooltipContent>Upload Photo</TooltipContent>
                                            </Tooltip>
                                            <Input
                                                id={`photo-${student.id}`}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        handlePhotoUpload(e.target.files[0], student.id);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {student.isValid ? (
                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 pl-1">
                                                <CheckCircle2 className="h-3 w-3" /> Verified
                                            </Badge>
                                        ) : (
                                            <div className="flex flex-col gap-1 items-start">
                                                <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20 gap-1 pl-1 mb-1">
                                                    <XCircle className="h-3 w-3" /> Incomplete
                                                </Badge>
                                                <div className="flex flex-wrap gap-1">
                                                    {student.errors.map(err => (
                                                        <span key={err} className="text-[10px] font-bold text-rose-400 bg-rose-500/5 px-1 rounded">{err}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        <div className="flex flex-col">
                                            <span>{student.class || '-'}</span>
                                            <span className="text-xs text-muted-foreground">{student.department}</span>
                                        </div>
                                    </TableCell>
                                    {!readOnly && (
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem className="gap-2" onClick={() => handleEditClick(student)}>
                                                        <Edit className="h-4 w-4" />
                                                        Edit / Fix
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="gap-2 text-destructive focus:text-destructive"
                                                        onClick={() => handleDelete(student.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="text-center py-16 border rounded-lg border-dashed">
                    <p className="text-muted-foreground">No students found in this category.</p>
                    {searchQuery && <Button variant="link" onClick={() => setSearchQuery('')}>Clear Search</Button>}
                </div>
            )}

            {editingStudent && (
                <StudentEditDialog
                    student={editingStudent}
                    open={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    requiredFields={requiredFields}
                    onSave={() => {
                        fetchData();
                    }}
                />
            )}
        </div>
    );
}
