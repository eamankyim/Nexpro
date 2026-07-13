import api from './api';
import { withActiveShopScope } from '../utils/shopScope';

const merchandiseService = {
  /**
   * Read-only stock value overview (Assets → Merchandise). Manager+ only — backend
   * returns 403 for staff before this ever resolves.
   */
  getSummary: async () => {
    const params = withActiveShopScope({});
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/merchandise/summary?${query}` : '/merchandise/summary');
  },
};

export default merchandiseService;
