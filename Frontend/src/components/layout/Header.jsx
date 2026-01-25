import { useNavigate } from 'react-router-dom';
import { 
  Crown, 
  LogOut, 
  Settings, 
  Link as LinkIcon,
  User,
  ChevronDown,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import NotificationBell from '@/components/NotificationBell';
import { MobileSidebar } from './Sidebar';

export function Header({ onMenuClick }) {
  const navigate = useNavigate();
  const { user, logout, activeTenant } = useAuth();

  const handleNavigateToSabito = () => {
    const token = localStorage.getItem('token');
    const sabitoUrl = import.meta.env.VITE_SABITO_URL || 'http://localhost:5175';
    const url = token 
      ? `${sabitoUrl}?nexproToken=${token}`
      : sabitoUrl;
    window.location.href = url;
  };

  const userMenuItems = [
    {
      label: 'Settings',
      icon: Settings,
      onClick: () => navigate('/settings'),
    },
    {
      label: 'Open Sabito',
      icon: LinkIcon,
      onClick: handleNavigateToSabito,
    },
    {
      label: 'Logout',
      icon: LogOut,
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white">
      <div className="container flex h-16 items-center justify-between px-4 gap-4">
        {/* Left side: Mobile sidebar and Search */}
        <div className="flex items-center gap-4 flex-1">
          <MobileSidebar />
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products, customers and transactions"
              className="pl-10 w-full"
            />
          </div>
        </div>
        
        {/* Right side: Upgrade button, Notifications, User menu */}
        <div className="flex items-center gap-3">
          {/* Upgrade to Pro Button */}
          {activeTenant && (activeTenant.plan === 'trial' || activeTenant.plan === 'free') && (
            <Button
              size="sm"
              onClick={() => navigate('/checkout')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 hidden sm:flex"
            >
              <Crown className="h-4 w-4 mr-2" />
              <span>Upgrade to Pro</span>
            </Button>
          )}
          
          {/* Notification Bell */}
          <NotificationBell />
          
          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-auto p-1.5 hover:bg-gray-100">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profilePicture} />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm text-gray-900 font-medium">{user?.name || 'User'}</span>
                <ChevronDown className="h-4 w-4 hidden sm:inline text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {userMenuItems.map((item, index) => (
                <div key={index}>
                  {index === 1 && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={item.onClick}>
                    <item.icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                  {(index === 0 || index === 1) && <DropdownMenuSeparator />}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
