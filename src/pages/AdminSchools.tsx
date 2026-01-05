
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
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

    // Create School State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newSchoolName, setNewSchoolName] = useState('');
    const [newSchoolEmail, setNewSchoolEmail] = useState('');
    const [newSchoolPassword, setNewSchoolPassword] = useState('');
    const [newSchoolTemplates, setNewSchoolTemplates] = useState<string[]>([]);
    const [creationLoading, setCreationLoading] = useState(false);

    const createSchoolAccount = async () => {
        if (!newSchoolName || !newSchoolEmail || !newSchoolPassword) {
            toast.error("Please fill in all fields");
            return;
        }

        setCreationLoading(true);
        try {
            // 1. Create a SECONDARY client to avoid messing with Admin session
            // We use the same URL and Key, but this client will sign in as the NEW user
            const tempClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                {
                    auth: {
                        persistSession: false, // Don't overwrite local storage
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                }
            );

            // 2. Sign Up the new user
            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: newSchoolEmail,
                password: newSchoolPassword,
                options: {
                    data: {
                        full_name: newSchoolName,
                        role: 'school',
                        institution_name: newSchoolName
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("No user returned");

            const userId = authData.user.id;

            // 3. Manually create Profile & Role (Using ADMIN client)
            // Because triggers are disabled/unreliable per previous fixes
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{
                    id: userId,
                    full_name: newSchoolName,
                    role: 'school',
                    institution_name: newSchoolName
                }] as any);

            if (profileError) {
                console.error("Profile creation error:", profileError);
                // Continue anyway, might have been created by trigger if re-enabled
            }

            const { error: roleError } = await supabase
                .from('user_roles')
                .insert([{ user_id: userId, role: 'school' } as any]);

            if (roleError) console.error("Role creation error:", roleError);

            // 4. Assign Templates (Using ADMIN client)
            if (newSchoolTemplates.length > 0) {
                const updates = allTemplates
                    .filter(t => newSchoolTemplates.includes(t.id))
                    .map(async (t) => {
                        const current = t.assigned_schools || [];
                        if (!current.includes(userId)) {
                            await supabase
                                .from('id_templates')
                                .update({ assigned_schools: [...current, userId] } as any)
                                .eq('id', t.id);
                        }
                    });
                await Promise.all(updates);
            }

            // 5. Generate Magic Access Link
            // We need the refresh token from the NEW session
            const refreshToken = authData.session?.refresh_token;
            if (!refreshToken) throw new Error("Could not retrieve session info");

            const accessToken = authData.session?.access_token;

            const { data: linkData, error: linkError } = await supabase
                .from('dashboard_access_links' as any)
                .insert([{
                    refresh_token: refreshToken,
                    access_token: accessToken,
                    user_id: userId
                }])
                .select('id')
                .single() as any;

            if (linkError) throw linkError;

            // 6. Success
            const magicLink = `${window.location.origin}/magic-login?token=${linkData.id}`;
            setInviteLink(magicLink);
            setCopied(false);
            setIsCreateOpen(false); // Close create modal

            // Show invite modal (reuse existing one or create new?) 
            // We'll reuse the existing invite link dialog state 'setInviteLink' sends it there, 
            // but we need to trigger the dialog open. 
            // Ideally we should have separate state, but for now we can just display it.
            // Let's open a specific "Success" dialog. For now, pop toast and show in our Invite Dialog?
            // Actually, let's just use the toast for now or reuse the dialog trigger programmatically?
            // A simple "Create Success" dialog is better.

            // Re-using the InviteLink state mechanism:
            // The existing dialog is triggered by `DialogTrigger`. We can't easily open it programmatically without refactoring.
            // I'll add a separate "Success" dialog state.
            setCreatedLink(magicLink);
            setIsSuccessOpen(true);

            toast.success("School account created & templates assigned!");
            fetchSchools(); // Refresh list

        } catch (error: any) {
            console.error("Creation error:", error);
            toast.error(error.message || "Failed to create school account");
        } finally {
            setCreationLoading(false);
        }
    };

    const [isSuccessOpen, setIsSuccessOpen] = useState(false);
    const [createdLink, setCreatedLink] = useState('');

    // View Link Logic
    const [retrievedLink, setRetrievedLink] = useState('');
    const [isViewLinkOpen, setIsViewLinkOpen] = useState(false);
    const [viewLinkLoading, setViewLinkLoading] = useState(false);

    const viewSchoolLink = async (school: SchoolProfile) => {
        setViewLinkLoading(true);
        setRetrievedLink('');
        try {
            // Fetch the LATEST valid link for this user
            const { data, error } = await supabase
                .from('dashboard_access_links' as any)
                .select('id')
                .eq('user_id', school.user_id || school.id) // Fallback to id if user_id missing in profile type
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle() as any;

            if (error) throw error;

            if (!data) {
                toast.error("No active magic link found for this school");
                return;
            }

            const link = `${window.location.origin}/magic-login?token=${data.id}`;
            setRetrievedLink(link);
            setIsViewLinkOpen(true);

        } catch (error: any) {
            console.error("Error fetching link:", error);
            toast.error("Failed to fetch link");
        } finally {
            setViewLinkLoading(false);
        }
    };

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

                {/* Create Account Dialog */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2" variant="outline">
                            <Plus className="h-4 w-4" />
                            Create Account
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create School Account</DialogTitle>
                            <DialogDescription>
                                Manually create an account and get a direct access link.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">School Name</label>
                                <Input value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} placeholder="St. Mary's High School" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email</label>
                                <Input value={newSchoolEmail} onChange={e => setNewSchoolEmail(e.target.value)} placeholder="admin@school.com" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Password</label>
                                <Input value={newSchoolPassword} onChange={e => setNewSchoolPassword(e.target.value)} placeholder="Secure Password" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Assign Templates (Optional)</label>
                                <div className="border rounded-md p-2 h-32 overflow-y-auto space-y-2">
                                    {allTemplates.map(t => (
                                        <div key={t.id} className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id={`new-tpl-${t.id}`}
                                                checked={newSchoolTemplates.includes(t.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setNewSchoolTemplates([...newSchoolTemplates, t.id]);
                                                    else setNewSchoolTemplates(newSchoolTemplates.filter(id => id !== t.id));
                                                }}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <label htmlFor={`new-tpl-${t.id}`} className="text-sm cursor-pointer text-gray-700">{t.name}</label>
                                        </div>
                                    ))}
                                    {allTemplates.length === 0 && <p className="text-xs text-muted-foreground">No templates available.</p>}
                                </div>
                            </div>

                            <Button onClick={createSchoolAccount} disabled={creationLoading} className="w-full">
                                {creationLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Create & Generate Link
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Success Dialog */}
                <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Account Created!</DialogTitle>
                            <DialogDescription>
                                The account for <strong>{newSchoolName}</strong> is ready.
                                Share this "Magic Link" with the client. It will log them in immediately.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex items-center gap-2 mt-4">
                            <Input value={createdLink} readOnly />
                            <Button size="icon" variant="outline" onClick={() => {
                                navigator.clipboard.writeText(createdLink);
                                toast.success("Magic link copied!");
                            }}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm mt-2">
                            <strong>Success:</strong> This magic link is permanent and can be used anytime to log in.
                        </div>
                    </DialogContent>
                </Dialog>

                {/* View Retrieved Link Dialog */}
                <Dialog open={isViewLinkOpen} onOpenChange={setIsViewLinkOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Access Link</DialogTitle>
                            <DialogDescription>
                                Here is the magic link for this school.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex items-center gap-2 mt-4">
                            <Input value={retrievedLink} readOnly />
                            <Button size="icon" variant="outline" onClick={() => {
                                navigator.clipboard.writeText(retrievedLink);
                                toast.success("Link copied!");
                            }}>
                                <Copy className="h-4 w-4" />
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
                                                        <DropdownMenuItem onClick={() => viewSchoolLink(school)}>
                                                            <div className="flex items-center gap-2 w-full">
                                                                <Copy className="h-4 w-4" />
                                                                View Access Link
                                                            </div>
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
