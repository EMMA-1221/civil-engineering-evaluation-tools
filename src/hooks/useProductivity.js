import { useContext } from 'react';
import { ProductivityContext } from '../contexts';

export function useProductivity() {
  const context = useContext(ProductivityContext);
  if (!context) {
    throw new Error('useProductivity must be used within a ProductivityProvider');
  }
  return context;
}
