import React, { useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { StorageContainer } from './StorageDashboard';

interface Well {
  position: string;
  sampleId?: string;
  concentration?: string;
  absorbance?: number;
  status: 'sample' | 'control' | 'blank' | 'empty';
  result?: 'positive' | 'negative' | 'inconclusive';
}

const mockWells: Well[] = [
  { position: 'A1', sampleId: 'S001', concentration: '100μg/ml', absorbance: 0.85, status: 'sample', result: 'positive' },
  { position: 'A2', sampleId: 'S002', concentration: '50μg/ml', absorbance: 0.42, status: 'sample', result: 'negative' },
  { position: 'A3', sampleId: 'S003', concentration: '200μg/ml', absorbance: 1.23, status: 'sample', result: 'positive' },
  { position: 'H1', concentration: '0μg/ml', absorbance: 0.05, status: 'blank' },
  { position: 'H2', sampleId: 'PC001', concentration: '150μg/ml', absorbance: 0.95, status: 'control', result: 'positive' },
  { position: 'H3', sampleId: 'NC001', concentration: '0μg/ml', absorbance: 0.08, status: 'control', result: 'negative' },
];

interface MicroPlateProps {
  container: StorageContainer;
}

export function MicroPlate({ container }: MicroPlateProps) {
  const [selectedWell, setSelectedWell] = useState<Well | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  const getWellColor = (well: Well) => {
    if (well.status === 'empty') return 'bg-gray-100';
    
    switch (well.status) {
      case 'sample':
        if (well.result === 'positive') return 'bg-red-400';
        if (well.result === 'negative') return 'bg-green-400';
        if (well.result === 'inconclusive') return 'bg-yellow-400';
        return 'bg-blue-400';
      case 'control':
        return 'bg-purple-400';
      case 'blank':
        return 'bg-gray-300';
      default:
        return 'bg-gray-100';
    }
  };

  const generatePlateGrid = () => {
    const rows = 8;
    const cols = 12;
    const wells = [];
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const position = `${String.fromCharCode(65 + row)}${col + 1}`;
        const wellData = mockWells.find(w => w.position === position);
        const well: Well = wellData || { position, status: 'empty' };
        wells.push(well);
      }
    }
    
    return wells;
  };

  const wells = generatePlateGrid();

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2>Microplate Overview</h2>
          <div className="flex gap-2">
            <Badge variant="outline">{container.occupied}/{container.capacity} wells</Badge>
            <Badge variant="outline">{container.temperature}</Badge>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-400 rounded"></div>
            <span>Sample</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-400 rounded"></div>
            <span>Control</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 rounded"></div>
            <span>Blank</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-400 rounded"></div>
            <span>Positive</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-400 rounded"></div>
            <span>Negative</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
            <span>Empty</span>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-4">96-Well Plate</h3>
        
        <div className="flex flex-col gap-1">
          <div className="flex gap-1 mb-2">
            <div className="w-6 h-6"></div>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="w-6 h-6 flex items-center justify-center text-xs font-medium">
                {i + 1}
              </div>
            ))}
          </div>
          
          {Array.from({ length: 8 }, (_, row) => (
            <div key={row} className="flex gap-1">
              <div className="w-6 h-6 flex items-center justify-center text-xs font-medium">
                {String.fromCharCode(65 + row)}
              </div>
              {Array.from({ length: 12 }, (_, col) => {
                const position = `${String.fromCharCode(65 + row)}${col + 1}`;
                const well = wells.find(w => w.position === position);
                
                return (
                  <div
                    key={position}
                    className={`w-6 h-6 rounded border cursor-pointer transition-all duration-200 hover:scale-110 ${
                      getWellColor(well!)
                    } ${selectedPosition === position ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => {
                      setSelectedPosition(position);
                      setSelectedWell(well!);
                    }}
                    title={well?.sampleId ? `${well.sampleId} - ${well.status}` : `${position} - ${well?.status}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={!!selectedWell} onOpenChange={() => setSelectedWell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Well Details - {selectedWell?.position}</DialogTitle>
          </DialogHeader>
          {selectedWell && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <Badge variant="outline">
                  {selectedWell.status.charAt(0).toUpperCase() + selectedWell.status.slice(1)}
                </Badge>
              </div>
              
              {selectedWell.status !== 'empty' && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedWell.sampleId && (
                    <div>
                      <label className="text-sm text-muted-foreground">Sample ID</label>
                      <p>{selectedWell.sampleId}</p>
                    </div>
                  )}
                  {selectedWell.concentration && (
                    <div>
                      <label className="text-sm text-muted-foreground">Concentration</label>
                      <p>{selectedWell.concentration}</p>
                    </div>
                  )}
                  {selectedWell.absorbance !== undefined && (
                    <div>
                      <label className="text-sm text-muted-foreground">Absorbance</label>
                      <p>{selectedWell.absorbance.toFixed(3)}</p>
                    </div>
                  )}
                  {selectedWell.result && (
                    <div>
                      <label className="text-sm text-muted-foreground">Result</label>
                      <Badge variant={selectedWell.result === 'positive' ? 'destructive' : 'default'}>
                        {selectedWell.result.charAt(0).toUpperCase() + selectedWell.result.slice(1)}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm">Edit Well</Button>
                <Button variant="outline" size="sm">Export Data</Button>
                {selectedWell.status !== 'empty' && (
                  <Button variant="destructive" size="sm">Clear Well</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}