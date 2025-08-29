import React, { useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Thermometer, AlertTriangle } from 'lucide-react';
import { StorageContainer } from './StorageDashboard';

interface FreezerSlot {
  position: string;
  sampleId?: string;
  patientId?: string;
  sampleType?: string;
  freezeDate?: string;
  thawCycles?: number;
  status: 'frozen' | 'critical' | 'thawed' | 'empty';
  temperature?: number;
  volume?: string;
}

const mockFreezerSlots: FreezerSlot[] = [
  { position: 'A1', sampleId: 'CRY001', patientId: 'P12345', sampleType: 'Plasma', freezeDate: '2025-08-01', thawCycles: 0, status: 'frozen', temperature: -79.5, volume: '2ml' },
  { position: 'A2', sampleId: 'CRY002', patientId: 'P12346', sampleType: 'Serum', freezeDate: '2025-07-28', thawCycles: 1, status: 'frozen', temperature: -79.2, volume: '1ml' },
  { position: 'B1', sampleId: 'CRY003', patientId: 'P12347', sampleType: 'Tissue', freezeDate: '2025-08-05', thawCycles: 0, status: 'critical', temperature: -75.3, volume: '500μl' },
  { position: 'C1', sampleId: 'CRY004', patientId: 'P12348', sampleType: 'Cells', freezeDate: '2025-08-10', thawCycles: 2, status: 'thawed', temperature: -65.1, volume: '1.5ml' },
];

interface FreezerRackProps {
  container: StorageContainer;
}

export function FreezerRack({ container }: FreezerRackProps) {
  const [selectedSlot, setSelectedSlot] = useState<FreezerSlot | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  const getSlotColor = (slot: FreezerSlot) => {
    switch (slot.status) {
      case 'frozen':
        return 'bg-blue-600';
      case 'critical':
        return 'bg-orange-500';
      case 'thawed':
        return 'bg-red-600';
      case 'empty':
        return 'bg-gray-100';
      default:
        return 'bg-gray-100';
    }
  };

  const generateRackGrid = () => {
    const rows = 5;
    const cols = 5;
    const slots = [];
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const position = `${String.fromCharCode(65 + row)}${col + 1}`;
        const slotData = mockFreezerSlots.find(slot => slot.position === position);
        const slot: FreezerSlot = slotData || { position, status: 'empty' };
        slots.push(slot);
      }
    }
    
    return slots;
  };

  const slots = generateRackGrid();

  const getTemperatureStatus = (temp?: number) => {
    if (!temp) return null;
    if (temp > -70) return 'critical';
    if (temp > -75) return 'warning';
    return 'normal';
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Thermometer className="w-5 h-5" />
            <h2>Ultra-Low Freezer Rack</h2>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{container.occupied}/{container.capacity} slots</Badge>
            <Badge variant="outline">{container.temperature}</Badge>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded"></div>
            <span>Properly Frozen</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span>Temperature Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded"></div>
            <span>Thawed/Compromised</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
            <span>Empty</span>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-4">Freezer Rack Grid (5×5)</h3>
        
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 mb-2">
            <div className="w-12 h-12"></div>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="w-12 h-12 flex items-center justify-center text-xs font-medium">
                {i + 1}
              </div>
            ))}
          </div>
          
          {Array.from({ length: 5 }, (_, row) => (
            <div key={row} className="flex gap-2">
              <div className="w-12 h-12 flex items-center justify-center text-xs font-medium">
                {String.fromCharCode(65 + row)}
              </div>
              {Array.from({ length: 5 }, (_, col) => {
                const position = `${String.fromCharCode(65 + row)}${col + 1}`;
                const slot = slots.find(slot => slot.position === position);
                const tempStatus = getTemperatureStatus(slot?.temperature);
                
                return (
                  <div
                    key={position}
                    className={`w-12 h-12 rounded border-2 cursor-pointer transition-all duration-200 hover:scale-105 relative ${
                      getSlotColor(slot!)
                    } ${selectedPosition === position ? 'ring-2 ring-primary' : ''} border-gray-300 flex items-center justify-center`}
                    onClick={() => {
                      setSelectedPosition(position);
                      setSelectedSlot(slot!);
                    }}
                    title={slot?.sampleId ? `${slot.sampleId} - ${slot.sampleType} (${slot.temperature}°C)` : `Empty slot ${position}`}
                  >
                    {slot?.status === 'critical' && (
                      <AlertTriangle className="w-4 h-4 text-white" />
                    )}
                    {slot?.thawCycles && slot.thawCycles > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full text-xs flex items-center justify-center text-black font-bold">
                        {slot.thawCycles}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={!!selectedSlot} onOpenChange={() => setSelectedSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Freezer Slot - {selectedSlot?.position}</DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <div className="flex gap-2">
                  <Badge variant={selectedSlot.status === 'critical' || selectedSlot.status === 'thawed' ? 'destructive' : 'default'}>
                    {selectedSlot.status.charAt(0).toUpperCase() + selectedSlot.status.slice(1)}
                  </Badge>
                  {selectedSlot.temperature && (
                    <Badge variant={getTemperatureStatus(selectedSlot.temperature) === 'critical' ? 'destructive' : 'outline'}>
                      {selectedSlot.temperature}°C
                    </Badge>
                  )}
                </div>
              </div>
              
              {selectedSlot.status !== 'empty' && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedSlot.sampleId && (
                    <div>
                      <label className="text-sm text-muted-foreground">Sample ID</label>
                      <p>{selectedSlot.sampleId}</p>
                    </div>
                  )}
                  {selectedSlot.patientId && (
                    <div>
                      <label className="text-sm text-muted-foreground">Patient ID</label>
                      <p>{selectedSlot.patientId}</p>
                    </div>
                  )}
                  {selectedSlot.sampleType && (
                    <div>
                      <label className="text-sm text-muted-foreground">Sample Type</label>
                      <p>{selectedSlot.sampleType}</p>
                    </div>
                  )}
                  {selectedSlot.volume && (
                    <div>
                      <label className="text-sm text-muted-foreground">Volume</label>
                      <p>{selectedSlot.volume}</p>
                    </div>
                  )}
                  {selectedSlot.freezeDate && (
                    <div>
                      <label className="text-sm text-muted-foreground">Freeze Date</label>
                      <p>{selectedSlot.freezeDate}</p>
                    </div>
                  )}
                  {selectedSlot.thawCycles !== undefined && (
                    <div>
                      <label className="text-sm text-muted-foreground">Thaw Cycles</label>
                      <div className="flex items-center gap-2">
                        <p>{selectedSlot.thawCycles}</p>
                        {selectedSlot.thawCycles > 1 && (
                          <Badge variant="secondary" className="text-xs">High Usage</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {selectedSlot.status === 'critical' && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                  <div className="flex items-center gap-2 text-orange-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Temperature Alert</span>
                  </div>
                  <p className="text-sm text-orange-700 mt-1">
                    Sample temperature is above optimal freezing range. Immediate attention required.
                  </p>
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm">Edit Sample</Button>
                <Button variant="outline" size="sm">Temperature Log</Button>
                {selectedSlot.status !== 'empty' && (
                  <Button variant="destructive" size="sm">Remove Sample</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}