
"use client";

import type { Dispatch, SetStateAction, FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  onSearchSubmit: () => void;
}

export function SearchBar({ searchQuery, setSearchQuery, onSearchSubmit }: SearchBarProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearchSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2 bg-card p-2 rounded-lg shadow">
      <Search className="w-5 h-5 text-muted-foreground ml-2" />
      <Input
        type="text"
        placeholder="Search for anything..." // Updated placeholder
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="flex-grow bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
      />
      <Button type="submit" aria-label="Search products" style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
        Search
      </Button>
    </form>
  );
}
