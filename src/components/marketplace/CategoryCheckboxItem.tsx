
"use client";

import type { Product } from '@/types';
import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface CategoryCheckboxItemProps {
  category: string;
  isChecked: boolean;
  onToggle: (category: string) => void;
}

const CategoryCheckboxItem = React.memo(({ category, isChecked, onToggle }: CategoryCheckboxItemProps) => {
  // This callback is stable for each instance of CategoryCheckboxItem
  // because `onToggle` and `category` props are stable or change predictably.
  const handleCheckedChange = React.useCallback(() => {
    onToggle(category);
  }, [onToggle, category]);

  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={`category-${category}`}
        checked={isChecked}
        onCheckedChange={handleCheckedChange} // Pass the stable callback
      />
      <Label htmlFor={`category-${category}`} className="font-normal cursor-pointer">
        {category}
      </Label>
    </div>
  );
});

CategoryCheckboxItem.displayName = 'CategoryCheckboxItem';

export { CategoryCheckboxItem };
