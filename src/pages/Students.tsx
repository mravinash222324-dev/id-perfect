
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
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
  Download,
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
  school_id: string; // Ensure this is present for template fetching
}

import { BatchPhotoUploadDialog } from '@/components/students/BatchPhotoUploadDialog';

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [searchParams] = useSearchParams();
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isBatchUploadOpen, setIsBatchUploadOpen] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
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
    (student) => {
      // Batch ID filter
      const batchQuery = searchParams.get('batchId');
      if (batchQuery && (student as any).print_batch_id !== batchQuery) return false;

      return (
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
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
    <DashboardLayout>
      <PageHeader
        title="Students"
        description="Manage student records and verification status"
      >
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setIsBatchUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Batch Photos
          </Button>
          <Button className="gradient-primary gap-2">
            <Plus className="h-4 w-4" />
            Add Student
          </Button>
        </div>
      </PageHeader>

      <BatchPhotoUploadDialog
        open={isBatchUploadOpen}
        onOpenChange={setIsBatchUploadOpen}
        onUploadComplete={() => {
          fetchStudents(); // Refresh list to show new photos
          setIsBatchUploadOpen(false);
        }}
      />

      <Card>
        <CardContent className="p-6">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, roll number, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredStudents.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Student</TableHead>
                    <TableHead className="w-[50px]">Photo</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                            {student.photo_url ? (
                              <img
                                src={student.photo_url}
                                alt={student.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Users className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {student.email || 'No email'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`photo-${student.id}`} className="cursor-pointer hover:bg-muted p-1 rounded-md">
                            <Upload className="h-4 w-4 text-muted-foreground" />
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
                      <TableCell className="font-mono text-sm">
                        {student.roll_number}
                      </TableCell>
                      <TableCell>{student.class || '-'}</TableCell>
                      <TableCell>{student.department || '-'}</TableCell>
                      <TableCell>
                        <StatusBadge status={student.verification_status as any} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(student.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2">
                              <Eye className="h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2" onClick={() => handleEditClick(student)}>
                              <Edit className="h-4 w-4" />
                              Edit & Preview
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
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No students found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Get started by uploading student data'}
              </p>
              {!searchQuery && (
                <Button className="gradient-primary gap-2">
                  <Plus className="h-4 w-4" />
                  Add Student
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {editingStudent && (
        <StudentEditDialog
          student={editingStudent}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          onSave={() => {
            fetchStudents();
            // Optionally refresh if preview image logic depends on it
          }}
        />
      )}
    </DashboardLayout>
  );
}
