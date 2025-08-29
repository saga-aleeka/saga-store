import React, { useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { TestTube, Grid3x3, Box, Thermometer } from 'lucide-react';
import { TubeRack } from './TubeRack';
import { MicroPlate } from './MicroPlate';
import { StorageBox } from './StorageBox';
import { FreezerRack } from './FreezerRack';

export interface StorageContainer {
  id: string;
  name: string;
  type: 'tube-rack' | 'microplate' | 'storage-box' | 'freezer-rack';
  capacity: number;
  occupied: number;
  temperature?: string;
  location: string;
  lastUpdated: string;
}

const mockContainers: StorageContainer[] = [
  {
    id: 'TR001',
    name: 'Tube Rack A1',
    type: 'tube-rack',
    capacity: 96,
    occupied: 72,
    temperature: 'RT',
    location: 'Lab Bench 1',
    lastUpdated: '2025-08-14 09:30'
  },
  {
    id: 'MP001',
    name: '96-Well Plate #1',
    type: 'microplate',
    capacity: 96,
    occupied: 88,
    temperature: '4°C',
    location: 'Fridge A',
    lastUpdated: '2025-08-14 08:45'
  },
  {
    id: 'SB001',
    name: 'Storage Box Alpha',
    type: 'storage-box',
    capacity: 81,
    occupied: 45,
    temperature: '-20°C',
    location: 'Freezer B2',
    lastUpdated: '2025-08-14 07:15'
  },
  {
    id: 'FR001',
    name: 'Freezer Rack 1A',
    type: 'freezer-rack',
    capacity: 25,
    occupied: 18,
    temperature: '-80°C',
    location: 'Ultra-Low Freezer',
    lastUpdated: '2025-08-14 06:00'
  }
];

export function StorageDashboard() {
  const [selectedContainer, setSelectedContainer] = useState<StorageContainer | null>(null);

  const getContainerIcon = (type: string) => {
    switch (type) {
      case 'tube-rack': return <TestTube className="w-5 h-5" />;
      case 'microplate': return <Grid3x3 className="w-5 h-5" />;
      case 'storage-box': return <Box className="w-5 h-5" />;
      case 'freezer-rack': return <Thermometer className="w-5 h-5" />;
      default: return <Box className="w-5 h-5" />;
    }
  };

  const getOccupancyColor = (occupied: number, capacity: number) => {
    const percentage = (occupied / capacity) * 100;
    if (percentage >= 90) return 'destructive';
    if (percentage >= 75) return 'secondary';
    return 'default';
  };

  const renderContainerView = (container: StorageContainer) => {
    switch (container.type) {
      case 'tube-rack':
        return <TubeRack container={container} />;
      case 'microplate':
        return <MicroPlate container={container} />;
      case 'storage-box':
        return <StorageBox container={container} />;
      case 'freezer-rack':
        return <FreezerRack container={container} />;
      default:
        return <div>Unknown container type</div>;
    }
  };

  if (selectedContainer) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {getContainerIcon(selectedContainer.type)}
            <div>
              <h1>{selectedContainer.name}</h1>
              <p className="text-muted-foreground">
                {selectedContainer.location} • Last updated: {selectedContainer.lastUpdated}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setSelectedContainer(null)}>
            Back to Dashboard
          </Button>
        </div>
        {renderContainerView(selectedContainer)}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1>Clinical Lab Storage Management</h1>
        <p className="text-muted-foreground">
          Manage and track samples across different storage containers
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {mockContainers.map((container) => (
          <Card 
            key={container.id} 
            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedContainer(container)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {getContainerIcon(container.type)}
                <span className="font-medium">{container.name}</span>
              </div>
              {container.temperature && (
                <Badge variant="outline" className="text-xs">
                  {container.temperature}
                </Badge>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Occupancy</span>
                <Badge variant={getOccupancyColor(container.occupied, container.capacity)}>
                  {container.occupied}/{container.capacity}
                </Badge>
              </div>
              
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(container.occupied / container.capacity) * 100}%` }}
                />
              </div>
              
              <div className="text-xs text-muted-foreground">
                {container.location}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}