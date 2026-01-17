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

        {/* Auth Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="relative group">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary via-accent to-secondary opacity-30 blur-xl group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />

            <div className="relative glass-card p-8 rounded-2xl overflow-hidden">
              {/* Shine Effect */}
              <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-br from-transparent via-white/5 to-transparent rotate-45 animate-shimmer pointer-events-none" />

              <div className="mb-8 text-center space-y-2 relative z-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20 mx-auto mb-4">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {isSchoolInvite ? 'Create Account' : (isSignUp ? 'Get Started' : 'Welcome Back')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isSchoolInvite
                    ? 'Register your institution to continue'
                    : (isSignUp
                      ? 'Create your account to start designing'
                      : 'Sign in to your dashboard')}
                </p>
              </div>

              {/* Tab Switcher */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-black/40 rounded-xl mb-6 border border-white/5 relative z-10">
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className={cn(
                    'py-2 text-sm font-medium rounded-lg transition-all duration-300',
                    !isSignUp
                      ? 'bg-white/10 text-white shadow-lg'
                      : 'text-muted-foreground hover:text-white hover:bg-white/5'
                  )}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className={cn(
                    'py-2 text-sm font-medium rounded-lg transition-all duration-300',
                    isSignUp
                      ? 'bg-white/10 text-white shadow-lg'
                      : 'text-muted-foreground hover:text-white hover:bg-white/5'
                  )}
                >
                  Sign Up
                </button>
              </div>

              <AnimatePresence mode="wait">
                {isSignUp ? (
                  <motion.form
                    key="signup"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={signUpForm.handleSubmit(handleSignUp)}
                    className="space-y-4 relative z-10"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {isSchoolInvite ? 'Admin Name' : 'Full Name'}
                      </Label>
                      <Input
                        placeholder="John Doe"
                        {...signUpForm.register('fullName')}
                        className="bg-black/20 border-white/10 focus:border-primary/50 text-white h-11"
                      />
                      {signUpForm.formState.errors.fullName && (
                        <p className="text-xs text-destructive">{signUpForm.formState.errors.fullName.message}</p>
                      )}
                    </div>

                    {isSchoolInvite && (
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Institution Name</Label>
                        <Input
                          placeholder="Springfield High"
                          {...signUpForm.register('institutionName')}
                          className="bg-black/20 border-white/10 focus:border-primary/50 text-white h-11"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</Label>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        {...signUpForm.register('email')}
                        className="bg-black/20 border-white/10 focus:border-primary/50 text-white h-11"
                      />
                      {signUpForm.formState.errors.email && (
                        <p className="text-xs text-destructive">{signUpForm.formState.errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...signUpForm.register('password')}
                          className="bg-black/20 border-white/10 focus:border-primary/50 text-white h-11 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {signUpForm.formState.errors.password && (
                        <p className="text-xs text-destructive">{signUpForm.formState.errors.password.message}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirm Password</Label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...signUpForm.register('confirmPassword')}
                        className="bg-black/20 border-white/10 focus:border-primary/50 text-white h-11"
                      />
                      {signUpForm.formState.errors.confirmPassword && (
                        <p className="text-xs text-destructive">{signUpForm.formState.errors.confirmPassword.message}</p>
                      )}
                    </div>

                    <Button type="submit" className="w-full h-12 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all font-semibold rounded-xl mt-2" disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Account'}
                    </Button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="signin"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onSubmit={signInForm.handleSubmit(handleSignIn)}
                    className="space-y-4 relative z-10"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</Label>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        {...signInForm.register('email')}
                        className="bg-black/20 border-white/10 focus:border-primary/50 text-white h-11 transition-all hover:bg-black/30"
                      />
                      {signInForm.formState.errors.email && (
                        <p className="text-xs text-destructive">{signInForm.formState.errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...signInForm.register('password')}
                          className="bg-black/20 border-white/10 focus:border-primary/50 text-white h-11 pr-10 transition-all hover:bg-black/30"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {signInForm.formState.errors.password && (
                        <p className="text-xs text-destructive">{signInForm.formState.errors.password.message}</p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <a href="#" className="text-xs text-primary hover:text-primary/80 transition-colors">Forgot password?</a>
                    </div>

                    <Button type="submit" className="w-full h-12 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all font-semibold rounded-xl mt-2 group" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <span className="flex items-center gap-2">Sign In <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></span>
                      )}
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>

              <div className="mt-8 pt-6 border-t border-white/5 text-center relative z-10">
                <p className="text-xs text-muted-foreground">
                  By continuing, you agree to our <a href="#" className="underline hover:text-white">Terms of Service</a> and <a href="#" className="underline hover:text-white">Privacy Policy</a>.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
