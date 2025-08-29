import React, { useState, useEffect, useMemo } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Thermometer, ArrowLeft, Plus, Search, Filter, Settings, MoreVertical, TestTube, GraduationCap, Archive } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { PlasmaBoxDashboard } from './PlasmaBoxDashboard';
import { CreateContainerDialog } from './CreateContainerDialog';
import { EditContainerDialog } from './EditContainerDialog';
import { SampleSearchResults, PlasmaSample } from './SampleSearchResults';
import { WorklistUpload } from './WorklistUpload';
import { WorklistResults } from './WorklistResults';
import { BulkSampleSearch } from './BulkSampleSearch';
import { SamplesTab } from './SamplesTab';
import { ContainerCard } from './ContainerCard';
import { Header } from './Header';

export type ContainerType = '9x9-box' | '5x5-box' | '5x4-rack' | '9x9-rack' | '7x14-rack';
export type SampleType = 'DP Pools' | 'cfDNA Tubes' | 'DTC Tubes' | 'MNC Tubes' | 'PA Pool Tubes' | 'Plasma Tubes' | 'BC Tubes' | 'IDT Plates';

export interface PlasmaContainer {
  id: string;
  name: string;
  location: string;
  occupiedSlots: number;
  totalSlots: number;
  lastUpdated: string;
  temperature: string;
  containerType: ContainerType;
  sampleType: SampleType;
  isTraining?: boolean;
  isArchived?: boolean; // New field for archival containers
}

export const getGridDimensions = (containerType: ContainerType, sampleType?: SampleType) => {
  switch (containerType) {
    case '9x9-box': 
      // DP Pools come in sets of 4 (A,B,C,D), so effective capacity is 80 instead of 81
      return { rows: 9, cols: 9, total: sampleType === 'DP Pools' ? 80 : 81 };
    case '5x5-box': return { rows: 5, cols: 5, total: 25 };
    case '5x4-rack': return { rows: 5, cols: 4, total: 20 };
    case '9x9-rack': 
      // DP Pools come in sets of 4 (A,B,C,D), so effective capacity is 80 instead of 81
      return { rows: 9, cols: 9, total: sampleType === 'DP Pools' ? 80 : 81 };
    case '7x14-rack': return { rows: 14, cols: 7, total: 98 };
    default: return { rows: 5, cols: 5, total: 25 };
  }
};

export const getContainerTypeLabel = (containerType: ContainerType) => {
  switch (containerType) {
    case '9x9-box': return '9×9 Box';
    case '5x5-box': return '5×5 Box';
    case '5x4-rack': return '5×4 Rack';
    case '9x9-rack': return '9×9 Rack';
    case '7x14-rack': return '7×14 Rack';
    default: return 'Unknown';
  }
};

