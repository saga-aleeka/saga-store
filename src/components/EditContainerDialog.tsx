import { safeTrim } from '../utils/safeString';
import React, { useState, useEffect } from 'react';
import { Sheet, SheetHeader, SheetTitle, SheetContent, SheetDescription } from './ui/sheet';
import { Button } from './ui/button'; // Ensure this path points to the correct Button component
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Switch } from './ui/switch';
import { AlertTriangle, GraduationCap, Archive } from 'lucide-react';
import { PlasmaContainer, ContainerType, SampleType, getContainerTypeLabel, getGridDimensions } from './PlasmaContainerList';

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
  // Sample and container types (should match your app's logic)
  const sampleTypes: SampleType[] = [
    'DP Pools',
    'Plasma Tubes',
    'cfDNA Tubes',
    'DTC Tubes',
    'MNC Tubes',
    'PA Pool Tubes',
    'BC Tubes',
    'IDT Plates'
  ];
  const containerTypes: ContainerType[] = [
    '9x9-box',
    '5x5-box',
    '7x14-rack'
    // Add more valid ContainerType values here if needed
  ];

  // Handlers
  const handleSampleTypeChange = (value: SampleType) => {
    setFormData((prev) => ({ ...prev, sampleType: value }));
  };

  const handleContainerTypeChange = (value: ContainerType) => {
    setFormData((prev) => ({ ...prev, containerType: value }));
    setShowContainerTypeWarning(true);
  };

  const handleCancel = () => {
    setShowContainerTypeWarning(false);
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  // Call the update callback with the new container data
  if (!container?.id) return;
  // Compute and persist totalSlots for the selected type/sampleType
  const dims = getGridDimensions(formData.containerType, formData.sampleType);
  const updated = { ...container, ...formData, id: container.id, totalSlots: dims.total } as PlasmaContainer;
  onUpdateContainer(updated);
  onOpenChange(false);
  };
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
    temperature: '-20°C',
    sampleType: 'DP Pools' as SampleType,
    isTraining: false,
    isArchived: false
  });

  // When the container prop changes, populate the form with the saved values
  useEffect(() => {
    if (!container) return;
    setFormData({
      name: safeTrim(container.name || ''),
      location: safeTrim(container.location || ''),
      containerType: (container.containerType || '9x9-box') as ContainerType,
      temperature: container.temperature || '-20°C',
      sampleType: (container.sampleType || 'DP Pools') as SampleType,
      isTraining: !!container.isTraining,
      isArchived: !!container.isArchived,
    });
    setShowContainerTypeWarning(false);
  }, [container]);

  // Defensive: don't render if container is null
  if (!container) return null;

  // Compute grid dimensions for the selected container type/sample type
  const selectedDimensions = getGridDimensions(formData.containerType, formData.sampleType);
  const recommendedContainerType = detectContainerTypeFromSampleType(formData.sampleType);
  const [showContainerTypeWarning, setShowContainerTypeWarning] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto">
        <SheetHeader>
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

              {/* Orientation note for IDT Plates (7x14 racks) */}
              {formData.sampleType === 'IDT Plates' && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Note: IDT Plates use a 7×14 layout (columns lettered A–G). Rows are numbered 1–14 with 1 at the bottom and 14 at the top.
                </div>
              )}

              {/* Mini grid preview */}
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-2">Grid Layout Preview:</div>
                <div className="flex flex-col gap-1" style={{ maxWidth: 'fit-content' }}>
                  {/* Build labels according to container orientation. For IDT (7x14), columns are letters A..G and rows are numbered 14..1 (top->bottom). */}
                  {(() => {
                    const rows = selectedDimensions.rows;
                    const cols = selectedDimensions.cols;
                    let colLabels: string[] = [];
                    let rowLabels: string[] = [];
                    if (formData.containerType === '7x14-rack') {
                      // columns A.. up to cols
                      colLabels = Array.from({ length: cols }, (_, i) => String.fromCharCode(65 + i));
                      // rows numbered 1..rows but display top-to-bottom descending (rows..1)
                      rowLabels = Array.from({ length: rows }, (_, i) => String(rows - i));
                    } else {
                      // default: rows are letters A.., cols are numbers 1..
                      colLabels = Array.from({ length: cols }, (_, i) => String(i + 1));
                      rowLabels = Array.from({ length: rows }, (_, i) => String.fromCharCode(65 + i));
                    }

                    const displayRows = rowLabels.slice(0, Math.min(rowLabels.length, 5));
                    const displayCols = colLabels.slice(0, Math.min(colLabels.length, 5));

                    return (
                      <div>
                        {/* Column labels */}
                        <div className="flex gap-1 mb-1">
                          <div className="w-4" />
                          {displayCols.map((col) => (
                            <div key={col} className="text-xs text-muted-foreground text-center w-3">
                              {col}
                            </div>
                          ))}
                          {colLabels.length > 5 && <div className="text-xs text-muted-foreground ml-1">...</div>}
                        </div>

                        {/* Grid rows */}
                        {displayRows.map((rowLabel) => (
                          <div key={rowLabel} className="flex items-center gap-1">
                            <div className="text-xs text-muted-foreground w-4 text-right">{rowLabel}</div>
                            {displayCols.map((_, colIdx) => (
                              <div
                                key={colIdx}
                                className={`w-3 h-3 border rounded-sm ${
                                  formData.isArchived
                                    ? 'bg-archive-background border-archive-border'
                                    : formData.isTraining
                                    ? 'bg-training-background border-training-border'
                                    : 'bg-gray-200 border-gray-300'
                                }`}
                              />
                            ))}
                            {colLabels.length > 5 && <div className="text-xs text-muted-foreground ml-1">...</div>}
                          </div>
                        ))}
                        {rowLabels.length > 5 && (
                          <div className="text-xs text-muted-foreground text-center">...</div>
                        )}
                      </div>
                    );
                  })()}
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
// No duplicate Input or Button definitions; ensure only imported ones are used
