import { Link } from 'react-router-dom';

import FeatureNotAvailable from './FeatureNotAvailable';
import { isSabitoStoreEnabled } from '../utils/sabitoStoreFeature';

import { Button } from '@/components/ui/button';

/**
 * Renders Sabito Store merchant pages when enabled; otherwise shows a friendly unavailable state.
 * Online Store setup (`/store/setup`, `/store/settings`) stays available so merchants can still
 * configure their own-domain storefront while Sabito marketplace UI is hidden.
 * @param {{ children: import('react').ReactNode }} props
 */
const SabitoStoreRoute = ({ children }) => {
  if (!isSabitoStoreEnabled()) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <FeatureNotAvailable
          icon="Store"
          title="Sabito Store is not available"
          description="Sabito Store is temporarily hidden. You can still set up and manage your Online Store on your own domain."
        />
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/store/setup">Start store setup</Link>
          </Button>
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
