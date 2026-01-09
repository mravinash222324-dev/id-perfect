
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { decryptPassword } from '@/utils/crypto';

export default function MagicLogin() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const handleMagicLogin = async () => {
            const token = searchParams.get('token');
            const key = searchParams.get('key');

            if (!token) {
                toast.error("Invalid magic link");
                navigate('/auth');
                return;
            }

            try {
                // 1. Fetch Link Data
                const { data, error } = await supabase
                    .from('dashboard_access_links' as any)
                    .select('refresh_token, access_token, email, encrypted_password')
                    .eq('id', token)
                    .single() as any;

                if (error || !data) {
                    console.error("Link fetch error:", error);
                    throw new Error("Link expired or invalid");
                }

                // 2. Permanent Link Logic (if key exists)
                if (key && data.email && data.encrypted_password) {
                    try {
                        const password = await decryptPassword(data.encrypted_password, key);
                        const { error: signInError } = await supabase.auth.signInWithPassword({
                            email: data.email,
                            password: password
                        });

                        if (signInError) throw signInError;

                        // Success!
                        toast.success("Welcome back! Permanent login successful.");
                        navigate('/upload');
                        return; // Done
                    } catch (secError) {
                        console.error("Permanent login failed:", secError);
                        toast.error("Security check failed for this link. Trying fallback...");
                        // Fall through to legacy method
                    }
                }

                // 3. Legacy/Fallback Logic (Refresh Token)
                if (!data.refresh_token) {
                    throw new Error("This link requires a newer version or is invalid.");
                }

                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                    refresh_token: data.refresh_token,
                    access_token: data.access_token || data.refresh_token
                });

                if (sessionError) throw sessionError;

                // 4. Token Rotation (for legacy links)
                if (sessionData.session) {
                    try {
                        const { error: updateError } = await supabase
                            .from('dashboard_access_links' as any)
                            .update({
                                refresh_token: sessionData.session.refresh_token,
                                access_token: sessionData.session.access_token,
                                last_used_at: new Date()
                            })
                            .eq('id', token);

                        if (updateError) console.error("Token rotation failed:", updateError);
                    } catch (e) { }
                }

                toast.success("Welcome back! Login successful.");
                navigate('/upload');

            } catch (error: any) {
                console.error("Magic login error:", error);
                toast.error(error.message || "Failed to login with magic link");
                navigate('/auth');
            } finally {
                setLoading(false);
            }
        };

        handleMagicLogin();
    }, [searchParams, navigate]);

    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50">
            <div className="text-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <h2 className="text-xl font-semibold text-gray-900">Logging you in...</h2>
                <p className="text-sm text-gray-500">Please wait while we verify your access link.</p>
            </div>
        </div>
    );
}
