import { cn } from '@/lib/utils';

/**
 * FormFieldGrid - Responsive grid component that stacks fields on mobile
 * @param {React.ReactNode} children - Form fields to display
 * @param {number} columns - Number of columns on desktop (default: 2)
 * @param {string} className - Additional CSS classes
 */
const FormFieldGrid = ({ children, columns = 2, className }) => {
  // Map columns to Tailwind grid classes
  const gridColsClass = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
  };

  return (
    <div
      className={cn(
        'grid gap-4',
        // Mobile: always single column
        'grid-cols-1',
        // Desktop: use specified columns
        gridColsClass[columns] || 'sm:grid-cols-2',
        className
      )}
    >
      {children}
    </div>
  );
};

export default FormFieldGrid;
