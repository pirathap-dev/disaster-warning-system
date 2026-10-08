import { expect, test } from 'vitest';
import { cn } from '../lib/utils';

test('cn utility merges tailwind classes correctly', () => {
  expect(cn('px-2 py-1', 'bg-red-500')).toBe('px-2 py-1 bg-red-500');
  expect(cn('px-2 py-1', 'p-4')).toBe('p-4'); // tailwind-merge resolves conflicts
});
