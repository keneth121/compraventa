import type { Product } from '@/types';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  emptyStateMessage?: string;
}

export function ProductGrid({ products, emptyStateMessage = "No products match your criteria." }: ProductGridProps) {
  if (!products || products.length === 0) {
    return <p className="text-center text-muted-foreground col-span-full py-8">{emptyStateMessage}</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
