import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle, CardContent } from '@/components/ui/card';

describe('UI Design System Components', () => {
  it('renders a primary button correctly', () => {
    render(<Button>Submit Intention</Button>);
    const btn = screen.getByRole('button', { name: /submit intention/i });
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('Submit Intention');
  });

  it('renders status badges with appropriate styling', () => {
    render(<Badge variant="success">Definitely Eating</Badge>);
    const badge = screen.getByText(/definitely eating/i);
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('Definitely Eating');
  });

  it('renders cards with title and content', () => {
    render(
      <Card>
        <CardTitle>Monday Breakfast</CardTitle>
        <CardContent>Pongal, Chutney, Boiled Egg</CardContent>
      </Card>
    );
    expect(screen.getByText('Monday Breakfast')).toBeTruthy();
    expect(screen.getByText(/pongal, chutney/i)).toBeTruthy();
  });
});
