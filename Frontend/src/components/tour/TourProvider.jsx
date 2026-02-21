import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Joyride, { STATUS } from 'react-joyride';
import { ImageIcon, Sparkles, LayoutDashboard, Navigation, Zap, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TourContext, useTourInternal } from '../../hooks/useTour';
import { getJoyrideConfig, TOUR_IDS } from '../../config/tours';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

/**
 * Renders a tour step with a large image placeholder and text.
 * @param {string} content - Step body text
 * @returns {JSX.Element}
 */
function TourStepContent({ content }) {
  return (
    <div className="tour-step-content flex flex-col gap-4 w-full">
      <div
        className="tour-step-image-placeholder w-full rounded-md border border-gray-200 bg-gray-100 flex flex-col items-center justify-center text-gray-500"
        style={{ minHeight: '260px' }}
        aria-hidden
      >
        <ImageIcon className="w-14 h-14 mb-2 opacity-50" strokeWidth={1.5} />
        <span className="text-sm">Image placeholder</span>
      </div>
      <p className="text-left text-gray-700 text-[15px] leading-relaxed">{content}</p>
    </div>
  );
}

/**
 * TourProvider - Manages app tours and provides tour context
 * Wraps the application to handle tour state and triggers
 */
export default function TourProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeTenant } = useAuth();
  const tourValue = useTourInternal();
  const {
    runningTour,
    tourStepIndex,
    setTourStepIndex,
    startTour,
    stopTour,
    completeTour,
    isTourCompleted
  } = tourValue;

  const [showTourPrompt, setShowTourPrompt] = useState(false);

  const businessType = activeTenant?.businessType || 'shop';
  const isRunning = runningTour === TOUR_IDS.MAIN_TOUR;
  const tourConfig = getJoyrideConfig(businessType, isRunning);

  const stepsWithImages = tourConfig.steps.map((step) => ({
    ...step,
    content: <TourStepContent content={step.content} />
  }));

  // Debug log for tour state
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[TourProvider] state:', {
      pathname: location.pathname,
      runningTour,
      isRunning,
      tourStepIndex,
      businessType,
    });
  }, [location.pathname, runningTour, isRunning, tourStepIndex, businessType]);

  const handleTourCallback = useCallback(
    (data) => {
      const { status, type, index, action } = data;

      if (import.meta.env.DEV) {
        console.log('[TourProvider] Joyride callback:', { status, type, index, action });
      }

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        if (status === STATUS.FINISHED && runningTour === TOUR_IDS.MAIN_TOUR) {
          completeTour(TOUR_IDS.MAIN_TOUR, '1.0.0');
        } else {
          stopTour();
        }
      } else if (type === 'step:after') {
        if (action === 'prev') {
          setTourStepIndex(Math.max(0, index - 1));
        } else {
          setTourStepIndex(index + 1);
        }
      }
    },
    [runningTour, completeTour, stopTour, setTourStepIndex]
  );

  // When the main tour starts, ensure we are on the dashboard so all targets exist
  useEffect(() => {
    if (runningTour === TOUR_IDS.MAIN_TOUR && location.pathname !== '/dashboard') {
      navigate('/dashboard');
    }
  }, [runningTour, location.pathname, navigate]);

  // Show tour prompt on first dashboard visit when user hasn't completed the tour
  useEffect(() => {
    if (location.pathname !== '/dashboard' || isTourCompleted(TOUR_IDS.MAIN_TOUR)) return;

    const timer = setTimeout(() => {
      const alreadyPrompted = sessionStorage.getItem('mainTourPromptedThisSession');
      if (!alreadyPrompted) {
        setShowTourPrompt(true);
        sessionStorage.setItem('mainTourPromptedThisSession', 'true');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [location.pathname, isTourCompleted]);

  // Handle user's response to tour prompt
  const handleStartTour = useCallback(() => {
    setShowTourPrompt(false);
    startTour(TOUR_IDS.MAIN_TOUR);
  }, [startTour]);

  const handleSkipTour = useCallback(() => {
    setShowTourPrompt(false);
    // Mark as "dismissed" so we don't prompt again this session
    sessionStorage.setItem('tourDismissedThisSession', 'true');
  }, []);

  return (
    <TourContext.Provider value={tourValue}>
      {children}
      
      {/* Tour Prompt Dialog */}
      <Dialog open={showTourPrompt} onOpenChange={setShowTourPrompt}>
        <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden">
          {/* Header with gradient background */}
          <div className="bg-gradient-to-br from-green-600 to-green-700 px-6 py-8 text-center">
            <div className="mx-auto w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-1">
              Welcome to ShopWISE!
            </h2>
            <p className="text-green-100 text-sm">
              Let's get you started with a quick tour
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-gray-600 text-sm mb-4">
              Take a guided tour to discover how ShopWISE can help you manage your business efficiently.
            </p>

            {/* Feature highlights */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <LayoutDashboard className="h-4.5 w-4.5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Dashboard Overview</p>
                  <p className="text-xs text-gray-500">Understand your business at a glance</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Navigation className="h-4.5 w-4.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Navigation & Features</p>
                  <p className="text-xs text-gray-500">Find everything you need quickly</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-4.5 w-4.5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Quick Actions</p>
                  <p className="text-xs text-gray-500">Speed up your daily tasks</p>
                </div>
              </div>
            </div>

            {/* Duration badge */}
            <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-gray-500">
              <Clock className="h-3.5 w-3.5" />
              <span>Takes about 2 minutes</span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={handleSkipTour}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              Maybe Later
            </Button>
            <Button 
              onClick={handleStartTour} 
              className="bg-green-600 hover:bg-green-700 text-white gap-1"
            >
              Start Tour
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isRunning && (
        <Joyride
          {...tourConfig}
          steps={stepsWithImages}
          callback={handleTourCallback}
          stepIndex={tourStepIndex}
          floaterProps={{
            disableAnimation: true,
          }}
        />
      )}
    </TourContext.Provider>
  );
}
