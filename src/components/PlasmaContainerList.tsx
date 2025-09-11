
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
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
import { ScrollArea } from './ui/scroll-area';

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
  history?: Array<{
    timestamp: string;
    action: string;
    user: string;
    containerName: string;
    notes?: string;
    state?: PlasmaContainer;
  }>;
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
  // Example: get current user (replace with your actual logic)
  // Get current user from localStorage, context, or props (replace with your actual logic)
  const currentUser = localStorage.getItem('currentUser') || 'Lab User';
  // Use props if provided, otherwise use local state

  // Manual backup logic for admin
  const handleManualBackup = () => {
    const today = new Date().toISOString().slice(0, 10);
    const backupKey = `nightly-backup-${today}`;
    const containersToBackup = Array.isArray(containers) ? containers : [];
    const backupData = containersToBackup.map(container => {
      const storageKey = `samples-${container.id}`;
      const savedSamples = localStorage.getItem(storageKey);
      return {
        container,
        samples: savedSamples ? JSON.parse(savedSamples) : []
      };
    });
    localStorage.setItem(backupKey, JSON.stringify(backupData));
    alert('Manual backup completed. This will be overwritten at the next 2am snapshot.');
  };

  // Download snapshot as JSON
  const handleDownloadSnapshot = () => {
    const today = new Date().toISOString().slice(0, 10);
    const backupKey = `nightly-backup-${today}`;
    const backupDataRaw = localStorage.getItem(backupKey);
    if (!backupDataRaw) {
      alert('No snapshot found for today.');
      return;
    }
    const blob = new Blob([backupDataRaw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshot-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  // Local state for containers if not provided by props
  const [localContainers, setLocalContainers] = useState([]);
  const STORAGE_KEY = 'plasma-containers';

  // Use props if provided, otherwise use local state
  const containers = Array.isArray(propsContainers) ? propsContainers : (Array.isArray(localContainers) ? localContainers : []);
  const onContainersChange = typeof propsOnContainersChange === 'function' ? propsOnContainersChange : setLocalContainers;

  // Nightly backup logic (2am Eastern Time, overwrite previous)
  React.useEffect(() => {
    function getEasternTimeDate() {
      const now = new Date();
      const utcOffset = -5; // hours
      const eastern = new Date(now.getTime() + utcOffset * 60 * 60 * 1000);
      return eastern;
    }

    function scheduleNightlyBackup() {
      const easternNow = getEasternTimeDate();
      const today = easternNow.toISOString().slice(0, 10);
      const backupKey = `nightly-backup-${today}`;

      const next2am = new Date(easternNow);
      next2am.setHours(2, 0, 0, 0);
      if (easternNow > next2am) {
        next2am.setDate(next2am.getDate() + 1);
      }
      const msUntil2am = next2am.getTime() - easternNow.getTime();

      const timer = setTimeout(() => {
        const containersToBackup = Array.isArray(propsContainers) ? propsContainers : localContainers;
        const backupData = (Array.isArray(containersToBackup) ? containersToBackup : []).map(container => {
          const storageKey = `samples-${container.id}`;
          const savedSamples = localStorage.getItem(storageKey);
          return {
            container,
            samples: savedSamples ? JSON.parse(savedSamples) : []
          };
        });
        localStorage.setItem(backupKey, JSON.stringify(backupData));
        scheduleNightlyBackup();
      }, msUntil2am);
      return () => clearTimeout(timer);
    }

    const cancel = scheduleNightlyBackup();
    return cancel;
  }, [propsContainers, localContainers]);

  // Revert container to last nightly backup
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [containerIdToRevert, setContainerIdToRevert] = useState<string | null>(null);

  const handleRevertContainer = (containerId: string) => {
    setContainerIdToRevert(containerId);
    setRevertDialogOpen(true);
  };

  const confirmRevertContainer = () => {
    if (!containerIdToRevert) return;
    const today = new Date().toISOString().slice(0, 10);
    const backupKey = `nightly-backup-${today}`;
    const backupDataRaw = localStorage.getItem(backupKey);
    if (!backupDataRaw) {
      alert('No nightly backup found for today.');
      setRevertDialogOpen(false);
      return;
    }
    const backupData = JSON.parse(backupDataRaw);
    const containerBackup = backupData.find((b: any) => b.container.id === containerIdToRevert);
    if (!containerBackup) {
      alert('No backup found for this container.');
      setRevertDialogOpen(false);
      return;
    }
    // Restore samples for this container
    const storageKey = `samples-${containerIdToRevert}`;
    localStorage.setItem(storageKey, JSON.stringify(containerBackup.samples));
    setRevertDialogOpen(false);
    alert('Container reverted to last nightly save. Please refresh to see changes.');
  };

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
    if (!propsContainers && Array.isArray(localContainers)) {
      const timeoutId = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localContainers));
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [localContainers, propsContainers]);

  const [selectedContainer, setSelectedContainer] = useState(null);
  const [selectedSampleForView, setSelectedSampleForView] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [containerToEdit, setContainerToEdit] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sampleSearchQuery, setSampleSearchQuery] = useState('');
  const [selectedSampleType, setSelectedSampleType] = useState(null);
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [showTrainingOnly, setShowTrainingOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('containers');
  const [worklistSampleIds, setWorklistSampleIds] = useState([]);
  const [worklistDuplicateIds, setWorklistDuplicateIds] = useState([]);
  const [sampleSearchMode, setSampleSearchMode] = useState('manual');
  const [manualSearchSampleIds, setManualSearchSampleIds] = useState([]);
  const [bulkSearchSampleIds, setBulkSearchSampleIds] = useState([]);

  // Separate active and archived containers
  const activeContainers = useMemo(() => (Array.isArray(containers) ? containers : []).filter(container => !container.isArchived), [containers]);
  const archivedContainers = useMemo(() => (Array.isArray(containers) ? containers : []).filter(container => container.isArchived), [containers]);

  const containersToFilter = useMemo(() => {
    return activeTab === 'archive' ? archivedContainers : activeContainers;
  }, [activeTab, activeContainers, archivedContainers]);

  const filteredContainers = useMemo(() => {
    return (Array.isArray(containersToFilter) ? containersToFilter : []).filter(container => {
      const matchesSearch = searchQuery === '' ||
        container.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        container.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        container.location?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSampleType = selectedSampleType === null ||
        container.sampleType === selectedSampleType;

      const effectiveTotalSlots = getGridDimensions(container.containerType, container.sampleType).total;
      const hasAvailableSlots = !showAvailableOnly ||
        container.occupiedSlots < effectiveTotalSlots;

      const matchesTraining = !showTrainingOnly || container.isTraining === true;

      return matchesSearch && matchesSampleType && hasAvailableSlots && matchesTraining;
    });
  }, [containersToFilter, searchQuery, selectedSampleType, showAvailableOnly, showTrainingOnly]);

  // Defensive: always arrays
  const allSamples = useMemo(() => {
    const samples: Array<{ sample: PlasmaSample; container: PlasmaContainer }> = [];
    (Array.isArray(containers) ? containers : []).forEach(container => {
      const storageKey = `samples-${container.id}`;
      const savedSamples = localStorage.getItem(storageKey);

      if (savedSamples) {
        try {
          const parsedData = JSON.parse(savedSamples);

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

  // Defensive: always arrays
  const filteredSamples = useMemo(() => {
    if (sampleSearchMode === 'worklist') {
      if (!Array.isArray(worklistSampleIds) || worklistSampleIds.length === 0) return [];
      return (Array.isArray(allSamples) ? allSamples : []).filter(({ sample }) =>
        (Array.isArray(worklistSampleIds) ? worklistSampleIds : []).includes(sample.sampleId)
      );
    } else if (sampleSearchMode === 'bulk') {
      if (!Array.isArray(bulkSearchSampleIds) || bulkSearchSampleIds.length === 0) return [];
      return (Array.isArray(allSamples) ? allSamples : []).filter(({ sample }) =>
        (Array.isArray(bulkSearchSampleIds) ? bulkSearchSampleIds : []).includes(sample.sampleId)
      );
    } else {
      if (!sampleSearchQuery.trim()) {
        setManualSearchSampleIds([]);
        return [];
      }
      const searchTerms = sampleSearchQuery.split(',').map(term => term.trim().toLowerCase()).filter(term => term.length > 0);
      const results = (Array.isArray(allSamples) ? allSamples : []).filter(({ sample, container }) => {
        return searchTerms.some(query => {
          return (
            sample.sampleId?.toLowerCase().includes(query) ||
            sample.position?.toLowerCase().includes(query) ||
            container.name?.toLowerCase().includes(query) ||
            container.location?.toLowerCase().includes(query) ||
            container.id?.toLowerCase().includes(query) ||
            container.sampleType?.toLowerCase().includes(query)
          );
        });
      });
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
    // Add audit trail entry with container name and user
    const now = new Date().toISOString();
    const auditEntry = {
      timestamp: now,
      action: 'edit',
      user: currentUser,
      containerName: updatedContainer.name,
      notes: 'Container edited',
      state: { ...updatedContainer }
    };
    let updatedHistory = Array.isArray(updatedContainer.history) ? [...updatedContainer.history] : [];
    updatedHistory.push(auditEntry);
    const containerWithAudit = {
      ...updatedContainer,
      history: updatedHistory
    };
    if (typeof onContainersChange !== 'function') {
      console.error('onContainersChange is not a function:', onContainersChange);
      return;
    }
    const updatedContainers = containers.map(container =>
      container.id === updatedContainer.id ? containerWithAudit : container
    );
    onContainersChange(updatedContainers);
  };
  // Audit trail UI state
  const [selectedAuditIndex, setSelectedAuditIndex] = useState<number | null>(null);

  // Render audit trail for selected container
  const renderAuditTrail = (container: PlasmaContainer) => {
    if (!container.history || container.history.length === 0) return <p className="text-muted-foreground">No audit history.</p>;
    return (
      <Card className="p-4 mb-4">
        <h4 className="mb-2">Audit Trail</h4>
        <ul className="mb-4">
          {container.history.map((entry, idx) => (
            <li key={idx} className={`mb-2 p-2 rounded ${selectedAuditIndex === idx ? 'bg-gray-100' : ''}`}>
              <button
                className="w-full text-left"
                onClick={() => setSelectedAuditIndex(idx)}
              >
                <span className="font-semibold">{entry.action}</span> by <span className="text-blue-700">{entry.user}</span> on <span className="text-xs">{new Date(entry.timestamp).toLocaleString()}</span> (<span className="text-green-700">{entry.containerName}</span>)
              </button>
              {selectedAuditIndex === idx && (
                <div className="mt-2">
                  <pre className="bg-gray-50 p-2 text-xs rounded border">{JSON.stringify(entry.state, null, 2)}</pre>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => handleRevertToAudit(container, idx)}>
                    Revert to this audit
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    );
  };

  // Revert container to a specific audit entry
  const handleRevertToAudit = (container: PlasmaContainer, auditIdx: number) => {
    if (!container.history || !container.history[auditIdx]) return;
    const auditState = container.history[auditIdx].state;
    // Defensive: preserve audit history up to this point
    const revertedHistory = container.history.slice(0, auditIdx + 1);
    const revertedContainer = {
      ...auditState,
      history: revertedHistory
    };
    if (typeof onContainersChange !== 'function') return;
    const updatedContainers = containers.map(c =>
      c.id === container.id ? revertedContainer : c
    );
    onContainersChange(updatedContainers);
    alert(`Reverted to audit entry #${auditIdx + 1} for container '${container.name}'.`);
    setSelectedAuditIndex(null);
  };

  // ...existing code...
  // Remove the inner handleEditContainer and related inner render logic
  // Helper to get today's nightly snapshot
  const getTodayNightlySnapshot = () => {
    const today = new Date().toISOString().slice(0, 10);
    const backupKey = `nightly-backup-${today}`;
    const backupDataRaw = localStorage.getItem(backupKey);
    if (!backupDataRaw) return [];
    try {
      return JSON.parse(backupDataRaw);
    } catch {
      return [];
    }
  };

  // Render admin nightly snapshot
  const renderAdminNightlySnapshot = () => {
    const todaySnapshot = getTodayNightlySnapshot();
    return (
      <Card className="p-4 mb-6">
        <h3 className="mb-2">Nightly Snapshot (2am ET)</h3>
        <div className="flex gap-2 mb-4">
          <Button size="sm" variant="outline" onClick={handleManualBackup}>Manual Backup</Button>
          <Button size="sm" variant="outline" onClick={handleDownloadSnapshot}>Download Snapshot</Button>
        </div>
        {todaySnapshot.length === 0 ? (
          <p className="text-muted-foreground">No snapshot found for today.</p>
        ) : (
          <div>
            {todaySnapshot.map(({ container, samples }) => (
              <Card key={container.id} className="mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4>{container.name}</h4>
                    <p className="text-xs text-muted-foreground">Location: {container.location}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleRevertContainer(container.id)}>
                    Revert to Last Nightly Save
                  </Button>
                </div>
                {/* ...other container details... */}
              </Card>
            ))}
          </div>
        )}
      </Card>
    );
  };

  // Render container card
  const renderContainerCard = (container) => (
    <Card key={container.id} className="mb-4">
      <div className="flex justify-between items-center">
        <div>
          <h4>{container.name}</h4>
          <p className="text-xs text-muted-foreground">Location: {container.location}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => handleRevertContainer(container.id)}>
          Revert to Last Nightly Save
        </Button>
      </div>
      {/* ...other container details... */}
    </Card>
  );
  // Main page edit handler for container
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

  const handleWorklistSamplesExtracted = (sampleIds: string[] = [], duplicateIds: string[] = []) => {
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
        <div className="p-6">
          <div className="flex items-center mb-4">
            <Header />
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => setSelectedContainer(null)} className="ml-auto">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Containers
            </Button>
          </div>
          <div className="flex gap-2 mt-4">
            <Badge variant="outline">{selectedContainer.sampleType}</Badge>
            <Badge variant="outline">Last Updated: {selectedContainer.lastUpdated}</Badge>
          </div>
          {/* Audit Trail UI */}
          {renderAuditTrail(selectedContainer)}
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
        {/* Revert Confirmation Dialog */}
        <Dialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revert Container?</DialogTitle>
              <DialogDescription>
                This will restore the container's samples to the last nightly backup. This action cannot be undone.<br />
                Are you sure you want to revert?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevertDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmRevertContainer}>Revert</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Header 
        actions={(
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create New Container
          </Button>
        )}
      />

      {/* Dialogs */}
      <CreateContainerDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateContainer={handleCreateContainer}
      />
      
      {containerToEdit && (
        <EditContainerDialog
          open={isEditDialogOpen}
          onOpenChange={handleEditDialogClose}
          container={containerToEdit}
          onUpdateContainer={handleContainerUpdate}
        />
      )}

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
            {/* @ts-ignore: Button is a function component, not a constructor */}
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
                    {/* @ts-ignore: Input is a function component, not a constructor */}
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
                  <div key={container.id}>
                    <ContainerCard
                      container={container}
                      onSelect={setSelectedContainer}
                      onEdit={handleEditContainer}
                    />
                  </div>
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
                    {/* @ts-ignore: Input is a function component, not a constructor */}
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
                  <div key={container.id}>
                    <ContainerCard
                      container={container}
                      onSelect={setSelectedContainer}
                      onEdit={handleEditContainer}
                    />
                  </div>
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