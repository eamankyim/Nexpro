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
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import authService from '../services/authService';
import { showSuccess, showError } from '../utils/toast';
import { resolveImageUrl } from '../utils/fileUtils';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogBody,
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
const passwordSchema = z.object({
  newPassword: z
    .string()
    .min(6, 'Use at least 6 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Use uppercase, lowercase, and a number'
    ),
  confirmPassword: z.string().min(1, 'Confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
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

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      if (dataUrl) {
        setProfilePicture(dataUrl);
        showSuccess('Profile picture ready. Save to update.');
      }
    };
    reader.onerror = () => {
      showError(null, 'Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (values) => {
    try {
      setLoading(true);

      if (user?.isFirstLogin) {
        const res = await authService.setInitialPassword(values.newPassword);
        const data = res?.data ?? res;
        if (data?.token) {
          localStorage.setItem('token', data.token);
        }
        if (data?.user) {
          updateUser({ ...data.user, profilePicture: profilePicture || data.user.profilePicture });
        }
        if (profilePicture) {
          try {
            await userService.update(user.id, { profilePicture, isFirstLogin: false });
          } catch (_) {}
        }
      } else {
        const updateData = {
          profilePicture: profilePicture,
          isFirstLogin: false
        };
        await userService.update(user.id, updateData);
        updateUser({ ...user, isFirstLogin: false, profilePicture });
      }

      showSuccess('Profile updated successfully! Welcome to ShopWISE!');
      onComplete();
    } catch (error) {
      showError(error, 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={visible} onOpenChange={() => {}}>
      <DialogContent className="sm:w-[min(92vw,720px)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Complete Your Profile
          </DialogTitle>
          <DialogDescription>
            Please complete your profile setup by changing your password and adding a profile picture.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Welcome to ShopWISE!</AlertTitle>
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
                  <AvatarImage
                    src={resolveImageUrl(profilePicture || user?.profilePicture || '') || undefined}
                    alt={user?.name}
                  />
                  <AvatarFallback>
                    <User className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-center gap-2">
                  <label htmlFor="profile-picture-upload">
                    <SecondaryButton
                      type="button"
                      className="cursor-pointer"
                      asChild
                    >
                      <span>
                        <Camera className="h-4 w-4 mr-2" />
                        Upload Profile Picture
                      </span>
                    </SecondaryButton>
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
              loading={loading}
              size="lg"
            >
              Complete Setup & Continue
            </Button>
          </form>
        </Form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default ForcePasswordChange;
