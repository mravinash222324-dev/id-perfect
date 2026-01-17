
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
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { StudentEditDialog } from '@/components/students/StudentEditDialog';
import { BatchPhotoUploadDialog } from '@/components/students/BatchPhotoUploadDialog';
import { motion, AnimatePresence } from 'framer-motion';

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
}

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <PageHeader
          title="Students"
          description="Manage student records and verification status"
        />
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 glass border-white/10 hover:bg-white/5" onClick={() => setIsBatchUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Batch Photos
          </Button>
          <Button className="gradient-primary gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
            <Plus className="h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>

      <BatchPhotoUploadDialog
        open={isBatchUploadOpen}
        onOpenChange={setIsBatchUploadOpen}
        onUploadComplete={() => {
          fetchStudents();
          setIsBatchUploadOpen(false);
        }}
      />

      <Card className="glass-card border-none overflow-hidden">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row gap-4 items-center bg-black/20">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-black/20 border-white/10 focus:border-primary/50 text-white h-10 w-full transition-all hover:bg-black/30"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="icon" className="border-white/10 bg-black/20 hover:bg-white/5">
                <Filter className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="outline" className="gap-2 border-white/10 bg-black/20 hover:bg-white/5 flex-1 sm:flex-none">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredStudents.length > 0 ? (
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-muted-foreground pl-6">Student</TableHead>
                    <TableHead className="text-muted-foreground w-[50px]">Photo</TableHead>
                    <TableHead className="text-muted-foreground">Roll Number</TableHead>
                    <TableHead className="text-muted-foreground h-12">Class</TableHead>
                    <TableHead className="text-muted-foreground">Department</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Added</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {filteredStudents.map((student, index) => (
                      <motion.tr
                        key={student.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className="group border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-primary/50 transition-colors">
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
                              <p className="font-medium text-white group-hover:text-primary transition-colors">{student.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {student.email || 'No email'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`photo-${student.id}`} className="cursor-pointer hover:bg-white/10 p-1.5 rounded-full transition-colors group/upload">
                              <Upload className="h-4 w-4 text-muted-foreground group-hover/upload:text-primary transition-colors" />
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
                        <TableCell className="font-mono text-sm text-muted-foreground group-hover:text-white transition-colors">
                          {student.roll_number}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{student.class || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{student.department || '-'}</TableCell>
                        <TableCell>
                          <StatusBadge status={student.verification_status as any} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(student.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 hover:text-white">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#0f0f13] border-white/10 text-white">
                              <DropdownMenuItem className="gap-2 hover:bg-white/10 focus:bg-white/10 cursor-pointer">
                                <Eye className="h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 hover:bg-white/10 focus:bg-white/10 cursor-pointer" onClick={() => handleEditClick(student)}>
                                <Edit className="h-4 w-4" />
                                Edit & Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 cursor-pointer"
                                onClick={() => handleDelete(student.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-6">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2 text-white">No students found</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Get started by uploading your student data via CSV or adding manually.'}
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
          }}
        />
      )}
    </DashboardLayout>
  );
}
