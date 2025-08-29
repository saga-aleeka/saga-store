import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card } from './ui/card';
import { Switch } from './ui/switch';
import { GraduationCap, Archive } from 'lucide-react';
import { ContainerType, SampleType, getGridDimensions, getContainerTypeLabel } from './PlasmaContainerList';

interface CreateContainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateContainer: (container: {
    name: string;
    location: string;
    containerType: ContainerType;
    temperature: string;
    sampleType: SampleType;
    totalSlots: number;
    isTraining?: boolean;
    isArchived?: boolean;
  }) => void;
}

// Helper function to detect container type from sample type
const detectContainerTypeFromSampleType = (sampleType: SampleType): ContainerType => {
  switch (sampleType) {
    case 'Plasma Tubes':
      return '5x5-box';
    case 'IDT Plates':
      return '7x14-rack';
    case 'DP Pools':
    case 'cfDNA Tubes':
    case 'DTC Tubes':
    case 'MNC Tubes':
    case 'PA Pool Tubes':
    case 'BC Tubes':
    default:
      return '9x9-box';
  }
};

export function CreateContainerDialog({ open, onOpenChange, onCreateContainer }: CreateContainerDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    containerType: '9x9-box' as ContainerType,
    temperature: '-80°C',
    sampleType: 'DP Pools' as SampleType,
    isTraining: false,
    isArchived: false
  });

  const containerTypes: ContainerType[] = ['9x9-box', '5x5-box', '5x4-rack', '9x9-rack', '7x14-rack'];
  const sampleTypes: SampleType[] = ['DP Pools', 'cfDNA Tubes', 'DTC Tubes', 'MNC Tubes', 'PA Pool Tubes', 'Plasma Tubes', 'BC Tubes', 'IDT Plates'];

  // Handle sample type change and auto-update container type
  const handleSampleTypeChange = (value: SampleType) => {
    const recommendedContainerType = detectContainerTypeFromSampleType(value);
    setFormData({ 
      ...formData, 
      sampleType: value,
      containerType: recommendedContainerType
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.location.trim()) {
      alert('Please fill in all required fields (Name and Location)');
      return;
    }

    const dimensions = getGridDimensions(formData.containerType, formData.sampleType);
    
    onCreateContainer({
      ...formData,
      totalSlots: dimensions.total
    });
    
    // Reset form
    setFormData({
      name: '',
      location: '',
      containerType: '9x9-box',
      temperature: '-80°C',
      sampleType: 'DP Pools',
      isTraining: false,
      isArchived: false
    });
    
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reset form
    setFormData({
      name: '',
      location: '',
      containerType: '9x9-box',
      temperature: '-80°C',
      sampleType: 'DP Pools',
      isTraining: false,
      isArchived: false
    });
    onOpenChange(false);
  };

  const selectedDimensions = getGridDimensions(formData.containerType, formData.sampleType);
  const recommendedContainerType = detectContainerTypeFromSampleType(formData.sampleType);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Create New Container
            {formData.isArchived && (
              <span className="text-xs bg-archive text-archive-foreground px-2 py-1 rounded flex items-center gap-1">
                <Archive className="w-3 h-3" />
                Archived
              </span>
            )}
            {formData.isTraining && (
              <span className="text-xs bg-training text-training-foreground px-2 py-1 rounded flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                Training
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            Create a new plasma storage container. Choose the appropriate container type based on your sample requirements.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 pb-20">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Container Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Plasma Box Alpha"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., Freezer A - Rack 1"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="archive-mode" className="flex items-center gap-2">
                      <Archive className="w-4 h-4 text-archive" />
                      Archive Container
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Create this container in the archive (for long-term storage)
                    </p>
                  </div>
                  <Switch
                    id="archive-mode"
                    checked={formData.isArchived}
                    onCheckedChange={(checked) => setFormData({ ...formData, isArchived: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="training-mode" className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-training" />
                      Training Container
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Mark this container as a training container (highlighted in orange)
                    </p>
                  </div>
                  <Switch
                    id="training-mode"
                    checked={formData.isTraining}
                    onCheckedChange={(checked) => setFormData({ ...formData, isTraining: checked })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="sampleType">Sample Type</Label>
                <Select
                  value={formData.sampleType}
                  onValueChange={handleSampleTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sampleTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  🤖 Recommended container type: {getContainerTypeLabel(recommendedContainerType)}
                </p>
              </div>

              <div>
                <Label htmlFor="containerType">Container Type</Label>
                <Select
                  value={formData.containerType}
                  onValueChange={(value) => setFormData({ ...formData, containerType: value as ContainerType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {containerTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {getContainerTypeLabel(type)}
                        {type === recommendedContainerType && (
                          <span className="text-green-600 ml-2">🤖 Recommended</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="temperature">Storage Temperature</Label>
                <Select
                  value={formData.temperature}
                  onValueChange={(value) => setFormData({ ...formData, temperature: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-80°C">-80°C (Ultra-low freezer)</SelectItem>
                    <SelectItem value="-20°C">-20°C (Standard freezer)</SelectItem>
                    <SelectItem value="4°C">4°C (Refrigerator)</SelectItem>
                    <SelectItem value="RT">RT (Room temperature)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Container Preview */}
            <Card className={`p-4 ${
              formData.isArchived
                ? 'border-archive-border bg-archive-background'
                : formData.isTraining
                ? 'border-training-border bg-training-background'
                : ''
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <h4>Container Preview</h4>
                {formData.isArchived && (
                  <span className="text-xs bg-archive text-archive-foreground px-2 py-1 rounded flex items-center gap-1">
                    <Archive className="w-3 h-3" />
                    Archived
                  </span>
                )}
                {formData.isTraining && (
                  <span className="text-xs bg-training text-training-foreground px-2 py-1 rounded flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" />
                    Training
                  </span>
                )}
                {formData.containerType === recommendedContainerType && (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                    🤖 Recommended
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Type:</span>
                  <span>{getContainerTypeLabel(formData.containerType)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Grid Size:</span>
                  <span>{selectedDimensions.rows}×{selectedDimensions.cols}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Capacity:</span>
                  <span>{selectedDimensions.total} positions</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Sample Type:</span>
                  <span>{formData.sampleType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Temperature:</span>
                  <span>{formData.temperature}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Purpose:</span>
                  <span className={formData.isArchived ? 'text-archive' : formData.isTraining ? 'text-training' : ''}>
                    {formData.isArchived 
                      ? 'Archived Container' 
                      : formData.isTraining 
                      ? 'Training Container' 
                      : 'Production Container'}
                  </span>
                </div>
              </div>

              {/* Mini grid preview */}
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-2">Grid Layout Preview:</div>
                <div className="flex flex-col gap-1" style={{ maxWidth: 'fit-content' }}>
                  {Array.from({ length: Math.min(selectedDimensions.rows, 5) }, (_, row) => (
                    <div key={row} className="flex gap-1">
                      {Array.from({ length: Math.min(selectedDimensions.cols, 5) }, (_, col) => (
                        <div
                          key={col}
                          className={`w-3 h-3 border rounded-sm ${
                            formData.isArchived
                              ? 'bg-archive-background border-archive-border'
                              : formData.isTraining 
                              ? 'bg-training-background border-training-border' 
                              : 'bg-gray-200 border-gray-300'
                          }`}
                        />
                      ))}
                      {selectedDimensions.cols > 5 && (
                        <div className="flex items-center text-xs text-muted-foreground ml-1">
                          ...
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedDimensions.rows > 5 && (
                    <div className="text-xs text-muted-foreground text-center">...</div>
                  )}
                </div>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6">
              <Button type="button" variant="outline" onClick={handleCancel} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Create Container
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}