import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlasmaContainerList } from '../components/PlasmaContainerList';
import '@testing-library/jest-dom';

const mockContainers = [
  {
    id: 'PB001',
    name: 'Test Container',
    location: 'Freezer A',
    occupiedSlots: 5,
    totalSlots: 10,
    lastUpdated: '2025-09-10 12:00',
    temperature: '-80C',
    containerType: '9x9-box' as const,
    sampleType: 'DP Pools' as const,
  },
];

describe('PlasmaContainerList', () => {
  it('renders container names', () => {
    render(<PlasmaContainerList containers={mockContainers} />);
    expect(screen.getByText('Test Container')).toBeInTheDocument();
  });

  it('shows create button when containers exist', () => {
    render(<PlasmaContainerList containers={mockContainers} />);
    expect(screen.getByText(/Create New Container/i)).toBeInTheDocument();
  });

  it('shows welcome message when no containers', () => {
    render(<PlasmaContainerList containers={[]} />);
    expect(screen.getByText(/Welcome to Plasma Storage Management/i)).toBeInTheDocument();
  });
});
