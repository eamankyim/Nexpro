import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

/**
 * Hook to check if current tenant has access to a feature
 * 
 * Usage:
 * const { hasFeature, features, loading } = useFeatureAccess();
 * 
 * if (hasFeature('inventory')) {
 *   // Show inventory features
 * }
 */
export const useFeatureAccess = () => {
  const { user } = useAuth();
  const [features, setFeatures] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTenantFeatures = async () => {
      try {
        setLoading(true);
        const tenantId = localStorage.getItem('activeTenantId');
        
        if (!tenantId) {
          setFeatures([]);
          setLoading(false);
          return;
        }

        // Fetch tenant details to get their plan
        const response = await api.get(`/tenants/${tenantId}`);
        const tenantPlan = response.data?.plan || 'trial';
        
        setPlan(tenantPlan);
        
        // For now, store plan info in features array
        // In production, you'd fetch the actual subscription plan
        setFeatures(tenantPlan);
        
      } catch (error) {
        console.error('Failed to fetch tenant features:', error);
        setFeatures([]);
      } finally {
        setLoading(false);
      }
    };

    if (user && !user.isPlatformAdmin) {
      fetchTenantFeatures();
    } else {
      // Platform admins have all features
      setFeatures('all');
      setLoading(false);
    }
  }, [user]);

  const hasFeature = (featureKey) => {
    // Platform admins have all features
    if (user?.isPlatformAdmin || features === 'all') {
      return true;
    }

    // For now, return true for trial/launch/scale plans
    // In production, this would check against the actual plan features
    return true; // TODO: Implement actual feature checking
  };

  const hasAnyFeature = (featureKeys) => {
    return featureKeys.some(key => hasFeature(key));
  };

  const hasAllFeatures = (featureKeys) => {
    return featureKeys.every(key => hasFeature(key));
  };

  return {
    hasFeature,
    hasAnyFeature,
    hasAllFeatures,
    features,
    plan,
    loading
  };
};

/**
 * Component wrapper to conditionally render based on feature access
 * 
 * Usage:
 * <FeatureGate feature="inventory">
 *   <InventoryComponent />
 * </FeatureGate>
 */
export const FeatureGate = ({ feature, features, fallback = null, children }) => {
  const { hasFeature, hasAnyFeature, loading } = useFeatureAccess();

  if (loading) {
    return fallback;
  }

  if (feature && !hasFeature(feature)) {
    return fallback;
  }

  if (features && !hasAnyFeature(features)) {
    return fallback;
  }

  return children;
};

export default useFeatureAccess;

