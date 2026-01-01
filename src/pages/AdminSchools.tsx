
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Loader2,
    Plus,
    Search,
    School,
    MoreHorizontal,
    Copy,
    Check
} from 'lucide-react';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface SchoolProfile {
    id: string;
    full_name: string;
    institution_name: string | null;
    created_at: string;
    user_id: string;
    email?: string; // We might not get email from profiles depending on privacy, mostly relies on auth.users which is restricted.
    // We will try to map via user_roles or just show name.
}

export default function AdminSchools() {
    const [schools, setSchools] = useState<SchoolProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [inviteLink, setInviteLink] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchSchools();
    }, []);

    const fetchSchools = async () => {
        try {
            setLoading(true);
            // 1. Get all users with 'school' or 'teacher' role
            const { data: roleData, error: roleError } = await supabase
                .from('user_roles')
                .select('user_id, role')
                .in('role', ['school', 'teacher'] as any);

            if (roleError) throw roleError;

            if (!roleData || roleData.length === 0) {
                setSchools([]);
                return;
            }

            const userIds = roleData.map(r => r.user_id);

            // 2. Get profiles for these users
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .in('user_id', userIds);

            if (profileError) throw profileError;

            // Map back
            setSchools(profileData || []);

        } catch (error: any) {
            console.error('Error fetching schools:', error);
            toast.error('Failed to load schools');
        } finally {
            setLoading(false);
        }
    };

    const [selectedSchool, setSelectedSchool] = useState<SchoolProfile | null>(null);
    const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);
    const [allTemplates, setAllTemplates] = useState<any[]>([]);
    const [schoolTemplateIds, setSchoolTemplateIds] = useState<string[]>([]);
    const [isSavingTemplates, setIsSavingTemplates] = useState(false);

    const generateInviteLink = async () => {
        try {
            setLoading(true);

            // 1. Create invite in DB
            const { data, error } = await (supabase
                .from('school_invites' as any)
                .insert([{ created_by: (await supabase.auth.getUser()).data.user?.id }])
                .select('token')
                .single()) as any;

            if (error) throw error;

            // 2. Format Link
            const link = `${window.location.origin}/auth?role=school&token=${data.token}`;
            setInviteLink(link);
            setCopied(false);
            toast.success("New secure invite link generated");
        } catch (error: any) {
            console.error("Error generating invite:", error);
            toast.error("Failed to generate invite link");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        toast.success('Invite link copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
    };

    const openManageTemplates = async (school: SchoolProfile) => {
        setSelectedSchool(school);
        setIsManageTemplatesOpen(true);
        setLoading(true);

        try {
            // 1. Fetch ALL active templates
            const { data: templatesData, error: templatesError } = await supabase
                .from('id_templates')
                .select('id, name, assigned_schools')
                .eq('status', 'active');

            if (templatesError) throw templatesError;
            setAllTemplates(templatesData || []);

            // 2. Determine which templates are assigned to THIS school
            // Logic: Template is assigned if school.user_id is in assigned_schools array
            const assigned = (templatesData || [])
                .filter((t: any) => t.assigned_schools && t.assigned_schools.includes(school.user_id))
                .map((t: any) => t.id);

            setSchoolTemplateIds(assigned);

        } catch (error: any) {
            console.error("Error loading templates:", error);
            toast.error("Failed to load templates");
        } finally {
            setLoading(false);
        }
    };

    const toggleTemplateAssignment = (templateId: string) => {
        setSchoolTemplateIds(prev =>
            prev.includes(templateId)
                ? prev.filter(id => id !== templateId)
                : [...prev, templateId]
        );
    };

    const saveSchoolTemplates = async () => {
        if (!selectedSchool) return;
        setIsSavingTemplates(true);

        try {
            // We need to update EACH template. 
            // This is inefficient if we update ALL templates, so we should only update changed ones?
            // For simplicity in this Admin UI, we iterate through all templates and update their arrays.
            // Better approach: Calculate diffs.

            const updates = allTemplates.map(async (template) => {
                const isCurrentlyAssigned = template.assigned_schools?.includes(selectedSchool.user_id);
                const shouldBeAssigned = schoolTemplateIds.includes(template.id);

                if (isCurrentlyAssigned === shouldBeAssigned) return; // No change

                let newAssignments = template.assigned_schools || [];
                if (shouldBeAssigned) {
                    newAssignments = [...newAssignments, selectedSchool.user_id];
                } else {
                    newAssignments = newAssignments.filter((uid: string) => uid !== selectedSchool.user_id);
                }

                // Update DB
                const { error } = await supabase
                    .from('id_templates')
                    .update({ assigned_schools: newAssignments } as any)
                    .eq('id', template.id);

                if (error) throw error;
            });

            await Promise.all(updates);
            toast.success("Template assignments updated successfully");
            setIsManageTemplatesOpen(false);

        } catch (error: any) {
            console.error("Error saving assignments:", error);
            toast.error("Failed to save assignments");
        } finally {
            setIsSavingTemplates(false);
        }
    };

    const filteredSchools = schools.filter(school =>
        school.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        school.institution_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DashboardLayout>
            <PageHeader
                title="School Management"
                description="Manage connected schools and generate access links."
            >
                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="gap-2 gradient-primary" onClick={generateInviteLink}>
                            <Plus className="h-4 w-4" />
                            Generate Invite Link
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>School Access Link</DialogTitle>
                            <DialogDescription>
                                Share this link with school administrators. They can use it to create a school account.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex items-center gap-2 mt-4">
                            <Input value={inviteLink} readOnly />
                            <Button size="icon" variant="outline" onClick={copyToClipboard}>
                                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Manage Templates Dialog */}
                <Dialog open={isManageTemplatesOpen} onOpenChange={setIsManageTemplatesOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Assign Templates</DialogTitle>
                            <DialogDescription>
                                Select which design templates {selectedSchool?.full_name} can access.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto">
                            {allTemplates.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No active templates found.</p>
                            ) : (
                                allTemplates.map(template => (
                                    <div key={template.id} className="flex items-center space-x-2 p-2 border rounded hover:bg-muted/50">
                                        <input
                                            type="checkbox"
                                            id={`tpl-${template.id}`}
                                            checked={schoolTemplateIds.includes(template.id)}
                                            onChange={() => toggleTemplateAssignment(template.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <label htmlFor={`tpl-${template.id}`} className="flex-1 cursor-pointer text-sm font-medium">
                                            {template.name}
                                        </label>
                                        {template.assigned_schools?.length === 0 && (
                                            <Badge variant="outline" className="text-[10px]">Public</Badge>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsManageTemplatesOpen(false)}>Cancel</Button>
                            <Button onClick={saveSchoolTemplates} disabled={isSavingTemplates}>
                                {isSavingTemplates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Save Changes
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </PageHeader>

            <Card>
                <CardContent className="p-0">
                    <div className="p-4 border-b border-border flex gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search schools..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="rounded-md border-t border-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>School Name / Admin</TableHead>
                                    <TableHead>Institution</TableHead>
                                    <TableHead>Joined Date</TableHead>
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && !isManageTemplatesOpen ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredSchools.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            No schools found. Generate a link to invite one.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSchools.map((school) => (
                                        <TableRow key={school.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <School className="h-4 w-4 text-primary" />
                                                    </div>
                                                    {school.full_name}
                                                </div>
                                            </TableCell>
                                            <TableCell>{school.institution_name || '-'}</TableCell>
                                            <TableCell>{new Date(school.created_at).toLocaleDateString()}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => openManageTemplates(school)}>
                                                            Manage Designs
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => toast.info("View details coming soon")}>
                                                            View Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-destructive">
                                                            Remove Access
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
