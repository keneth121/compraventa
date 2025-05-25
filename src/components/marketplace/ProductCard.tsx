
import type { Product } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FilePenLine, Tag, Trash2 } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onEditProduct?: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
}

export function ProductCard({ product, onEditProduct, onDeleteProduct }: ProductCardProps) {
  const primaryImageUrl = product.imageUrl 
    ? product.imageUrl 
    : `https://placehold.co/300x200.png?text=${encodeURIComponent(product.name)}`;

  const cardContent = (
    <Card className="flex flex-col overflow-hidden h-full shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg group">
      <CardHeader className="p-0">
        <div className="aspect-[3/2] relative w-full overflow-hidden rounded-t-lg">
          <Image
            src={primaryImageUrl}
            alt={product.name}
            layout="fill"
            objectFit="cover"
            data-ai-hint={product.imageHint || product.name.split(' ').slice(0,2).join(' ').toLowerCase()}
            className="transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-lg font-semibold mb-1 leading-tight h-12 overflow-hidden group-hover:text-primary transition-colors">
          {product.name}
        </CardTitle>
        <p className="text-sm text-muted-foreground mb-2 line-clamp-2 h-10">
          {product.description}
        </p>
        <div className="flex items-center text-sm text-muted-foreground mb-2">
          <Tag className="w-4 h-4 mr-1 text-primary" /> 
          <Badge variant="secondary">{product.category}</Badge>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex flex-col items-start space-y-3">
        <p className="text-xl font-bold text-primary">
          ${product.price.toFixed(2)}
        </p>
        {onEditProduct && onDeleteProduct && (
          <div className="flex w-full justify-end space-x-2 mt-auto pt-3 border-t">
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEditProduct(product); }}>
              <FilePenLine className="w-3.5 h-3.5 mr-1.5" />
              Editar
            </Button>
            <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeleteProduct(product.id); }}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Eliminar
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );

  if (onEditProduct || onDeleteProduct) {
    // If edit/delete controls are present, don't wrap in a Link
    return cardContent;
  }

  return (
    <Link href={`/product/${product.id}`} passHref legacyBehavior>
      <a className="block no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
        {cardContent}
      </a>
    </Link>
  );
}
