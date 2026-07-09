import { Camera, Loader2, Trash2, User, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import StatusChip from '../../StatusChip';
import FilePreview from '../../FilePreview';
import { resolveSettingsFileUrl } from '../../../utils/settingsUtils';
import { useSettingsProfile } from '../../../hooks/useSettingsProfile';

/**
 * Profile settings section (personal info, password, photo).
 */
const SettingsProfileSection = () => {
  const {
    profileForm,
    profileData,
    loadingProfile,
    profilePreview,
    setProfilePreview,
    profileEditing,
    setProfileEditing,
    showChangePassword,
    setShowChangePassword,
    profilePreviewVisible,
    setProfilePreviewVisible,
    profileUploading,
    needsEmailVerification,
    onProfileSubmit,
    handleProfileImageUpload,
    cancelProfileEdit,
    updateProfileMutation,
  } = useSettingsProfile();

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <Card className="border border-gray-200">
        <CardHeader className="pb-2 md:pb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-0">
            <CardTitle className="text-base md:text-xl">Personal Information</CardTitle>
            <div className="flex gap-1.5 md:gap-2 w-full md:w-auto">
              <Button
                variant="secondaryStroke"
                onClick={() => {
                  if (profileEditing) cancelProfileEdit();
                  else setProfileEditing(true);
                }}
              >
                {profileEditing ? 'Cancel' : 'Edit Profile'}
              </Button>
              {profileEditing && (
                <Button onClick={profileForm.handleSubmit(onProfileSubmit)} loading={updateProfileMutation.isLoading}>
                  Save
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2 md:pt-0">
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-3 md:space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your full name" disabled={!profileEditing} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" disabled {...field} />
                      </FormControl>
                      {needsEmailVerification && (
                        <p className="text-xs text-muted-foreground">Verify your email to change your account email.</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={profileForm.control}
                name="profilePicture"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input type="hidden" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Separator />
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Profile Picture</h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-6 mb-4 md:mb-6">
                <div className="relative">
                  <Avatar
                    className="h-24 w-24 aspect-square cursor-pointer"
                    onClick={() => profilePreview && setProfilePreviewVisible(true)}
                  >
                    {profilePreview && (
                      <AvatarImage src={resolveSettingsFileUrl(profilePreview)} alt="Profile" />
                    )}
                    <AvatarFallback><User className="h-8 w-8" /></AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="profile-picture-upload"
                    className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 border-2 border-background"
                    title="Upload profile picture"
                    onClick={(e) => {
                      if (!profileEditing) {
                        e.preventDefault();
                        setProfileEditing(true);
                        setTimeout(() => {
                          document.getElementById('profile-picture-upload')?.click();
                        }, 100);
                      }
                    }}
                  >
                    <Camera className="h-4 w-4" />
                    <input
                      id="profile-picture-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={profileUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (!profileEditing) setProfileEditing(true);
                          handleProfileImageUpload({ file });
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <div className="flex-1">
                  {!profilePreview && (
                    <p className="text-sm text-muted-foreground">
                      {profileEditing
                        ? 'Click the camera icon to upload a profile picture'
                        : 'No profile picture uploaded yet'}
                    </p>
                  )}
                  {profilePreview && profileEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        profileForm.setValue('profilePicture', '');
                        setProfilePreview('');
                      }}
                      disabled={profileUploading}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                  {profileUploading && (
                    <div className="flex items-center gap-2 mt-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    </div>
                  )}
                  {!profilePreview && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Upload a square image (PNG/JPG) for best results.
                    </p>
                  )}
                </div>
              </div>

              <Separator />
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Change Password</h3>

              {!showChangePassword ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowChangePassword(true);
                    if (!profileEditing) setProfileEditing(true);
                  }}
                  className="w-full md:w-auto"
                >
                  Change Password
                </Button>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormField
                    control={profileForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter current password" disabled={!profileEditing} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter new password" disabled={!profileEditing} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="col-span-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowChangePassword(false);
                        profileForm.setValue('currentPassword', '');
                        profileForm.setValue('newPassword', '');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <Separator />
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Account Information</h3>
              <div className="grid grid-cols-1 gap-3 md:gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <UserCog className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm">{profileData?.data?.role?.toUpperCase() || '—'}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <StatusChip status={profileData?.data?.isActive ? 'active_flag' : 'inactive_flag'} />
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <FilePreview
        open={profilePreviewVisible}
        onClose={() => setProfilePreviewVisible(false)}
        file={profilePreview ? {
          fileUrl: profilePreview,
          title: 'Profile Picture',
          type: 'image',
          metadata: {
            mimeType: profilePreview.startsWith('data:')
              ? profilePreview.match(/data:([^;]+)/)?.[1] || 'image/jpeg'
              : 'image/jpeg',
          },
        } : null}
      />
    </div>
  );
};

export default SettingsProfileSection;
