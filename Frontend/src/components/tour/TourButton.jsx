import { PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTour } from '../../hooks/useTour';
import { TOUR_IDS } from '../../config/tours';

/**
 * TourButton - Button to start/restart tours
 * Can be used in header dropdown or settings page
 */
const TourButton = ({ variant = 'default', className = '', onStart }) => {
  const { startTour, isTourCompleted, resetTour } = useTour();
  const mainTourCompleted = isTourCompleted(TOUR_IDS.MAIN_TOUR);

  const handleClick = async () => {
    if (import.meta.env.DEV) {
      console.log('[TourButton] clicked', {
        mainTourCompleted,
        TOUR_ID: TOUR_IDS.MAIN_TOUR,
      });
    }

    // If tour is already completed, reset it first
    if (mainTourCompleted) {
      if (import.meta.env.DEV) {
        console.log('[TourButton] resetting completed tour before start');
      }
      await resetTour(TOUR_IDS.MAIN_TOUR);
    }
    
    // Start the tour
    if (import.meta.env.DEV) {
      console.log('[TourButton] calling startTour');
    }
    startTour(TOUR_IDS.MAIN_TOUR);
    
    // Call optional callback
    if (onStart) {
      onStart();
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleClick}
      className={className}
    >
      <PlayCircle className="h-4 w-4 mr-2" />
      {mainTourCompleted ? 'Restart Tour' : 'Take Tour'}
    </Button>
  );
};

export default TourButton;
