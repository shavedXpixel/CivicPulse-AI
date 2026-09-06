import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { MockProblem } from '../../lib/mockData';
import { ProblemCard } from './ProblemCard';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';

export interface ProblemListProps {
  problems: MockProblem[];
  isLoading?: boolean;
}

export function ProblemList({ problems, isLoading = false }: ProblemListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const filteredProblems = problems.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.wardName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['ALL', ...Array.from(new Set(problems.map((p) => p.category)))];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full">
          <Input
            placeholder="Search problems, wards, IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefixIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-ink-primary text-white'
                  : 'bg-white text-ink-secondary border border-ink-border hover:bg-canvas-subtle'
              }`}
            >
              {cat === 'ALL' ? 'All Categories' : cat.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-40 rounded-xl bg-canvas-muted animate-pulse" />
          ))}
        </div>
      ) : filteredProblems.length > 0 ? (
        <div className="space-y-3">
          {filteredProblems.map((problem, idx) => (
            <ProblemCard key={problem.id} problem={problem} rank={idx + 1} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No problems found"
          description="No active problem clusters match your search or category filter."
          action={
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
              }}
              className="text-xs font-semibold text-civic-blue hover:underline"
            >
              Reset Filters
            </button>
          }
        />
      )}
    </div>
  );
}
