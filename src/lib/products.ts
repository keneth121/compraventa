import type { Product } from '@/types';

// Sample products are removed. Products will be fetched from Firestore.
export const sampleProducts: Product[] = [];

// productCategories will be derived dynamically from Firestore data in the component.
export const productCategories: string[] = [];

// maxProductPrice will be derived dynamically from Firestore data in the component.
export const maxProductPrice: number = 0;
