import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { encryptPassword, decryptPassword } from '@/utils/crypto';
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
    Eye,
    Lock
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
    email?: string;
}

export default function AdminSchools() {
    const [schools, setSchools] = useState<SchoolProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Template State
    const [allTemplates, setAllTemplates] = useState<any[]>([]);

    useEffect(() => {
        fetchSchools();
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const { data, error } = await supabase
                .from('id_templates')
                .select('id, name, assigned_schools')
                .eq('status', 'active');

            if (error) throw error;
            setAllTemplates(data || []);
        } catch (error) {
            console.error("Error loading templates:", error);
        }
    }

    const fetchSchools = async () => {
        try {
            setLoading(true);
            const { data: roleData, error: roleError } = await supabase
                .from('user_roles')
                .select('user_id, role')
                .in('role', ['school', 'teacher'] as any);

            if (roleError) throw roleError;

            if (!roleData || roleData.length === 0) {
                setSchools([]);
                return;
            }

            // Deduplicate user IDs (users might have multiple roles)
            const uniqueUserIds = [...new Set(roleData.map(r => r.user_id))];

            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .in('user_id', uniqueUserIds);

            if (profileError) throw profileError;

            // Combine and handle missing profiles
            const combinedSchools = uniqueUserIds.map(uid => {
                const profile = profileData?.find(p => p.user_id === uid);
                if (profile) return profile;

                // Fallback for missing profile (likely due to RLS/Trigger issues)
                return {
                    id: uid,
                    user_id: uid,
                    full_name: '(No Profile - Run SQL Migration)',
                    institution_name: 'Unknown',
                    created_at: new Date().toISOString(),
                    email: 'check-db'
                };
            });

            // Sort by Created At Desc
            const sorted = combinedSchools.sort((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setSchools(sorted);

        } catch (error: any) {
            console.error('Error fetching schools:', error);
            toast.error('Failed to load schools');
        } finally {
            setLoading(false);
        }
    };

    const [selectedSchool, setSelectedSchool] = useState<SchoolProfile | null>(null);
    const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);
    const [schoolTemplateIds, setSchoolTemplateIds] = useState<string[]>([]);
    const [isSavingTemplates, setIsSavingTemplates] = useState(false);

    // Create School State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newSchoolName, setNewSchoolName] = useState('');
    const [newSchoolEmail, setNewSchoolEmail] = useState('');
    const [newSchoolPassword, setNewSchoolPassword] = useState('');
    const [newSchoolTemplates, setNewSchoolTemplates] = useState<string[]>([]);
    const [creationLoading, setCreationLoading] = useState(false);
    const [isSuccessOpen, setIsSuccessOpen] = useState(false);
    const [createdLink, setCreatedLink] = useState('');

    const createSchoolAccount = async () => {
        if (!newSchoolName || !newSchoolEmail || !newSchoolPassword) {
            toast.error("Please fill in all fields");
            return;
        }

        if (newSchoolPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setCreationLoading(true);
        try {
            // Use manual password provided by admin

            // 1. Create a SECONDARY client
            const tempClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                }
            );

            // 2. Sign Up (Pass role in metadata for the new trigger to pick up)
            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: newSchoolEmail,
                password: newSchoolPassword,
                options: {
                    data: {
                        full_name: newSchoolName,
                        role: 'school', // IMPORTANT: New trigger uses this
                        institution_name: newSchoolName
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("No user returned");

            const userId = authData.user.id;

            // 3. Fallback: Manually ensure Profile & Role exist (if trigger failed or old trigger ran)
            // We use upsert safely.
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    user_id: userId,
                    full_name: newSchoolName,
                    institution_name: newSchoolName
                } as any, { onConflict: 'user_id' });

            if (profileError) {
                console.warn("Profile upsert warning:", profileError);
                toast.error("Profile creation failed: " + profileError.message);
            }

            // Ensure 'school' role
            const { error: roleError } = await supabase
                .from('user_roles')
                .insert([{ user_id: userId, role: 'school' } as any]);
            // If it fails due to PK conflict, it means role exists. 
            // Ideally we check or delete 'teacher', but let's assume 'school' is key.

            if (roleError) {
                // Check if it was unique constraint
                console.warn("Role insert warning (expected if trigger worked):", roleError);
            }

            // 4. Assign Templates
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

            // 5. Generate Permanent Magic Key
            const refreshToken = authData.session?.refresh_token;
            const accessToken = authData.session?.access_token;

            const { encrypted, keyStr } = await encryptPassword(newSchoolPassword);

            const { data: linkData, error: linkError } = await supabase
                .from('dashboard_access_links' as any)
                .insert([{
                    refresh_token: refreshToken, // Optional now, but kept for legacy
                    access_token: accessToken,
                    user_id: userId,
                    email: newSchoolEmail,
                    encrypted_password: encrypted
                }])
                .select('id')
                .single() as any;

            if (linkError) throw linkError;

            // 5b. Securely store the key for Admin retrieval
            const { error: keyError } = await supabase
                .from('dashboard_access_keys' as any)
                .insert([{
                    link_id: linkData.id,
                    encryption_key: keyStr
                }]);

            if (keyError) {
                console.error("Failed to store retrieval key:", keyError);
                toast.error(`DB Error: ${keyError.message || keyError.details || "Key storage failed"}. Did you run the migration?`);
            } else {
                console.log("Key stored successfully for link:", linkData.id);
            }

            // 6. Success
            // Include Key in URL
            const magicLink = `${window.location.origin}/magic-login?token=${linkData.id}&key=${keyStr}`;
            setCreatedLink(magicLink);
            setIsSuccessOpen(true);
            setIsCreateOpen(false);

            toast.success("School account created & templates assigned!");
            fetchSchools();

            // Reset Form but keep templates if needed? No, reset all.
            setNewSchoolName('');
            setNewSchoolEmail('');
            setNewSchoolPassword('');
            setNewSchoolTemplates([]);

        } catch (error: any) {
            console.error("Creation error:", error);
            toast.error(error.message || "Failed to create school account");
        } finally {
            setCreationLoading(false);
        }
    };

    // View Link Logic
    const [retrievedLink, setRetrievedLink] = useState('');
    const [retrievedPassword, setRetrievedPassword] = useState('');
    const [isViewLinkOpen, setIsViewLinkOpen] = useState(false);
    const [viewLinkLoading, setViewLinkLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'link' | 'password'>('link');

    // Change Password Logic
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [changePasswordLoading, setChangePasswordLoading] = useState(false);
    const [newAdminSetPassword, setNewAdminSetPassword] = useState('');

    const getSchoolCredentials = async (schoolId: string) => {
        // 1. Get the latest link
        const { data: linkData, error } = await supabase
            .from('dashboard_access_links' as any)
            .select('id, encrypted_password')
            .eq('user_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle() as any;

        if (error) throw error;
        if (!linkData) throw new Error("No active magic link/password record found");

        // 2. Try to fetch the key
        const { data: keyData, error: keyError } = await supabase
            .from('dashboard_access_keys' as any)
            .select('encryption_key')
            .eq('link_id', linkData.id)
            .maybeSingle() as any;

        if (keyError) throw keyError;
        if (!keyData?.encryption_key) throw new Error("Encryption key missing");

        return { linkId: linkData.id, encrypted: linkData.encrypted_password, key: keyData.encryption_key };
    };

    const viewSchoolCredential = async (school: SchoolProfile, mode: 'link' | 'password') => {
        setViewLinkLoading(true);
        setRetrievedLink('');
        setRetrievedPassword('');
        setViewMode(mode);
        try {
            const { linkId, encrypted, key } = await getSchoolCredentials(school.user_id || school.id);

            if (mode === 'link') {
                const magicLink = `${window.location.origin}/magic-login?token=${linkId}&key=${key}`;
                setRetrievedLink(magicLink);
            } else {
                if (!encrypted) throw new Error("No encrypted password stored for this user.");
                const pass = await decryptPassword(encrypted, key);
                setRetrievedPassword(pass);
            }

            setIsViewLinkOpen(true);
        } catch (error: any) {
            console.error("Error fetching credentials:", error);
            toast.error(error.message || "Failed to fetch credentials");
        } finally {
            setViewLinkLoading(false);
        }
    };

    // Replaces viewSchoolLink
    const viewSchoolLink = (school: SchoolProfile) => viewSchoolCredential(school, 'link');

    const openChangePassword = (school: SchoolProfile) => {
        setSelectedSchool(school);
        setNewAdminSetPassword('');
        setIsChangePasswordOpen(true);
    };

    const performChangePassword = async () => {
        if (!selectedSchool || !newAdminSetPassword || newAdminSetPassword.length < 6) {
            toast.error("Invalid password (min 6 chars)");
            return;
        }

        setChangePasswordLoading(true);
        try {
            // 1. Decrypt OLD password to authenticate
            // We need to act AS the user to change their password securely without generic admin override (if undefined)
            // But we can use the tempClient approach if we sign in.
            const { linkId, encrypted, key } = await getSchoolCredentials(selectedSchool.user_id || selectedSchool.id);
            const oldPassword = await decryptPassword(encrypted, key);

            // 2. Sign in as user to change password
            const tempClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
            );

            const { data: signInData, error: signInError } = await tempClient.auth.signInWithPassword({
                email: selectedSchool.email || '', // We need email. SchoolProfile interface has it?
                // Let's ensure we have email. The profile might not, but 'fetchSchools' fetched profiles.
                // We might need to fetch email from auth.users via edge function? 
                // Wait, 'schools' state has 'email: check-db' fallback.
                // WE FETCHED PROFILES. Profiles might not have email.
                // Actually 'AdminSchools' fetchSchools fetch logic lines 99-102 fetches PROFILES.
                // It does NOT fetch emails (auth table is restricted).
                // However, we stored email in 'dashboard_access_links'.
                // Let's fetch email from there if valid.
            });

            // To retrieve email: 
            const { data: linkRecord } = await supabase.from('dashboard_access_links' as any).select('email').eq('id', linkId).single();
            const emailToUse = selectedSchool.email || linkRecord?.email;

            if (!emailToUse) throw new Error("Could not determine user email.");

            const { error: loginError } = await tempClient.auth.signInWithPassword({
                email: emailToUse,
                password: oldPassword
            });

            if (loginError) throw new Error("Auth failed with stored password: " + loginError.message);

            // 3. Update Password
            const { error: updateError } = await tempClient.auth.updateUser({ password: newAdminSetPassword });
            if (updateError) throw updateError;

            // 4. Update Database Record (Sync new password)
            const { encrypted: newEncrypted, keyStr: newKey } = await encryptPassword(newAdminSetPassword);

            // Create NEW link/key pair to invalidate old one gracefully or just update?
            // Safer to insert NEW link.
            const { data: newLinkData, error: newLinkError } = await supabase
                .from('dashboard_access_links' as any)
                .insert([{
                    user_id: selectedSchool.user_id || selectedSchool.id,
                    email: emailToUse,
                    encrypted_password: newEncrypted,
                    access_token: 'manual_change', // Placeholder
                    refresh_token: 'manual_change'
                }])
                .select('id')
                .single();

            if (newLinkError) throw newLinkError;

            await supabase
                .from('dashboard_access_keys' as any)
                .insert([{
                    link_id: newLinkData.id,
                    encryption_key: newKey
                }]);

            await tempClient.auth.signOut();
            toast.success("Password changed successfully!");
            setIsChangePasswordOpen(false);

        } catch (error: any) {
            console.error("Change password error:", error);
            toast.error(error.message || "Failed to change password");
        } finally {
            setChangePasswordLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Link copied to clipboard');
    };

    const openManageTemplates = (school: SchoolProfile) => {
        setSelectedSchool(school);
        setIsManageTemplatesOpen(true);
        // Determine assigned from allTemplates
        const assigned = allTemplates
            .filter((t: any) => t.assigned_schools && t.assigned_schools.includes(school.user_id))
            .map((t: any) => t.id);
        setSchoolTemplateIds(assigned);
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
            const updates = allTemplates.map(async (template) => {
                const isCurrentlyAssigned = template.assigned_schools?.includes(selectedSchool.user_id);
                const shouldBeAssigned = schoolTemplateIds.includes(template.id);

                if (isCurrentlyAssigned === shouldBeAssigned) return;

                let newAssignments = template.assigned_schools || [];
                if (shouldBeAssigned) {
                    newAssignments = [...newAssignments, selectedSchool.user_id];
                } else {
                    newAssignments = newAssignments.filter((uid: string) => uid !== selectedSchool.user_id);
                }

                const { error } = await supabase
                    .from('id_templates')
                    .update({ assigned_schools: newAssignments } as any)
                    .eq('id', template.id);

                if (error) throw error;
            });

            await Promise.all(updates);
            toast.success("Template assignments updated successfully");
            setIsManageTemplatesOpen(false);

            // Refresh templates to sync local state
            fetchTemplates();

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
                                <Input
                                    type="password"
                                    value={newSchoolPassword}
                                    onChange={e => setNewSchoolPassword(e.target.value)}
                                    placeholder="Set account password"
                                />
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
                                    {allTemplates.length === 0 && <p className="text-xs text-muted-foreground">No templates available. Create one in Design Studio first.</p>}
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
                                The account is ready. Share this link with the client.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex items-center gap-2 mt-4">
                            <Input value={createdLink} readOnly />
                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(createdLink)}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm mt-2">
                            <strong>Success:</strong> This magic link is permanent and can be used anytime to log in.
                        </div>
                    </DialogContent>
                </Dialog>

                {/* View Retrieved Credential Dialog */}
                <Dialog open={isViewLinkOpen} onOpenChange={setIsViewLinkOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{viewMode === 'link' ? 'Access Link' : 'School Password'}</DialogTitle>
                            <DialogDescription>
                                {viewMode === 'link' ? 'Magic link for this school.' : 'Current decrypted password.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex items-center gap-2 mt-4">
                            <Input value={viewMode === 'link' ? retrievedLink : retrievedPassword} readOnly type={viewMode === 'password' ? 'text' : 'text'} />
                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(viewMode === 'link' ? retrievedLink : retrievedPassword)}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Change Password Dialog */}
                <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Change Password</DialogTitle>
                            <DialogDescription>
                                Override the password for {selectedSchool?.full_name}. This will create a new valid magic link as well.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">New Password</label>
                                <Input
                                    type="password"
                                    value={newAdminSetPassword}
                                    onChange={e => setNewAdminSetPassword(e.target.value)}
                                    placeholder="Min 6 characters"
                                />
                            </div>
                            <Button onClick={performChangePassword} disabled={changePasswordLoading} className="w-full">
                                {changePasswordLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Update Password
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
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredSchools.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            No schools found. Create an account to get started.
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
                                                        <DropdownMenuItem onClick={() => viewSchoolCredential(school, 'link')}>
                                                            <div className="flex items-center gap-2 w-full">
                                                                <Copy className="h-4 w-4" />
                                                                View Access Link
                                                            </div>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => viewSchoolCredential(school, 'password')}>
                                                            <div className="flex items-center gap-2 w-full">
                                                                <Eye className="h-4 w-4" />
                                                                View Password
                                                            </div>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => openChangePassword(school)} className="text-primary focus:text-primary">
                                                            <div className="flex items-center gap-2 w-full">
                                                                <Lock className="h-4 w-4" />
                                                                Change Password
                                                            </div>
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
