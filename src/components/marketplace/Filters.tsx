
"use client";

import type { Dispatch, SetStateAction } from 'react';
import React from 'react'; 
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter, Loader2 } from 'lucide-react';
import { CategoryCheckboxItem } from './CategoryCheckboxItem'; 
import { Skeleton } from '@/components/ui/skeleton';

interface FiltersProps {
  allCategories: string[];
  selectedCategories: string[];
  // setSelectedCategories: Dispatch<SetStateAction<string[]>>; // Changed to direct callback
  setSelectedCategories: (categoryToToggle: string) => void;
  priceRange: [number, number];
  setPriceRange: Dispatch<SetStateAction<[number, number]>>;
  maxPrice: number;
  isLoading?: boolean;
}

export function Filters({
  allCategories,
  selectedCategories,
  setSelectedCategories,
  priceRange,
  setPriceRange,
  maxPrice,
  isLoading = false,
}: FiltersProps) {
  
  const handlePriceChange = (newRange: [number, number]) => {
    setPriceRange(newRange);
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <Filter className="w-5 h-5 mr-2 text-primary" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-md font-semibold mb-2 block">Categories</Label>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : allCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories available.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2"> {/* Increased max-h */}
              {allCategories.map(category => (
                <CategoryCheckboxItem
                  key={category}
                  category={category}
                  isChecked={selectedCategories.includes(category)}
                  onToggle={setSelectedCategories} // Pass the stable callback directly
                />
              ))}
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="price-range" className="text-md font-semibold mb-2 block">
            Price Range: ${priceRange[0]} - ${priceRange[1]}
          </Label>
          {isLoading && maxPrice === 0 ? (
             <Skeleton className="h-5 w-full mt-1 mb-3" />
          ) : (
            <>
            <Slider
              id="price-range"
              min={0}
              max={maxPrice > 0 ? maxPrice : 100} // Provide a sensible default max if 0
              step={1}
              value={priceRange[1] > maxPrice && maxPrice > 0 ? [Math.min(priceRange[0],maxPrice), maxPrice] : priceRange}
              onValueChange={handlePriceChange}
              className="w-full"
              disabled={maxPrice === 0 && !isLoading}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>$0</span>
              <span>${maxPrice > 0 ? maxPrice : 100}</span>
            </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
