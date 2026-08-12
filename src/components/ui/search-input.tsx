import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface SearchInputProps extends React.ComponentPropsWithoutRef<'input'> {
  onSearch: (query: string) => void;
  debounceTime?: number;
  placeholder?: string;
  initialQuery?: string;
}

export function SearchInput({
  onSearch,
  debounceTime = 300,
  placeholder = 'Search...',
  initialQuery = '',
  className,
  ...props
}: SearchInputProps) {
  const [query, setQuery] = React.useState(initialQuery);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(query);
    }, debounceTime);

    return () => {
      clearTimeout(handler);
    };
  }, [query, debounceTime, onSearch]);

  const handleClear = () => {
    setQuery('');
  };

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full pl-10 pr-10 rounded-lg"
        {...props}
      />
      {query && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:bg-transparent"
          onClick={handleClear}
          aria-label="Clear search query"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
