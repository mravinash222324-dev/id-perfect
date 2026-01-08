import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
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
    Eye,
    Edit,
    Trash2,
    Users,
    Upload,
} from 'lucide-react';
import { format } from 'date-fns';
import { StudentEditDialog } from '@/components/students/StudentEditDialog';

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
}

export function StudentManager({ batchId }: StudentManagerProps) {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    useEffect(() => {
        if (batchId) {
            fetchStudents();
        }
    }, [batchId]);

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const { data, error } = await (supabase as any)
                .from('students')
                .select('*')
                .eq('print_batch_id', batchId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setStudents((data || []) as any[]);
        } catch (error) {
            console.error('Error fetching students:', error);
            toast.error('Failed to fetch students');
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = students.filter(
        (student) =>
            student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

    return (
        <div className="space-y-4">
            {/* Search Bar - Simplified for Modal */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search students..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button size="sm" className="gradient-primary gap-2" onClick={() => {
                    // Include Add Student logic? Or just rely on CSV?
                    // User didn't explicitly ask for Add, but it's good to have.
                    // For now, let's keep it simple or minimal.
                    // Let's hide Add for now as the user focused on Review/Batch Upload.
                    toast.info("To add students, please use Batch Upload.");
                }}>
                    <Plus className="h-4 w-4" />
                    Add
                </Button>
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
                                <TableHead>Student</TableHead>
                                <TableHead className="w-[50px]">Photo</TableHead>
                                <TableHead>Roll Number</TableHead>
                                <TableHead>Class</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredStudents.map((student) => (
                                <TableRow key={student.id} className="hover:bg-muted/30">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                                                {student.photo_url ? (
                                                    <img
                                                        src={student.photo_url}
                                                        alt={student.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <Users className="h-4 w-4 text-primary" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{student.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {student.email || 'No email'}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor={`photo-${student.id}`} className="cursor-pointer hover:bg-muted p-1 rounded-md">
                                                <Upload className="h-3 w-3 text-muted-foreground" />
                                            </Label>
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
                                    <TableCell className="font-mono text-xs">
                                        {student.roll_number}
                                    </TableCell>
                                    <TableCell className="text-xs">{student.class || '-'}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <MoreHorizontal className="h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem className="gap-2" onClick={() => handleEditClick(student)}>
                                                    <Edit className="h-4 w-4" />
                                                    Edit
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
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">No students found in this batch.</p>
                </div>
            )}

            {editingStudent && (
                <StudentEditDialog
                    student={editingStudent}
                    open={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    onSave={() => {
                        fetchStudents();
                    }}
                />
            )}
        </div>
    );
}