export const getSampleTypeColor = (sampleType: SampleType) => {
  switch (sampleType) {
    case 'DP Pools': return 'bg-green-100 text-green-800 border-green-200';
    case 'cfDNA Tubes': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'DTC Tubes': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'MNC Tubes': return 'bg-red-100 text-red-800 border-red-200';
    case 'PA Pool Tubes': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Plasma Tubes': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'BC Tubes': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'IDT Plates': return 'bg-teal-100 text-teal-800 border-teal-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const SAMPLE_TYPES: SampleType[] = ['DP Pools', 'cfDNA Tubes', 'DTC Tubes', 'MNC Tubes', 'PA Pool Tubes', 'Plasma Tubes', 'BC Tubes', 'IDT Plates'];

interface PlasmaContainerListProps {
  containers?: PlasmaContainer[];
  onContainersChange?: (containers: PlasmaContainer[]) => void;
}

export function PlasmaContainerList({ containers: propsContainers, onContainersChange: propsOnContainersChange }: PlasmaContainerListProps = {}) {
  const [localContainers, setLocalContainers] = useState<PlasmaContainer[]>([]);
  const STORAGE_KEY = 'plasma-containers';
  
  // Debug logging
  console.log('PlasmaContainerList props:', { 
    propsContainers: propsContainers?.length, 
    propsOnContainersChange: typeof propsOnContainersChange 
  });
  
  // Use props if provided, otherwise use local state
  const containers = propsContainers ?? localContainers;
  const onContainersChange = propsOnContainersChange ?? setLocalContainers;

  // Load containers from localStorage if using local state
  useEffect(() => {
    if (!propsContainers) {
      const savedContainers = localStorage.getItem(STORAGE_KEY);
      if (savedContainers) {
        try {
          const parsedContainers = JSON.parse(savedContainers);
          if (Array.isArray(parsedContainers)) {
            setLocalContainers(parsedContainers);
          }
        } catch (error) {
          console.error('Error loading containers:', error);
        }
      }
    }
  }, [propsContainers]);

  // Auto-save containers if using local state
  useEffect(() => {
    if (!propsContainers && localContainers.length >= 0) {
      const timeoutId = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localContainers));
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [localContainers, propsContainers]);

  const [selectedContainer, setSelectedContainer] = useState<PlasmaContainer | null>(null);
  const [selectedSampleForView, setSelectedSampleForView] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [containerToEdit, setContainerToEdit] = useState<PlasmaContainer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sampleSearchQuery, setSampleSearchQuery] = useState('');
  const [selectedSampleType, setSelectedSampleType] = useState<SampleType | null>(null);
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [showTrainingOnly, setShowTrainingOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'containers' | 'archive' | 'samples'>('containers');
  const [worklistSampleIds, setWorklistSampleIds] = useState<string[]>([]);
  const [worklistDuplicateIds, setWorklistDuplicateIds] = useState<string[]>([]);
  const [sampleSearchMode, setSampleSearchMode] = useState<'manual' | 'worklist' | 'bulk'>('manual');
  const [manualSearchSampleIds, setManualSearchSampleIds] = useState<string[]>([]);
  const [bulkSearchSampleIds, setBulkSearchSampleIds] = useState<string[]>([]);

  // Separate active and archived containers
  const activeContainers = useMemo(() => containers.filter(container => !container.isArchived), [containers]);
  const archivedContainers = useMemo(() => containers.filter(container => container.isArchived), [containers]);

  // Get containers to display based on active tab
  const containersToFilter = useMemo(() => {
    return activeTab === 'archive' ? archivedContainers : activeContainers;
  }, [activeTab, activeContainers, archivedContainers]);

  // Filter and search containers
  const filteredContainers = useMemo(() => {
    return containersToFilter.filter(container => {
      const matchesSearch = searchQuery === '' || 
        container.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        container.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        container.location.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSampleType = selectedSampleType === null || 
        container.sampleType === selectedSampleType;
      
      // Calculate effective total slots dynamically based on sample type
      const effectiveTotalSlots = getGridDimensions(container.containerType, container.sampleType).total;
      const hasAvailableSlots = !showAvailableOnly || 
        container.occupiedSlots < effectiveTotalSlots;

      const matchesTraining = !showTrainingOnly || container.isTraining === true;
      
      return matchesSearch && matchesSampleType && hasAvailableSlots && matchesTraining;
    });
  }, [containersToFilter, searchQuery, selectedSampleType, showAvailableOnly, showTrainingOnly]);

  // Load all samples from all containers (including archived for search)
  const allSamples = useMemo(() => {
    const samples: Array<{ sample: PlasmaSample; container: PlasmaContainer }> = [];
    
    containers.forEach(container => {
      const storageKey = `samples-${container.id}`;
      const savedSamples = localStorage.getItem(storageKey);
      
      if (savedSamples) {
        try {
          const parsedData = JSON.parse(savedSamples);
          
          // Convert from admin import format {position: {id, timestamp}} to PlasmaSample format
          if (typeof parsedData === 'object' && !Array.isArray(parsedData)) {
            Object.entries(parsedData).forEach(([position, data]: [string, any]) => {
              const sample: PlasmaSample = {
                position,
                sampleId: data.id,
                storageDate: data.timestamp ? data.timestamp.split('T')[0] : new Date().toISOString().split('T')[0],
                lastAccessed: data.lastAccessed,
                history: data.history || [{
                  timestamp: data.timestamp || new Date().toISOString(),
                  action: 'check-in',
                  notes: `Initial storage in position ${position}`
                }]
              };
              samples.push({ sample, container });
            });
          } else if (Array.isArray(parsedData)) {
            parsedData.forEach((sample: any) => {
              const sampleWithHistory = {
                ...sample,
                history: sample.history || [{
                  timestamp: sample.storageDate ? `${sample.storageDate}T00:00:00.000Z` : new Date().toISOString(),
                  action: 'check-in' as const,
                  notes: `Initial storage in position ${sample.position}`
                }]
              };
              samples.push({ sample: sampleWithHistory, container });
            });
          }
        } catch (error) {
          console.error(`Error loading samples for container ${container.id}:`, error);
        }
      }
    });
    
    return samples;
  }, [containers]);

  // Filter samples based on search query or worklist
  const filteredSamples = useMemo(() => {
    if (sampleSearchMode === 'worklist') {
      if (worklistSampleIds.length === 0) return [];
      
      return allSamples.filter(({ sample }) => 
        worklistSampleIds.includes(sample.sampleId)
      );
    } else if (sampleSearchMode === 'bulk') {
      if (bulkSearchSampleIds.length === 0) return [];
      
      return allSamples.filter(({ sample }) => 
        bulkSearchSampleIds.includes(sample.sampleId)
      );
    } else {
      if (!sampleSearchQuery.trim()) {
        // Clear manual search sample IDs when no search query
        setManualSearchSampleIds([]);
        return [];
      }
      
      // Split the search query by commas and trim whitespace
      const searchTerms = sampleSearchQuery.split(',').map(term => term.trim().toLowerCase()).filter(term => term.length > 0);
      
      const results = allSamples.filter(({ sample, container }) => {
        // Check if any search term matches the sample
        return searchTerms.some(query => {
          return (
            sample.sampleId.toLowerCase().includes(query) ||
            sample.position.toLowerCase().includes(query) ||
            container.name.toLowerCase().includes(query) ||
            container.location.toLowerCase().includes(query) ||
            container.id.toLowerCase().includes(query) ||
            container.sampleType.toLowerCase().includes(query)
          );
        });
      });
      
      // Update manual search sample IDs for highlighting
      const sampleIds = results.map(({ sample }) => sample.sampleId);
      setManualSearchSampleIds(sampleIds);
      
      return results;
    }
  }, [allSamples, sampleSearchQuery, sampleSearchMode, worklistSampleIds, bulkSearchSampleIds]);

  const getOccupancyColor = (occupied: number, total: number) => {
    const percentage = (occupied / total) * 100;
    if (percentage === 100) return 'destructive';
    if (percentage >= 80) return 'secondary';
    return 'default';
  };

  const getOccupancyStatus = (occupied: number, total: number) => {
    const percentage = (occupied / total) * 100;
    if (percentage === 100) return 'Full';
    if (percentage >= 80) return 'Nearly Full';
    if (percentage >= 50) return 'Half Full';
    return 'Available';
  };

  const handleCreateContainer = (newContainer: Omit<PlasmaContainer, 'id' | 'occupiedSlots' | 'lastUpdated'>) => {
    const id = `PB${String(containers.length + 1).padStart(3, '0')}`;
    const totalSlots = getGridDimensions(newContainer.containerType, newContainer.sampleType).total;
    const container: PlasmaContainer = {
      ...newContainer,
      id,
      occupiedSlots: 0,
      totalSlots,
      lastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };
    onContainersChange([...containers, container]);
  };

  const handleContainerUpdate = (updatedContainer: PlasmaContainer) => {
    console.log('handleContainerUpdate called with:', updatedContainer);
    console.log('onContainersChange type:', typeof onContainersChange);
    
    if (typeof onContainersChange !== 'function') {
      console.error('onContainersChange is not a function:', onContainersChange);
      return;
    }
    
    const updatedContainers = containers.map(container => 
      container.id === updatedContainer.id ? updatedContainer : container
    );
    
    console.log('Calling onContainersChange with:', updatedContainers);
    onContainersChange(updatedContainers);
  };

  const handleEditContainer = (container: PlasmaContainer) => {
    setContainerToEdit(container);
    setIsEditDialogOpen(true);
  };

  const handleEditDialogClose = () => {
    setIsEditDialogOpen(false);
    setContainerToEdit(null);
  };

  const handleNavigateToSample = (containerId: string, sampleId: string) => {
    const container = containers.find(c => c.id === containerId);
    if (container) {
      setSelectedContainer(container);
      setSelectedSampleForView(sampleId);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSampleSearchQuery('');
    setSelectedSampleType(null);
  };

  const clearContainerFilters = () => {
    setSearchQuery('');
    setSelectedSampleType(null);
    setShowAvailableOnly(false);
    setShowTrainingOnly(false);
  };

  const clearSampleFilters = () => {
    setSampleSearchQuery('');
    setWorklistSampleIds([]);
    setWorklistDuplicateIds([]);
    setManualSearchSampleIds([]);
    setBulkSearchSampleIds([]);
    setSampleSearchMode('manual');
  };

  const handleWorklistSamplesExtracted = (sampleIds: string[], duplicateIds: string[] = []) => {
    setWorklistSampleIds(sampleIds);
    setWorklistDuplicateIds(duplicateIds);
    if (sampleIds.length > 0) {
      setSampleSearchMode('worklist');
      setSampleSearchQuery(''); // Clear manual search when using worklist
      setManualSearchSampleIds([]); // Clear manual search sample IDs
    } else {
      setSampleSearchMode('manual');
    }
  };

  const handleClearWorklist = () => {
    setWorklistSampleIds([]);
    setWorklistDuplicateIds([]);
    setSampleSearchMode('manual');
  };

  // Handle bulk search from CSV upload
  const handleBulkSearchFromCSV = (sampleIds: string[]) => {
    setBulkSearchSampleIds(sampleIds);
    if (sampleIds.length > 0) {
      setSampleSearchMode('bulk');
      setSampleSearchQuery(''); // Clear manual search
      setWorklistSampleIds([]); // Clear worklist
      setManualSearchSampleIds([]); // Clear manual search sample IDs
    } else {
      setSampleSearchMode('manual');
    }
  };

  // Total sample count
  const totalSampleCount = allSamples.length;

  if (selectedContainer) {
    return (
      <div className="h-screen flex flex-col">
        <div className="p-6 border-b">
          <Header 
            actions={
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedContainer(null)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Containers
                </Button>
                {selectedContainer.isArchived && (
                  <Badge className="text-xs bg-archive text-archive-foreground">
                    <Archive className="w-3 h-3 mr-1" />
                    Archived
                  </Badge>
                )}
                {selectedContainer.isTraining && (
                  <Badge className="text-xs bg-training text-training-foreground">
                    <GraduationCap className="w-3 h-3 mr-1" />
                    Training
                  </Badge>
                )}
                <Badge 
                  className={`text-xs ${getSampleTypeColor(selectedContainer.sampleType)}`}
                >
                  {selectedContainer.sampleType}
                </Badge>
                <Badge variant="outline">
                  Last Updated: {selectedContainer.lastUpdated}
                </Badge>
              </>
            }
          />
        </div>
        <div className="flex-1">
          <PlasmaBoxDashboard 
            container={selectedContainer} 
            onContainerUpdate={handleContainerUpdate}
            initialSelectedSample={selectedSampleForView}
            onSampleSelectionHandled={() => setSelectedSampleForView(null)}
            highlightSampleIds={
              sampleSearchMode === 'worklist' ? worklistSampleIds : 
              sampleSearchMode === 'bulk' ? bulkSearchSampleIds : 
              manualSearchSampleIds
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Header 
        actions={
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create New Container
          </Button>
        }
      />

      {/* Dialogs */}
      <CreateContainerDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateContainer={handleCreateContainer}
      />
      
      <EditContainerDialog
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogClose}
        container={containerToEdit}
        onUpdateContainer={handleContainerUpdate}
        key={containerToEdit?.id} // Force re-render when container changes
      />

      {/* Main Content with Tabs */}
      {containers.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground">
            <Thermometer className="w-16 h-16 mx-auto mb-6 opacity-30" />
            <h3 className="mb-3">Welcome to Plasma Storage Management</h3>
            <p className="text-sm mb-6 max-w-md mx-auto">
              Get started by creating your first storage container. You can organize different sample types 
              including DP Pools, cfDNA Tubes, DTC Tubes, MNC Tubes, PA Pool Tubes, Plasma Tubes, BC Tubes, and IDT Plates.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Container
            </Button>
          </div>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'containers' | 'archive' | 'samples')}>
          <TabsList className="grid w-full grid-cols-3 max-w-lg mb-6">
            <TabsTrigger value="containers" className="flex items-center gap-2">
              <Thermometer className="w-4 h-4" />
              Containers ({activeContainers.length})
            </TabsTrigger>
            <TabsTrigger value="archive" className="flex items-center gap-2">
              <Archive className="w-4 h-4" />
              Archive ({archivedContainers.length})
            </TabsTrigger>
            <TabsTrigger value="samples" className="flex items-center gap-2">
              <TestTube className="w-4 h-4" />
              Samples ({totalSampleCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="containers" className="space-y-6">
            {/* Container Search and Filter Controls */}
            <Card className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search active containers by ID, name, or location..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Filter by sample type:</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedSampleType === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSampleType(null)}
                  >
                    All Types
                  </Button>
                  {SAMPLE_TYPES.map((sampleType) => (
                    <Button
                      key={sampleType}
                      variant={selectedSampleType === sampleType ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSampleType(sampleType)}
                      className={selectedSampleType === sampleType ? '' : getSampleTypeColor(sampleType)}
                    >
                      {sampleType}
                    </Button>
                  ))}
                  
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-sm text-muted-foreground">•</span>
                    <Button
                      variant={showAvailableOnly ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowAvailableOnly(!showAvailableOnly)}
                      className="flex items-center gap-2"
                    >
                      Available Slots Only
                    </Button>
                    
                    <Button
                      variant={showTrainingOnly ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowTrainingOnly(!showTrainingOnly)}
                      className="flex items-center gap-2"
                      style={showTrainingOnly ? { 
                        backgroundColor: 'var(--training)', 
                        color: 'var(--training-foreground)',
                        borderColor: 'var(--training)'
                      } : {}}
                    >
                      <GraduationCap className="w-4 h-4" />
                      Training Only
                    </Button>
                  </div>
                  
                  {(searchQuery || selectedSampleType || showAvailableOnly || showTrainingOnly) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearContainerFilters}
                      className="text-muted-foreground"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Container Results Summary */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filteredContainers.length} of {activeContainers.length} active containers
                {searchQuery && ` matching "${searchQuery}"`}
                {selectedSampleType && ` filtered by ${selectedSampleType}`}
                {showAvailableOnly && ` with available slots`}
                {showTrainingOnly && ` marked as training`}
              </p>
            </div>

            {/* Container Grid */}
            {filteredContainers.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="text-muted-foreground">
                  <Thermometer className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <h3 className="mb-2">No active containers found</h3>
                  <p className="text-sm">
                    {activeContainers.length === 0 
                      ? "No active containers available. Try creating a new container or check the Archive tab."
                      : "Try adjusting your search or filter criteria"}
                  </p>
                  <Button variant="outline" size="sm" onClick={clearContainerFilters} className="mt-4">
                    Clear Filters
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredContainers.map((container) => (
                  <ContainerCard
                    key={container.id}
                    container={container}
                    onSelect={setSelectedContainer}
                    onEdit={handleEditContainer}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="archive" className="space-y-6">
            {/* Archive Search and Filter Controls */}
            <Card className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search archived containers by ID, name, or location..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Filter by sample type:</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedSampleType === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSampleType(null)}
                  >
                    All Types
                  </Button>
                  {SAMPLE_TYPES.map((sampleType) => (
                    <Button
                      key={sampleType}
                      variant={selectedSampleType === sampleType ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSampleType(sampleType)}
                      className={selectedSampleType === sampleType ? '' : getSampleTypeColor(sampleType)}
                    >
                      {sampleType}
                    </Button>
                  ))}
                  
                  {(searchQuery || selectedSampleType) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedSampleType(null);
                      }}
                      className="text-muted-foreground ml-4"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Archive Results Summary */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filteredContainers.length} of {archivedContainers.length} archived containers
                {searchQuery && ` matching "${searchQuery}"`}
                {selectedSampleType && ` filtered by ${selectedSampleType}`}
              </p>
            </div>

            {/* Archive Grid */}
            {filteredContainers.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="text-muted-foreground">
                  <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <h3 className="mb-2">No archived containers found</h3>
                  <p className="text-sm">
                    {archivedContainers.length === 0 
                      ? "No archived containers available."
                      : "Try adjusting your search or filter criteria"}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setSelectedSampleType(null); }} className="mt-4">
                    Clear Filters
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredContainers.map((container) => (
                  <ContainerCard
                    key={container.id}
                    container={container}
                    onSelect={setSelectedContainer}
                    onEdit={handleEditContainer}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="samples" className="space-y-6">
            <SamplesTab
              sampleSearchQuery={sampleSearchQuery}
              setSampleSearchQuery={setSampleSearchQuery}
              sampleSearchMode={sampleSearchMode}
              setSampleSearchMode={setSampleSearchMode}
              worklistSampleIds={worklistSampleIds}
              worklistDuplicateIds={worklistDuplicateIds}
              filteredSamples={filteredSamples}
              allSamples={allSamples}
              clearSampleFilters={clearSampleFilters}
              handleWorklistSamplesExtracted={handleWorklistSamplesExtracted}
              handleClearWorklist={handleClearWorklist}
              handleNavigateToSample={handleNavigateToSample}
              onBulkSearchFromCSV={handleBulkSearchFromCSV}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}