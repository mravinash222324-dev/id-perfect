import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreditCard, Loader2, Eye, EyeOff, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  institutionName: z.string().optional(),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignInFormData = z.infer<typeof signInSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();

  // Check for role & token in URL
  const searchParams = new URLSearchParams(window.location.search);
  const inviteRole = searchParams.get('role');
  const inviteToken = searchParams.get('token');
  const isSchoolInvite = inviteRole === 'school';

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', institutionName: '', email: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (isSchoolInvite && !isSignUp) {
      setIsSignUp(true);
    }
  }, [isSchoolInvite]);

  const handleSignIn = async (data: SignInFormData) => {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    setIsLoading(false);

    if (error) {
      toast.error(error.message || 'Failed to sign in');
    } else {
      toast.success('Welcome back!');
      navigate('/dashboard');
    }
  };

  const handleSignUp = async (data: SignUpFormData) => {
    setIsLoading(true);
    const { error } = await signUp(
      data.email,
      data.password,
      data.fullName,
      inviteRole || undefined,
      data.institutionName,
      inviteToken || undefined
    );
    setIsLoading(false);

    if (error) {
      if (error.message?.includes('already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
      } else {
        toast.error(error.message || 'Failed to create account');
      }
    } else {
      toast.success('Account created successfully!');
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-primary/10 blur-[120px] animate-pulse-subtle" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-secondary/10 blur-[120px] animate-pulse-subtle" />
        <div className="absolute top-[30%] left-[40%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[100px] animate-float" />

        {/* Grid Overlay */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      </div>

      <div className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-12 p-6 z-10">

        {/* Branding Section */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex-1 text-center lg:text-left space-y-8"
        >
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm font-medium text-white/80">The Future of ID Management</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1]">
              RAZ <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-secondary animate-gradient-x">ID</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Create, manage, and print professional identity cards with an advanced glass-morphic design studio.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm text-white/40">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>Real-time Preview</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-secondary" />
              <span>Batch Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>Secure Cloud</span>
            </div>
          </div>
        </motion.div>

        {/* ID Card Styled Auth */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20, rotateX: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.6, delay: 0.2, type: "spring" }}
          className="w-full max-w-sm perspective-1000"
        >
          {/* Lanyard Clip Visual */}
          <div className="flex justify-center -mb-4 relative z-20">
            <div className="w-4 h-16 bg-gradient-to-b from-slate-700 to-slate-800 rounded-full shadow-lg border border-white/20" />
            <div className="absolute top-2 w-12 h-8 bg-zinc-900 rounded-lg flex items-center justify-center border border-white/20 shadow-xl">
              <div className="w-8 h-1 bg-white/20 rounded-full" />
            </div>
          </div>

          <div className="relative group perspective-1000">
            {/* Glow Effect */}
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-b from-primary/50 via-purple-500/30 to-blue-500/20 opacity-50 blur-xl group-hover:opacity-75 transition duration-500" />

            {/* Main Card Container */}
            <div className="relative bg-[#0a0a0f] border border-white/10 rounded-[1.5rem] overflow-hidden shadow-2xl flex flex-col items-center">

              {/* Glossy Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40 pointer-events-none z-0" />
              <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-0" />

              {/* ID Card Header */}
              <div className="w-full bg-primary/20 backdrop-blur-md border-b border-white/10 p-4 pt-8 text-center relative z-10">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-2 bg-black/50 rounded-full blur-[1px]" /> {/* Hole Shadow */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-3 bg-[#0a0a0f] rounded-full border border-white/20 shadow-inner" /> {/* Hole Punch */}

                <h2 className="text-xs font-bold tracking-[0.3em] text-primary-foreground/80 uppercase mt-4">
                  {isSchoolInvite ? 'New Registration' : (isSignUp ? 'Apply for ID' : 'Access Control')}
                </h2>
                <h1 className="text-xl font-bold text-white tracking-widest mt-1">
                  {isSchoolInvite ? 'SCHOOL PASS' : 'MEMBER PASS'}
                </h1>
              </div>

              {/* Photo Area */}
              <div className="relative z-10 mt-6 mb-4">
                <div className="w-28 h-28 rounded-xl bg-gradient-to-br from-gray-800 to-black border-2 border-white/10 shadow-inner flex items-center justify-center relative overflow-hidden group-hover:border-primary/50 transition-colors">
                  {isSignUp ? (
                    <Sparkles className="h-10 w-10 text-white/20" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-white/30" />
                      </div>
                      <div className="w-16 h-2 bg-white/10 rounded-full" />
                    </div>
                  )}

                  {/* Holographic Sticker */}
                  <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-cyan-500 opacity-60 animate-pulse" />
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-green-500/20 border border-green-500/50 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm uppercase tracking-wider">
                  {isSignUp ? 'Pending' : 'Verified'}
                </div>
              </div>

              {/* Card Content (Form) */}
              <div className="w-full p-6 relative z-10">
                {/* Tab Switcher (Subtle) */}
                {!isSchoolInvite && (
                  <div className="flex justify-center mb-6 gap-4 text-[10px] font-bold tracking-widest uppercase">
                    <button onClick={() => setIsSignUp(false)} className={cn("pb-1 border-b-2 transition-colors", !isSignUp ? "border-primary text-white" : "border-transparent text-white/30 hover:text-white/60")}>Login</button>
                    <button onClick={() => setIsSignUp(true)} className={cn("pb-1 border-b-2 transition-colors", isSignUp ? "border-primary text-white" : "border-transparent text-white/30 hover:text-white/60")}>Register</button>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {isSignUp ? (
                    <motion.form
                      key="signup"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={signUpForm.handleSubmit(handleSignUp)}
                      className="space-y-3"
                    >
                      <div className="space-y-0.5">
                        <Label className="text-[9px] text-white/40 uppercase tracking-wider pl-1">Name</Label>
                        <Input placeholder="FULL NAME" {...signUpForm.register('fullName')} className="bg-black/40 border-white/10 h-8 text-xs font-mono focus:border-primary/50 text-center uppercase placeholder:text-white/10" />
                      </div>

                      {isSchoolInvite && (
                        <div className="space-y-0.5">
                          <Label className="text-[9px] text-white/40 uppercase tracking-wider pl-1">Organization</Label>
                          <Input placeholder="INSTITUTION" {...signUpForm.register('institutionName')} className="bg-black/40 border-white/10 h-8 text-xs font-mono focus:border-primary/50 text-center uppercase placeholder:text-white/10" />
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <Label className="text-[9px] text-white/40 uppercase tracking-wider pl-1">Contact Email</Label>
                        <Input type="email" placeholder="EMAIL ADDRESS" {...signUpForm.register('email')} className="bg-black/40 border-white/10 h-8 text-xs font-mono focus:border-primary/50 text-center placeholder:text-white/10" />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-[9px] text-white/40 uppercase tracking-wider pl-1">Set PIN</Label>
                          <Input type="password" placeholder="******" {...signUpForm.register('password')} className="bg-black/40 border-white/10 h-8 text-xs font-mono focus:border-primary/50 text-center placeholder:text-white/10" />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[9px] text-white/40 uppercase tracking-wider pl-1">Confirm</Label>
                          <Input type="password" placeholder="******" {...signUpForm.register('confirmPassword')} className="bg-black/40 border-white/10 h-8 text-xs font-mono focus:border-primary/50 text-center placeholder:text-white/10" />
                        </div>
                      </div>

                      <Button type="submit" className="w-full h-9 bg-primary/80 hover:bg-primary text-white text-xs uppercase tracking-widest font-bold mt-4" disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Issue ID Card'}
                      </Button>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="signin"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={signInForm.handleSubmit(handleSignIn)}
                      className="space-y-4"
                    >
                      <div className="space-y-1">
                        <Label className="text-[9px] text-white/40 uppercase tracking-wider pl-1 font-mono">ID / Email</Label>
                        <div className="relative">
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary/50 rounded-full" />
                          <Input
                            type="email"
                            placeholder="USER@NO"
                            {...signInForm.register('email')}
                            className="bg-black/40 border-white/10 focus:border-primary/50 text-white h-9 pl-6 font-mono text-sm tracking-wide shadow-inner transition-all focus:bg-black/60"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[9px] text-white/40 uppercase tracking-wider pl-1 font-mono">Access Code</Label>
                        <div className="relative">
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-secondary/50 rounded-full" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="******"
                            {...signInForm.register('password')}
                            className="bg-black/40 border-white/10 focus:border-primary/50 text-white h-9 pl-6 pr-8 font-mono text-sm tracking-wide shadow-inner transition-all focus:bg-black/60"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>

                      <Button type="submit" className="w-full h-10 bg-white text-black hover:bg-white/90 text-xs uppercase tracking-[0.2em] font-bold mt-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] border border-white/20" disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'AUTHENTICATE'}
                      </Button>

                      <div className="text-center">
                        <a href="#" className="text-[9px] text-white/30 hover:text-primary uppercase tracking-wider transition-colors">Lost Access Card?</a>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>

              {/* Card Footer (Barcode) */}
              <div className="w-full bg-white/5 border-t border-white/10 p-3 flex flex-col items-center justify-center gap-2 relative z-10">
                <div className="flex gap-0.5 h-8 opacity-70">
                  {/* Fake Barcode */}
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="bg-white" style={{ width: Math.random() > 0.5 ? '2px' : '4px', opacity: Math.random() > 0.3 ? 0.8 : 0.4 }} />
                  ))}
                  <div className="bg-white w-2 mx-1" />
                  {[...Array(20)].map((_, i) => (
                    <div key={i + 20} className="bg-white" style={{ width: Math.random() > 0.5 ? '2px' : '4px', opacity: Math.random() > 0.3 ? 0.8 : 0.4 }} />
                  ))}
                </div>
                <div className="text-[8px] font-mono text-white/20 tracking-[0.5em]">{new Date().getFullYear()} • SECURE • IDP</div>
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
