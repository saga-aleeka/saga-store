import React, { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { StorageContainer } from './StorageDashboard';

interface Sample {
  id: string;
  position: string;
  sampleId: string;
  patientId: string;
  sampleType: string;
  status: 'active' | 'processing' | 'completed' | 'expired';
  dateCollected: string;
  volume?: string;
}

const mockSamples: Sample[] = [
  { id: '1', position: 'A1', sampleId: 'S001', patientId: 'P12345', sampleType: 'Blood', status: 'active', dateCollected: '2025-08-14', volume: '5ml' },
  { id: '2', position: 'A2', sampleId: 'S002', patientId: 'P12346', sampleType: 'Urine', status: 'processing', dateCollected: '2025-08-14', volume: '10ml' },
  { id: '3', position: 'A3', sampleId: 'S003', patientId: 'P12347', sampleType: 'Blood', status: 'completed', dateCollected: '2025-08-13', volume: '3ml' },
  { id: '4', position: 'B1', sampleId: 'S004', patientId: 'P12348', sampleType: 'Serum', status: 'expired', dateCollected: '2025-08-10', volume: '2ml' },
];

interface TubeRackProps {
  container: StorageContainer;
}

export function TubeRack({ container }: TubeRackProps) {
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'processing': return 'bg-blue-500';
      case 'completed': return 'bg-gray-500';
      case 'expired': return 'bg-red-500';
      default: return 'bg-gray-200';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'processing': return 'secondary';
      case 'completed': return 'outline';
      case 'expired': return 'destructive';
      default: return 'outline';
    }
  };

  const generateGrid = () => {
    const rows = 8;
    const cols = 12;
    const positions = [];
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const position = `${String.fromCharCode(65 + row)}${col + 1}`;
        const sample = mockSamples.find(s => s.position === position);
        positions.push({ position, sample });
      }
    }
    
    return positions;
  };

  const positions = generateGrid();

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2>Container Overview</h2>
          <div className="flex gap-2">
            <Badge variant="outline">{container.occupied}/{container.capacity} positions</Badge>
            <Badge variant="outline">{container.temperature}</Badge>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span>Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span>Processing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span>Expired</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 border-2 border-gray-300 rounded-full"></div>
            <span>Empty</span>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-4">Tube Rack Grid</h3>
        
        <div className="flex flex-col gap-1">
          <div className="flex gap-1 mb-2">
            <div className="w-8 h-8"></div>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="w-8 h-8 flex items-center justify-center text-xs font-medium">
                {i + 1}
              </div>
            ))}
          </div>
          
          {Array.from({ length: 8 }, (_, row) => (
            <div key={row} className="flex gap-1">
              <div className="w-8 h-8 flex items-center justify-center text-xs font-medium">
                {String.fromCharCode(65 + row)}
              </div>
              {Array.from({ length: 12 }, (_, col) => {
                const position = `${String.fromCharCode(65 + row)}${col + 1}`;
                const positionData = positions.find(p => p.position === position);
                const sample = positionData?.sample;
                
                return (
                  <div
                    key={position}
                    className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-all duration-200 hover:scale-110 ${
                      sample 
                        ? `${getStatusColor(sample.status)} border-gray-300` 
                        : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                    } ${selectedPosition === position ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => {
                      setSelectedPosition(position);
                      if (sample) {
                        setSelectedSample(sample);
                      }
                    }}
                    title={sample ? `${sample.sampleId} - ${sample.sampleType}` : `Empty position ${position}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={!!selectedSample} onOpenChange={() => setSelectedSample(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sample Details - Position {selectedSample?.position}</DialogTitle>
          </DialogHeader>
          {selectedSample && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <Badge variant={getStatusBadgeVariant(selectedSample.status)}>
                  {selectedSample.status.charAt(0).toUpperCase() + selectedSample.status.slice(1)}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Sample ID</label>
                  <p>{selectedSample.sampleId}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Patient ID</label>
                  <p>{selectedSample.patientId}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Sample Type</label>
                  <p>{selectedSample.sampleType}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Volume</label>
                  <p>{selectedSample.volume}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Date Collected</label>
                  <p>{selectedSample.dateCollected}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Position</label>
                  <p>{selectedSample.position}</p>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm">Edit Sample</Button>
                <Button variant="outline" size="sm">Move Sample</Button>
                <Button variant="destructive" size="sm">Remove Sample</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}