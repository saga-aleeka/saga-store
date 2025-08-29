import React, { useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { StorageContainer } from './StorageDashboard';

interface StoredItem {
  position: string;
  sampleId?: string;
  patientId?: string;
  sampleType?: string;
  storageDate?: string;
  expiryDate?: string;
  status: 'stored' | 'expired' | 'quarantine' | 'empty';
  priority?: 'high' | 'medium' | 'low';
}

const mockStoredItems: StoredItem[] = [
  { position: 'A1', sampleId: 'DNA001', patientId: 'P12345', sampleType: 'DNA Extract', storageDate: '2025-08-10', expiryDate: '2026-08-10', status: 'stored', priority: 'high' },
  { position: 'A2', sampleId: 'RNA002', patientId: 'P12346', sampleType: 'RNA Extract', storageDate: '2025-08-12', expiryDate: '2025-12-12', status: 'stored', priority: 'medium' },
  { position: 'A3', sampleId: 'PRT003', patientId: 'P12347', sampleType: 'Protein', storageDate: '2025-07-15', expiryDate: '2025-07-30', status: 'expired', priority: 'low' },
  { position: 'B1', sampleId: 'QUA004', patientId: 'P12348', sampleType: 'Serum', storageDate: '2025-08-13', expiryDate: '2026-02-13', status: 'quarantine', priority: 'high' },
];

interface StorageBoxProps {
  container: StorageContainer;
}

export function StorageBox({ container }: StorageBoxProps) {
  const [selectedItem, setSelectedItem] = useState<StoredItem | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  const getItemColor = (item: StoredItem) => {
    switch (item.status) {
      case 'stored':
        if (item.priority === 'high') return 'bg-blue-600';
        if (item.priority === 'medium') return 'bg-blue-400';
        return 'bg-blue-300';
      case 'expired':
        return 'bg-red-500';
      case 'quarantine':
        return 'bg-yellow-500';
      case 'empty':
        return 'bg-gray-100';
      default:
        return 'bg-gray-100';
    }
  };

  const generateBoxGrid = () => {
    const rows = 9;
    const cols = 9;
    const items = [];
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const position = `${String.fromCharCode(65 + row)}${col + 1}`;
        const itemData = mockStoredItems.find(item => item.position === position);
        const item: StoredItem = itemData || { position, status: 'empty' };
        items.push(item);
      }
    }
    
    return items;
  };

  const items = generateBoxGrid();

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2>Storage Box Overview</h2>
          <div className="flex gap-2">
            <Badge variant="outline">{container.occupied}/{container.capacity} positions</Badge>
            <Badge variant="outline">{container.temperature}</Badge>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded"></div>
            <span>High Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-400 rounded"></div>
            <span>Medium Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-300 rounded"></div>
            <span>Low Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>Quarantine</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Expired</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
            <span>Empty</span>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-4">9×9 Storage Grid</h3>
        
        <div className="flex flex-col gap-1">
          <div className="flex gap-1 mb-2">
            <div className="w-8 h-8"></div>
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="w-8 h-8 flex items-center justify-center text-xs font-medium">
                {i + 1}
              </div>
            ))}
          </div>
          
          {Array.from({ length: 9 }, (_, row) => (
            <div key={row} className="flex gap-1">
              <div className="w-8 h-8 flex items-center justify-center text-xs font-medium">
                {String.fromCharCode(65 + row)}
              </div>
              {Array.from({ length: 9 }, (_, col) => {
                const position = `${String.fromCharCode(65 + row)}${col + 1}`;
                const item = items.find(item => item.position === position);
                const expiringSoon = item && isExpiringSoon(item.expiryDate);
                
                return (
                  <div
                    key={position}
                    className={`w-8 h-8 rounded border-2 cursor-pointer transition-all duration-200 hover:scale-110 relative ${
                      getItemColor(item!)
                    } ${selectedPosition === position ? 'ring-2 ring-primary' : ''} ${
                      expiringSoon ? 'border-orange-400' : 'border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedPosition(position);
                      setSelectedItem(item!);
                    }}
                    title={item?.sampleId ? `${item.sampleId} - ${item.sampleType}` : `Empty position ${position}`}
                  >
                    {expiringSoon && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full text-xs flex items-center justify-center text-white">
                        !
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Storage Position - {selectedItem?.position}</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <div className="flex gap-2">
                  <Badge variant={selectedItem.status === 'expired' ? 'destructive' : 
                                 selectedItem.status === 'quarantine' ? 'secondary' : 'default'}>
                    {selectedItem.status.charAt(0).toUpperCase() + selectedItem.status.slice(1)}
                  </Badge>
                  {selectedItem.priority && (
                    <Badge variant="outline">
                      {selectedItem.priority.charAt(0).toUpperCase() + selectedItem.priority.slice(1)} Priority
                    </Badge>
                  )}
                </div>
              </div>
              
              {selectedItem.status !== 'empty' && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedItem.sampleId && (
                    <div>
                      <label className="text-sm text-muted-foreground">Sample ID</label>
                      <p>{selectedItem.sampleId}</p>
                    </div>
                  )}
                  {selectedItem.patientId && (
                    <div>
                      <label className="text-sm text-muted-foreground">Patient ID</label>
                      <p>{selectedItem.patientId}</p>
                    </div>
                  )}
                  {selectedItem.sampleType && (
                    <div>
                      <label className="text-sm text-muted-foreground">Sample Type</label>
                      <p>{selectedItem.sampleType}</p>
                    </div>
                  )}
                  {selectedItem.storageDate && (
                    <div>
                      <label className="text-sm text-muted-foreground">Storage Date</label>
                      <p>{selectedItem.storageDate}</p>
                    </div>
                  )}
                  {selectedItem.expiryDate && (
                    <div>
                      <label className="text-sm text-muted-foreground">Expiry Date</label>
                      <div className="flex items-center gap-2">
                        <p>{selectedItem.expiryDate}</p>
                        {isExpiringSoon(selectedItem.expiryDate) && (
                          <Badge variant="secondary" className="text-xs">Expires Soon</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm">Edit Sample</Button>
                <Button variant="outline" size="sm">Move Sample</Button>
                {selectedItem.status !== 'empty' && (
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