import type { Product } from '@/types';
import { ProductGrid } from './ProductGrid';
import { Sparkles, Loader2 } from 'lucide-react';

interface AiRecommendationsSectionProps {
  products: Product[];
  isLoading: boolean;
  hasSearched: boolean;
}

export function AiRecommendationsSection({ products, isLoading, hasSearched }: AiRecommendationsSectionProps) {
  if (!hasSearched && !isLoading) {
    return null; // Don't show section if no search has been performed
  }

  return (
    <section className="py-8">
      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <Sparkles className="w-6 h-6 mr-2 text-accent" />
        AI Recommendations
      </h2>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Finding recommendations...</p>
        </div>
      ) : (
        <ProductGrid products={products} emptyStateMessage="No AI recommendations for this search." />
      )}
    </section>
  );
}
