
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MagicLogin() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const handleMagicLogin = async () => {
            const token = searchParams.get('token');

            if (!token) {
                toast.error("Invalid magic link");
                navigate('/auth');
                return;
            }

            try {
                // 1. Fetch the actual refresh token securely
                const { data, error } = await supabase
                    .from('dashboard_access_links' as any)
                    .select('refresh_token, access_token')
                    .eq('id', token)
                    .single() as any;

                if (error || !data) {
                    console.error("Link fetch error:", error);
                    throw new Error("Link expired or invalid");
                }

                // 2. Hydrate the session
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                    refresh_token: data.refresh_token,
                    access_token: data.access_token || data.refresh_token
                });

                if (sessionError) throw sessionError;

                // 3. IMPORTANT: Update the link with the NEW refresh token (Token Rotation)
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

                        if (updateError) {
                            console.error("Token rotation failed (non-critical):", updateError);
                        }
                    } catch (updateErr) {
                        console.error("Token rotation exception:", updateErr);
                    }
                }

                // 3. Burn the link (Removed for Permanent Links)
                // await supabase.from('dashboard_access_links').delete().eq('id', token);

                toast.success("Welcome back! Auto-login successful.");
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
