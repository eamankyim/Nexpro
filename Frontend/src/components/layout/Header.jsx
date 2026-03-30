import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lightbulb,
  LogOut,
  Settings,
  Link as LinkIcon,
  User,
  ChevronDown,
  Search,
  Sparkles,
  X,
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
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/context/AuthContext';
import { useHintMode } from '@/context/HintModeContext';
import { useSmartSearch } from '@/context/SmartSearchContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useResponsive, useSafeAreaInsets } from '@/hooks/useResponsive';
import { RESPONSIVE } from '@/constants';
import { resolveImageUrl } from '@/utils/fileUtils';
import NotificationBell from '@/components/NotificationBell';
import TourButton from '@/components/tour/TourButton';
import { MobileSidebar } from './Sidebar';
import { cn } from '@/lib/utils';

export function Header() {
  const navigate = useNavigate();
  const { user, logout, activeTenant, isManager } = useAuth();
  const { hintMode, toggleHintMode } = useHintMode();
  const { placeholder, scope, searchValue, setSearchValue } = useSmartSearch();
  const { isMobile, isTablet } = useResponsive();
  const safeAreaInsets = useSafeAreaInsets();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  const handleNavigateToSabito = () => {
    const token = localStorage.getItem('token');
    // Default to production Sabito app when env var is not set
    const sabitoUrl = import.meta.env.VITE_SABITO_URL || 'https://myapp.sabito.app';
    const url = token ? `${sabitoUrl}?nexproToken=${token}` : sabitoUrl;
    window.location.href = url;
  };

  // Handle search expansion on mobile
  const handleSearchIconClick = () => {
    if (isMobile) {
      setIsSearchExpanded(true);
    }
  };

  const handleSearchClose = () => {
    setIsSearchExpanded(false);
    // Optionally clear search on close
    // setSearchValue('');
  };

  // Auto-focus input when expanded
  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      // Small delay to ensure transition completes
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSearchExpanded]);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isSearchExpanded &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target) &&
        !searchInputRef.current?.contains(event.target)
      ) {
        handleSearchClose();
      }
    };

    if (isSearchExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSearchExpanded]);

  // Close search on blur if empty
  const handleSearchBlur = (e) => {
    if (isMobile && !searchValue && !e.currentTarget.contains(e.relatedTarget)) {
      // Delay to allow click events to fire first
      setTimeout(() => {
        if (!searchValue) {
          handleSearchClose();
        }
      }, 200);
    }
  };

  const closeMenu = () => setUserMenuOpen(false);

  return (
    <header 
      className="sticky top-0 z-40 w-full border-b border-border bg-card"
      style={{
        paddingTop: safeAreaInsets.top > 0 ? `${safeAreaInsets.top}px` : undefined,
      }}
    >
      <div 
        ref={searchContainerRef}
        className={cn(
          "flex h-16 items-center justify-between gap-1.5 md:gap-2 lg:gap-4 transition-all duration-300",
          // Responsive horizontal padding: compact on very small devices
          "px-4 sm:px-6 lg:px-10",
          // When search is expanded on mobile, keep consistent padding
          isMobile && isSearchExpanded && "px-4"
        )}
        style={{
          paddingLeft: safeAreaInsets.left > 0 
            ? `calc(1.5rem + ${safeAreaInsets.left}px)` 
            : undefined,
          paddingRight: safeAreaInsets.right > 0 
            ? `calc(1.5rem + ${safeAreaInsets.right}px)` 
            : undefined,
        }}
      >
        {/* Left side: Mobile sidebar and Search */}
        <div className={cn(
          "flex items-center gap-1.5 md:gap-2 lg:gap-4 flex-1 min-w-0 transition-all duration-300",
          // When search expanded on mobile, hide sidebar and other elements
          isMobile && isSearchExpanded && "gap-0"
        )}>
          {/* Mobile Sidebar - Hide when search is expanded */}
          {(!isMobile || !isSearchExpanded) && <MobileSidebar />}
          
          {/* Search - Icon only on mobile when collapsed, full input when expanded */}
          {isMobile ? (
            isSearchExpanded ? (
              // Expanded search on mobile
              <div className="relative flex-1 w-full flex items-center gap-2" data-tour="header-search">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    ref={searchInputRef}
                    key={scope}
                    type="search"
                    placeholder={placeholder}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onBlur={handleSearchBlur}
                    className="pl-10 pr-10 w-full min-h-[44px]"
                    style={{ borderRadius: '32px' }}
                  />
                  {searchValue && (
                    <button
                      onClick={() => setSearchValue('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                    >
                      <X className="h-6 w-6 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSearchClose}
                  className="min-h-[44px] min-w-[44px] flex-shrink-0"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
            ) : (
              // Collapsed search icon on mobile
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSearchIconClick}
                className="min-h-[44px] min-w-[44px] flex-shrink-0"
              >
                <Search className="h-5 w-5" />
              </Button>
            )
          ) : (
            // Desktop/Tablet: Always show full search
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative flex-1 max-w-md" data-tour="header-search">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                key={scope}
                type="search"
                placeholder={placeholder}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-10 w-full"
                style={{ borderRadius: '32px' }}
              />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">Quick search across customers, products, sales, and more</TooltipContent>
            </Tooltip>
          )}
        </div>
        
        {/* Right side: Upgrade button, Notifications, User menu - Hide when search expanded on mobile */}
        {(!isMobile || !isSearchExpanded) && (
          <div className="flex items-center gap-1.5 md:gap-2 lg:gap-3 flex-shrink-0">
            {/* Upgrade to Pro button hidden for now.
            {isManager && activeTenant && activeTenant.plan === 'trial' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size={isMobile ? "icon" : "sm"}
                    onClick={() => navigate('/checkout')}
                    className={cn(
                      "bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white",
                      isMobile ? "h-11 w-11" : "hidden sm:flex",
                      "min-h-[44px] min-w-[44px]"
                    )}
                    style={{ borderRadius: '32px' }}
                  >
                    <Crown className={cn("h-4 w-4", !isMobile && "mr-2")} />
                    {!isMobile && <span>Upgrade Plan</span>}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Upgrade your plan for more features and capacity</TooltipContent>
              </Tooltip>
            )}
            */}
            
            {/* Ask AI */}
            {isManager && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size={isMobile ? 'icon' : 'sm'}
                    onClick={() => navigate('/ask-ai')}
                    className={cn(
                      isMobile ? 'min-h-[44px] min-w-[44px]' : 'h-9',
                      'border-border'
                    )}
                  >
                    <Sparkles className={cn('h-4 w-4', !isMobile && 'mr-2')} />
                    {!isMobile && <span>Ask AI</span>}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Open AI assistant page</TooltipContent>
              </Tooltip>
            )}

            {/* Notification Bell */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div data-tour="header-notifications" className="inline-flex">
                  <NotificationBell />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">View order updates, low stock alerts, and other notifications</TooltipContent>
            </Tooltip>
            
            {/* User Profile Dropdown */}
            <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className={cn(
                    "flex items-center gap-2 h-auto hover:bg-muted rounded-[32px] bg-muted",
                    // Keep touch target and use 3px horizontal padding.
                    isMobile ? "px-[3px] py-0 min-h-[44px] min-w-[44px]" : "px-[3px] py-0"
                  )}
                >
                  <Avatar className={cn("h-8 w-8", isMobile ? "!rounded-md" : "")}>
                    <AvatarImage src={resolveImageUrl(user?.profilePicture || '') || undefined} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn(
                    "text-sm text-foreground font-medium",
                    isMobile ? "hidden" : "hidden sm:inline"
                  )}>
                    {user?.name || 'User'}
                  </span>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground",
                    isMobile ? "hidden" : "hidden sm:inline"
                  )} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-0">
                <div
                  className="p-0"
                  onClick={closeMenu}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') closeMenu(); }}
                  role="presentation"
                >
                  <TourButton
                    variant="ghost"
                    className="w-full justify-start min-h-[44px] rounded-sm px-2"
                  />
                </div>
                <DropdownMenuSeparator className="mx-0 my-0" />
                <div className="flex items-center justify-between gap-3 px-2 py-2 min-h-[44px]">
                  <Lightbulb className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium flex-1">Hint Mode</span>
                  <Switch
                    checked={hintMode}
                    onCheckedChange={(checked) => {
                      toggleHintMode(checked);
                      closeMenu();
                    }}
                  />
                </div>
                <DropdownMenuSeparator className="mx-0 my-0" />
                <DropdownMenuItem
                  onClick={() => {
                    closeMenu();
                    navigate('/profile');
                  }}
                  className="min-h-[44px]"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                {isManager && (
                  <DropdownMenuItem
                    onClick={() => {
                      closeMenu();
                      navigate('/settings');
                    }}
                    className="min-h-[44px]"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="mx-0 my-0" />
                <DropdownMenuItem
                  onClick={() => {
                    closeMenu();
                    handleNavigateToSabito();
                  }}
                  className="min-h-[44px]"
                >
                  <LinkIcon className="mr-2 h-4 w-4" />
                  <span>Open Sabito</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    closeMenu();
                    logout();
                    navigate('/login');
                  }}
                  className="min-h-[44px]"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
}
