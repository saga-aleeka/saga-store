import React, { useState, useEffect } from 'react';
import { Sheet } from './ui/sheet';
import { Title } from './ui/Title'; // Ensure the correct casing and path
import { SheetHeader } from './ui/sheetHeader'; // Ensure the correct import path for SheetHeader
import { SheetContent } from './ui/sheetContent'; // Ensure the correct import path for SheetContent
import { Button } from './ui/button'; // Ensure this path points to the correct Button component
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Switch } from './ui/switch';
import { AlertTriangle, GraduationCap, Archive } from 'lucide-react';
import { PlasmaContainer, ContainerType, SampleType, getGridDimensions, getContainerTypeLabel } from './PlasmaContainerList';

interface EditContainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: PlasmaContainer | null;
  onUpdateContainer: (container: PlasmaContainer) => void;
}

// Helper function to detect container type from sample type (matches admin logic)
const detectContainerTypeFromSampleType = (sampleType: SampleType): ContainerType => {
  switch (sampleType) {
    case 'Plasma Tubes':
      return '5x5-box';
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

export function EditContainerDialog({ open, onOpenChange, container, onUpdateContainer }: EditContainerDialogProps) {
  // Defensive: ensure container is always an object or null
  if (container === undefined) container = null;

  // Debug logging for props
  console.log('EditContainerDialog received props:', {
    open,
    container: container?.id,
    onUpdateContainer: typeof onUpdateContainer
  });

  // Defensive: fallback values for formData
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    containerType: '9x9-box' as ContainerType,
    temperature: '-80°C',
    sampleType: 'DP Pools' as SampleType,
    isTraining: false,
    isArchived: false
  });

  // Defensive: ensure containerTypes and sampleTypes are arrays
  const containerTypes: ContainerType[] = ['9x9-box', '5x5-box', '5x4-rack', '9x9-rack'];
  const sampleTypes: SampleType[] = ['DP Pools', 'cfDNA Tubes', 'DTC Tubes', 'MNC Tubes', 'PA Pool Tubes', 'Plasma Tubes', 'BC Tubes'];

  // Defensive: only update form if container is not null
  useEffect(() => {
    if (container) {
      setFormData({
        name: container.name ?? '',
        location: container.location ?? '',
        containerType: container.containerType ?? '9x9-box',
        temperature: container.temperature ?? '-80°C',
        sampleType: container.sampleType ?? 'DP Pools',
        isTraining: container.isTraining || false,
        isArchived: container.isArchived || false
      });
      setShowContainerTypeWarning(false);
    }
  }, [container]);

  // Handle sample type change and auto-update container type
  const handleSampleTypeChange = (value: SampleType) => {
    const recommendedContainerType = detectContainerTypeFromSampleType(value);
    const currentContainerType = formData.containerType;
    
    setFormData({ 
      ...formData, 
      sampleType: value,
      containerType: recommendedContainerType
    });

    // Show warning if changing from different container type with samples
    if (container && container.occupiedSlots > 0 && currentContainerType !== recommendedContainerType) {
      setShowContainerTypeWarning(true);
    } else {
      setShowContainerTypeWarning(false);
    }
  };

  // Handle manual container type change
  const handleContainerTypeChange = (value: ContainerType) => {
    setFormData({ ...formData, containerType: value });
    
    // Show warning if changing container type with samples
    if (container && container.occupiedSlots > 0 && container.containerType !== value) {
      setShowContainerTypeWarning(true);
    } else {
      setShowContainerTypeWarning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.location.trim() || !container) {
      alert('Please fill in all required fields (Name and Location)');
      return;
    }

    // Defensive: check onUpdateContainer
    if (typeof onUpdateContainer !== 'function') {
      alert('Error: Unable to save changes. Please try closing and reopening this dialog.');
      return;
    }

    // Defensive: getGridDimensions fallback
    const dimensions = getGridDimensions(formData.containerType) ?? { total: 0, rows: 0, cols: 0 };

    const updatedContainer: PlasmaContainer = {
      ...container,
      name: formData.name,
      location: formData.location,
      containerType: formData.containerType,
      temperature: formData.temperature,
      sampleType: formData.sampleType,
      isTraining: formData.isTraining,
      isArchived: formData.isArchived,
      totalSlots: dimensions.total,
      lastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };

    try {
      onUpdateContainer(updatedContainer);
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating container:', error);
      alert('Error: Failed to save changes. Please try again.');
    }
  };

  // Defensive: handleCancel only runs if container exists
  const handleCancel = () => {
    if (container) {
      setFormData({
        name: container.name ?? '',
        location: container.location ?? '',
        containerType: container.containerType ?? '9x9-box',
        temperature: container.temperature ?? '-80°C',
        sampleType: container.sampleType ?? 'DP Pools',
        isTraining: container.isTraining || false,
        isArchived: container.isArchived || false
      });
    }
    setShowContainerTypeWarning(false);
    onOpenChange(false);
  };

  // Defensive: don't render if container is null
  if (!container) return null;

  // Defensive: getGridDimensions fallback
  const selectedDimensions = getGridDimensions(formData.containerType) ?? { rows: 0, cols: 0, total: 0 };
  const recommendedContainerType = detectContainerTypeFromSampleType(formData.sampleType);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto">
          <Title className="flex items-center gap-2">
          <SheetTitle className="flex items-center gap-2">
            Edit Container: {container.name}
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
          <p className="text-sm text-muted-foreground">
            Update the container settings. Be careful when changing container type if samples are already stored.
          </p>
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
                      Move this container to the archive (for long-term storage)
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
                  onValueChange={handleContainerTypeChange}
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

            {/* Warning for container type changes */}
            {showContainerTypeWarning && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This container has {container.occupiedSlots} samples. 
                  Changing the container type may affect sample positions and grid layout.
                </AlertDescription>
              </Alert>
            )}

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
                {container.containerType !== formData.containerType && (
                  <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                    ⚠️ Type Changed
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
                  <span>Current Samples:</span>
                  <span>{container.occupiedSlots} samples</span>
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
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
const [showContainerTypeWarning, setShowContainerTypeWarning] = useState(false);
