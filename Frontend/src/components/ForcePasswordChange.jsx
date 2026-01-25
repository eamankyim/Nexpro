import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Lock,
  User,
  Camera,
  Eye,
  EyeOff,
  Loader2,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import { showSuccess, showError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';

const passwordSchema = z.object({
  newPassword: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z.string().min(1, 'Please confirm new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const ForcePasswordChange = ({ visible, onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setProfilePicture(data.url || data.data?.url);
        toast({
          title: 'Success',
          description: 'Profile picture uploaded successfully',
        });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      showError(error, 'Failed to upload profile picture');
    }
  };

  const onSubmit = async (values) => {
    try {
      setLoading(true);
      
      const updateData = {
        password: values.newPassword,
        profilePicture: profilePicture,
        isFirstLogin: false
      };

      await userService.update(user.id, updateData);
      
      // Update user context
      updateUser({
        ...user,
        isFirstLogin: false,
        profilePicture: profilePicture
      });

      showSuccess('Profile updated successfully! Welcome to NexPro!');
      onComplete();
    } catch (error) {
      showError(error, 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={visible} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Complete Your Profile
          </DialogTitle>
          <DialogDescription>
            Please complete your profile setup by changing your password and adding a profile picture.
          </DialogDescription>
        </DialogHeader>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Welcome to NexPro!</AlertTitle>
          <AlertDescription>
            Please complete your profile setup by changing your password and adding a profile picture.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Profile Picture Section */}
            <div className="text-center">
              <Label className="text-base font-semibold mb-4 block">Profile Picture</Label>
              <div className="flex flex-col items-center gap-4">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={profilePicture} alt={user?.name} />
                  <AvatarFallback>
                    <User className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-center gap-2">
                  <label htmlFor="profile-picture-upload">
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer"
                      asChild
                    >
                      <span>
                        <Camera className="h-4 w-4 mr-2" />
                        Upload Profile Picture
                      </span>
                    </Button>
                  </label>
                  <input
                    id="profile-picture-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <p className="text-sm text-muted-foreground">
                    Click to upload a profile picture (optional)
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Password Change Section */}
            <div>
              <Label className="text-base font-semibold mb-2 block">Change Your Password</Label>
              <p className="text-sm text-muted-foreground mb-4">
                You must change your default password for security reasons.
              </p>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter new password"
                            className="pl-10 pr-10"
                          />
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Confirm new password"
                            className="pl-10 pr-10"
                          />
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Completing Setup...
                </>
              ) : (
                'Complete Setup & Continue'
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ForcePasswordChange;
