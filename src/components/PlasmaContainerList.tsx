
// ...existing code...




import { safeReplace, safeTrim } from '../utils/safeString';
import React, { useState, useEffect, useMemo } from 'react';
import { fetchContainers, upsertContainer, deleteContainer } from '../utils/supabase/containers';
import { fetchSamples } from '../utils/supabase/samples';
import { supabase } from '../utils/supabase/client';
import { saveBackup, getLatestBackup } from '../utils/supabase/backup';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
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
import { getLiveOccupiedSlots } from './getLiveOccupiedSlots';
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
    notes?: string;
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

export const SAMPLE_TYPES: SampleType[] = ['DP Pools', 'cfDNA Tubes', 'DTC Tubes', 'MNC Tubes', 'PA Pool Tubes', 'Plasma Tubes', 'BC Tubes', 'IDT Plates'];

interface PlasmaContainerListProps {
  containers?: PlasmaContainer[];
  onContainersChange?: (containers: PlasmaContainer[]) => void;
}

export function PlasmaContainerList(props: PlasmaContainerListProps) {
  // State to trigger snapshot UI refresh
  const [snapshotRefreshKey, setSnapshotRefreshKey] = useState(0);
  // Example: get current user (replace with your actual logic)
  const currentUser = localStorage.getItem('currentUser') || 'Unknown User';
  // Use props if provided, otherwise use local state

  // Manual backup logic for admin
  const handleManualBackup = async () => {
    const containersToBackup = Array.isArray(containers) ? containers : [];
    try {
      await saveBackup(containersToBackup, currentUser);
      alert('Manual backup completed to Supabase.');
      setSnapshotRefreshKey(k => k + 1); // Only trigger snapshot UI refresh after manual backup
    } catch (error) {
      alert('Failed to save backup to Supabase.');
      console.error(error);
    }
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

  // Local state for containers always from Supabase
  const [containers, setContainers] = useState<PlasmaContainer[]>([]);
  const onContainersChange = typeof props.onContainersChange === 'function' ? props.onContainersChange : setContainers;

  // Debug: log all containers loaded from Supabase
  useEffect(() => {
    if (Array.isArray(containers)) {
      console.log('All containers loaded from Supabase:', containers);
    }
  }, [containers]);

  // Nightly backup logic (2am Eastern Time, overwrite previous)
  React.useEffect(() => {
    // Only schedule nightly backup, do not update snapshot after every edit
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
        // Only perform backup at 2am, not after every edit
        const containersToBackup = Array.isArray(containers) ? containers : [];
        const backupData = (Array.isArray(containersToBackup) ? containersToBackup : []).map(container => {
          const storageKey = `samples-${container.id}`;
          const savedSamples = localStorage.getItem(storageKey);
          return {
            container,
            samples: savedSamples ? JSON.parse(savedSamples) : []
          };
        });
        console.log('[SNAPSHOT] Nightly backup: writing to', backupKey, backupData);
        localStorage.setItem(backupKey, JSON.stringify(backupData));
        // 7-day rolling retention: keep only 7 most recent backups
        const backupKeys = Object.keys(localStorage)
          .filter(k => k.startsWith('nightly-backup-'))
          .sort();
        if (backupKeys.length > 7) {
          const toDelete = backupKeys.slice(0, backupKeys.length - 7);
          toDelete.forEach(k => localStorage.removeItem(k));
          console.log('[SNAPSHOT] Deleted old backups:', toDelete);
        }
  setSnapshotRefreshKey(k => k + 1); // Only trigger snapshot UI refresh after 2am backup
  scheduleNightlyBackup();
      }, msUntil2am);
      return () => clearTimeout(timer);
    }

    const cancel = scheduleNightlyBackup();
    return cancel;
  }, []); // Remove dependencies to avoid running after every edit

  // Revert container to last nightly backup
  const [revertDialogOpen, setRevertDialogOpen] = useState<boolean>(false);
  const [containerIdToRevert, setContainerIdToRevert] = useState<string | null>(null);

  const handleRevertContainer = (containerId: string) => {
    setContainerIdToRevert(containerId);
    setRevertDialogOpen(true);
  };

  const confirmRevertContainer = async () => {
    if (!containerIdToRevert) return;
    try {
      const backup = await getLatestBackup();
      if (!backup || !Array.isArray(backup.data)) {
        alert('No backup found in Supabase.');
        setRevertDialogOpen(false);
        return;
      }
      const containerBackup = backup.data.find((b: any) => b.id === containerIdToRevert || b.container?.id === containerIdToRevert);
      if (!containerBackup) {
        alert('No backup found for this container.');
        setRevertDialogOpen(false);
        return;
      }
      // Restore container in Supabase
      await upsertContainer(containerBackup.container || containerBackup);
      const updated = await fetchContainers();
      setContainers(updated);
      setRevertDialogOpen(false);
      alert('Container reverted to last backup from Supabase.');
    } catch (error) {
      alert('Failed to restore from Supabase backup.');
      setRevertDialogOpen(false);
      console.error(error);
    }
  };

  // Load containers from Supabase if using local state


  useEffect(() => {
    fetchContainers()
      .then(data => {
        if (Array.isArray(data)) setContainers(data);
      })
      .catch(error => {
        console.error('Error loading containers from Supabase:', error);
      });

    // Real-time sync for containers
    const containerSub = supabase.channel('public:containers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'containers' }, (payload: RealtimePostgresChangesPayload<PlasmaContainer>) => {
        fetchContainers().then((data: PlasmaContainer[]) => {
          if (Array.isArray(data)) setContainers(data);
        });
      })
      .subscribe();

    // Real-time sync for samples (optional, for future sample migration)
    // const sampleSub = supabase.channel('public:samples')
    //   .on('postgres_changes', { event: '*', schema: 'public', table: 'samples' }, payload => {
    //     fetchSamples().then(data => {/* update local state if needed */});
    //   })
    //   .subscribe();

    return () => {
      supabase.removeChannel(containerSub);
      // supabase.removeChannel(sampleSub);
    };
  }, []);



  const [selectedContainer, setSelectedContainer] = useState<PlasmaContainer | null>(null);
  const [selectedSampleForView, setSelectedSampleForView] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [containerToEdit, setContainerToEdit] = useState<PlasmaContainer | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sampleSearchQuery, setSampleSearchQuery] = useState<string>('');
  const [selectedSampleType, setSelectedSampleType] = useState<SampleType | null>(null);
  const [showAvailableOnly, setShowAvailableOnly] = useState<boolean>(false);
  const [showTrainingOnly, setShowTrainingOnly] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'containers' | 'archive' | 'samples'>('containers');
  const [worklistSampleIds, setWorklistSampleIds] = useState<string[]>([]);
  const [worklistDuplicateIds, setWorklistDuplicateIds] = useState<string[]>([]);
  const [sampleSearchMode, setSampleSearchMode] = useState<'manual' | 'worklist' | 'bulk'>('manual');
  const [manualSearchSampleIds, setManualSearchSampleIds] = useState<string[]>([]);
  const [bulkSearchSampleIds, setBulkSearchSampleIds] = useState<string[]>([]);

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
      const liveOccupiedSlots = getLiveOccupiedSlots([container]);
      const hasAvailableSlots = !showAvailableOnly ||
        liveOccupiedSlots < effectiveTotalSlots;

      const matchesTraining = !showTrainingOnly || container.isTraining === true;

      return matchesSearch && matchesSampleType && hasAvailableSlots && matchesTraining;
    });
  }, [containersToFilter, searchQuery, selectedSampleType, showAvailableOnly, showTrainingOnly]);

  // Defensive: always arrays
  const [allSamples, setAllSamples] = useState<Array<{ sample: PlasmaSample; container: PlasmaContainer }>>([]);

  useEffect(() => {
    async function loadAllSamples() {
      try {
        const samples = await fetchSamples();
        if (!Array.isArray(containers)) return;
        // Map samples to their containers
        const mapped: Array<{ sample: PlasmaSample; container: PlasmaContainer }> = [];
        for (const container of containers) {
          const containerSamples = samples.filter((s: any) => s.container_id === container.id);
          for (const s of containerSamples) {
            mapped.push({
              sample: {
                position: s.position,
                sampleId: s.sample_id || s.sampleId || s.id,
                storageDate: s.storage_date || s.storageDate || '',
                lastAccessed: s.last_accessed || s.lastAccessed || '',
                history: s.history || []
              },
              container
            });
          }
        }
        setAllSamples(mapped);
      } catch (error) {
        setAllSamples([]);
        console.error('Error loading samples from Supabase:', error);
      }
    }
    loadAllSamples();
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
  if (!safeTrim(sampleSearchQuery)) {
        setManualSearchSampleIds([]);
        return [];
      }
  const searchTerms = sampleSearchQuery.split(',').map(term => safeTrim(term).toLowerCase()).filter(term => term.length > 0);
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

  const handleCreateContainer = async (newContainer: Omit<PlasmaContainer, 'id' | 'occupiedSlots' | 'lastUpdated'>) => {
    // Check for duplicate name before creating
    const allContainers = await fetchContainers();
    if (allContainers.some(c => c.name.trim().toLowerCase() === newContainer.name.trim().toLowerCase())) {
      alert('A container with this name already exists. Please choose a unique name.');
      return;
    }
    // Generate a valid UUID for the id field
    let id: string;
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      id = crypto.randomUUID();
    } else {
      // Fallback simple UUID v4 generator
      id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    // Defensive: ensure containerType is a valid frontend value
    const containerType = newContainer.containerType;
    const totalSlots = getGridDimensions(containerType, newContainer.sampleType).total;
    const now = new Date();
    const container: PlasmaContainer = {
      ...newContainer,
      id,
      containerType,
      occupiedSlots: 0,
      totalSlots,
      lastUpdated: safeReplace(now.toISOString().slice(0, 16), 'T', ' '),
      history: [
        {
          timestamp: now.toISOString(),
          action: 'create',
          user: currentUser,
          notes: 'Container created'
        }
      ]
    };
    // Only send valid fields to Supabase (strip out 'history' and any extra fields)
    const {
      history, // eslint-disable-line @typescript-eslint/no-unused-vars
      ...containerForUpsert
    } = container;
    try {
      await upsertContainer(containerForUpsert);
      const updated = await fetchContainers();
      setContainers(updated);
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      const code = error && typeof error === 'object' ? (error as any).code : undefined;
      const message = error && typeof error === 'object' ? (error as any).message : undefined;
      if (code === '23505' || (typeof message === 'string' && message.includes('unique'))) {
        alert('A container with this name already exists. Please choose a unique name.');
      } else {
        alert('Error creating container in Supabase.');
      }
      console.error('Error creating container in Supabase:', error);
    }
  };

  const handleContainerUpdate = async (updatedContainer: PlasmaContainer) => {
    // Add audit trail entry
    const now = new Date().toISOString();
    const auditEntry = {
      timestamp: now,
      action: 'edit',
      user: currentUser,
      notes: 'Container edited'
    };
    let updatedHistory = Array.isArray(updatedContainer.history) ? [...updatedContainer.history] : [];
    updatedHistory.push(auditEntry);
    const containerWithAudit = {
      ...updatedContainer,
      history: updatedHistory
    };
    // Only send valid fields to Supabase (strip out 'history' and any extra fields)
    const {
      history, // eslint-disable-line @typescript-eslint/no-unused-vars
      ...containerForUpsert
    } = containerWithAudit;
    try {
      await upsertContainer(containerForUpsert);
      const updated = await fetchContainers();
      setContainers(updated);
      setIsEditDialogOpen(false);
      alert('Container updated successfully.');
    } catch (error: any) {
      const code = error && typeof error === 'object' ? (error as any).code : undefined;
      const message = error && typeof error === 'object' ? (error as any).message : undefined;
      if (code === '23505' || (typeof message === 'string' && message.includes('unique'))) {
        alert('A container with this name already exists. Please choose a unique name.');
      } else {
        alert('Error updating container in Supabase.');
      }
      console.error('Error updating container in Supabase:', error);
    }
  };

  // ...existing code...
  // Remove the inner handleEditContainer and related inner render logic
  // Helper to get today's nightly snapshot
  // Fetch latest backup from Supabase for snapshot display
  const [latestBackup, setLatestBackup] = useState<any[]>([]);
  useEffect(() => {
    getLatestBackup()
      .then(backup => {
        if (backup && Array.isArray(backup.data)) setLatestBackup(backup.data);
        else setLatestBackup([]);
      })
      .catch(() => setLatestBackup([]));
  }, [snapshotRefreshKey]);

  // Render admin nightly snapshot
  const renderAdminNightlySnapshot = () => {
    return (
      <Card className="p-4 mb-6">
        <h3 className="mb-2">Nightly Snapshot (Supabase Backup)</h3>
        <div className="flex gap-2 mb-4">
          <Button size="sm" variant="outline" onClick={handleManualBackup}>Manual Backup</Button>
        </div>
        {latestBackup.length === 0 ? (
          <p className="text-muted-foreground">No snapshot found in Supabase.</p>
        ) : (
          <div>
            {latestBackup.map((container: any) => (
              <Card key={container.id || container.container?.id} className="mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4>{container.name || container.container?.name}</h4>
                    <p className="text-xs text-muted-foreground">Location: {container.location || container.container?.location}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleRevertContainer(container.id || container.container?.id)}>
                    Revert to Last Backup
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
  const renderContainerCard = (container: PlasmaContainer) => (
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
            <h3 className="mb-3">Welcome to SAGA Sample Storage Management Systems</h3>
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
                      liveOccupiedSlots={getLiveOccupiedSlots([container])}
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
                      liveOccupiedSlots={getLiveOccupiedSlots([container])}
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