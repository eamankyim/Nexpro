import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Joyride, { STATUS } from 'react-joyride';
import { ImageIcon, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '@/context/BrandingContext';
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
  const { primaryColor: brandPrimaryHex } = useBranding();
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
  const tourConfig = getJoyrideConfig(businessType, isRunning, brandPrimaryHex);

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
      
      {/* Tour Prompt Dialog – minimal, app-colored */}
      <Dialog open={showTourPrompt} onOpenChange={setShowTourPrompt}>
        <DialogContent className="sm:max-w-[380px] p-0 gap-0 overflow-hidden border border-border">
          <div className="px-6 pt-6 pb-4">
            {/* Placeholder image area */}
            <div
              className="w-full rounded-lg border border-border bg-muted flex flex-col items-center justify-center text-muted-foreground mb-5"
              style={{ height: 140, backgroundColor: `${brandPrimaryHex}14` }}
              aria-hidden
            >
              <ImageIcon className="w-10 h-10 mb-1 opacity-60" strokeWidth={1.5} style={{ color: brandPrimaryHex }} />
              <span className="text-xs">Image placeholder</span>
            </div>

            <h2 className="text-lg font-semibold text-foreground text-center mb-2">
              Welcome to African Business Suite!
            </h2>
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              You can continue the tour to learn how to use the platform. If you wish, you can exit from the tour by clicking the button.
            </p>

            {/* Progress dot (single step for this prompt) */}
            <div className="flex justify-center gap-1.5 mt-5">
              <span className="w-2 h-2 rounded-full bg-foreground/20" aria-hidden />
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: brandPrimaryHex }} aria-hidden />
              <span className="w-2 h-2 rounded-full bg-foreground/20" aria-hidden />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={handleSkipTour} className="border-border text-muted-foreground w-full">
              Maybe Later
            </Button>
            <Button onClick={handleStartTour} className="text-white gap-1 w-full bg-brand hover:bg-brand-dark border-0">
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
