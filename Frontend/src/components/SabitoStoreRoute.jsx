import { Link } from 'react-router-dom';

import FeatureNotAvailable from './FeatureNotAvailable';
import { isSabitoStoreEnabled } from '../utils/sabitoStoreFeature';

import { Button } from '@/components/ui/button';

/**
 * Renders Sabito Store merchant pages when enabled; otherwise shows a friendly unavailable state.
 * @param {{ children: import('react').ReactNode }} props
 */
const SabitoStoreRoute = ({ children }) => {
  if (!isSabitoStoreEnabled()) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <FeatureNotAvailable
          icon="Store"
          title="Sabito Store is not available"
          description="Sabito Store is temporarily hidden. You can still manage your Online Store on your own domain."
        />
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link to="/online-store">Go to Online Store</Link>
          </Button>
        </div>
      </div>
    );
  }

  return children;
};

export default SabitoStoreRoute;
