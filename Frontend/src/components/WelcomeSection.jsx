import { memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * WelcomeSection - Reusable welcome section with greeting and sub text
 * @param {string} welcomeMessage - The welcome message to display
 * @param {string} subText - The sub text to display below the welcome message
 */
const WelcomeSection = memo(({ welcomeMessage, subText }) => {
  return (
    <div className="mb-4 md:mb-8">
      <h1 className={cn(
        "font-bold text-2xl md:text-3xl lg:text-4xl",
        "mb-2 text-gray-900"
      )}>
        {welcomeMessage}
      </h1>
      <p className={cn(
        "text-sm md:text-base text-gray-600 m-0"
      )}>
        {subText}
      </p>
    </div>
  );
});

WelcomeSection.displayName = 'WelcomeSection';

export default WelcomeSection;
