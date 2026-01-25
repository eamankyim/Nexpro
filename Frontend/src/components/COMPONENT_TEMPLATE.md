# Component Structure Template

This document outlines the standard structure for React components in the Nexpro application.

## Standard Component Structure

```jsx
// 1. External dependencies (React, libraries)
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Internal dependencies (services, hooks, utils)
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import service from '../services/service';
import { showSuccess, showError } from '../utils/toast';

// 3. UI components (shadcn/ui)
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// 4. Constants
import { PAGINATION, DEBOUNCE_DELAYS } from '../constants';

// 5. Types/Schemas (if using Zod)
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

/**
 * Component description
 * 
 * @component
 * @example
 * <ComponentName prop1="value" />
 */
const ComponentName = () => {
  // 1. Hooks (useAuth, useNavigate, etc.)
  const { user, activeTenant } = useAuth();
  const navigate = useNavigate();

  // 2. State declarations
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ search: '', status: '' });

  // 3. Debounced values
  const debouncedSearch = useDebounce(filters.search, DEBOUNCE_DELAYS.SEARCH);

  // 4. Memoized values
  const computedValue = useMemo(() => {
    // computation
  }, [dependencies]);

  // 5. Callbacks
  const handleAction = useCallback(() => {
    // handler logic
  }, [dependencies]);

  // 6. Effects
  useEffect(() => {
    // effect logic
  }, [dependencies]);

  // 7. Event handlers
  const handleSubmit = async (values) => {
    // handler logic
  };

  // 8. Render
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
};

export default ComponentName;
```

## Naming Conventions

- **Components**: PascalCase (e.g., `CustomerList`, `InvoiceForm`)
- **Functions**: camelCase (e.g., `handleSubmit`, `fetchData`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `API_TIMEOUT`)
- **Files**: Match component name (e.g., `CustomerList.jsx`)

## Import Order

1. React and external libraries
2. Internal services, hooks, utils
3. UI components
4. Constants
5. Types/Schemas

## Best Practices

1. Use `useMemo` for expensive computations
2. Use `useCallback` for functions passed as props
3. Debounce search inputs
4. Handle loading and error states
5. Use constants from `constants/index.js`
6. Add JSDoc comments for complex functions
7. Keep components focused and single-purpose
