import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase/client';
import { fetchSamples, upsertSample, fetchSampleById } from '../utils/supabase/samples';
import { toast } from 'sonner';
import { safeReplace, safeTrim } from '../utils/safeString';
import { normalisePosition, normaliseSampleId } from '../utils/positions';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Calendar, User, TestTube, Clock, Scan, AlertTriangle, Trash2, Edit3, Info } from 'lucide-react';
import { PlasmaContainer, getGridDimensions } from './PlasmaContainerList';
import { createAuditLog } from './AuditTrail';

// Utility to infer storage temperature from sample/container type
function inferStorageTemperature(type: string) {
  // Normalize type for matching
  const t = (type || '').toLowerCase();
  if (/(dp|cf\s*dna|mnc|pa|idt)/i.test(t)) return '-20C';
  if (/dtc/i.test(t)) return '4C';
  if (/(plasma|bc|buffy)/i.test(t)) return '-80C';
  return '';
}

// Sample history is now stored within each sample's history array

interface SampleHistoryEntry {
  timestamp: string;
  action: 'check-in' | 'check-out' | 'moved' | 'accessed';
  user?: string;
  notes?: string;
  fromPosition?: string;
  toPosition?: string;
}

interface PlasmaSample {
  position: string;
  sampleId: string;
  storageDate: string;
  lastAccessed?: string;
  status?: 'in_container' | 'checked_out' | string;
  history: SampleHistoryEntry[];
  // Whether this authoritative sample row is archived in the DB
  isArchived?: boolean;
}

interface PlasmaBoxDashboardProps {
  container: PlasmaContainer;
  onContainerUpdate?: (updatedContainer: PlasmaContainer) => void;
  initialSelectedSample?: string | null;
  onSampleSelectionHandled?: () => void;
  highlightSampleIds?: string[];
}

type ViewMode = 'view' | 'edit';

export function PlasmaBoxDashboard({ container, onContainerUpdate, initialSelectedSample, onSampleSelectionHandled, highlightSampleIds = [] }: PlasmaBoxDashboardProps) {
  // Import Supabase client for real-time
  // (If not already imported at the top)
  // import { supabase } from '../utils/supabase/client';
  const hasMounted = React.useRef(false);
  // Track whether the user has made an interaction that should trigger an autosave.
  const userHasInteracted = React.useRef(false);
  const prevSamplesRef = React.useRef<PlasmaSample[] | null>(null);
  const [samples, setSamples] = useState<PlasmaSample[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState<PlasmaSample | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('view');
  const [scannedBarcode, setScannedBarcode] = useState('');
  // Always use saga-user-initials from localStorage for audit tracking
  const [userInitials, setUserInitials] = useState(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('saga-user-initials') || 'null');
      return userData?.initials || '';
    } catch {
      return '';
    }
  });
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [targetPosition, setTargetPosition] = useState<string>('');
  const [moveNotification, setMoveNotification] = useState<{ from: string; to: string; sampleId: string } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);


  // Load samples from Supabase for this container on mount or when container.id changes
  useEffect(() => {
    let isMounted = true;
    async function loadSamples() {
      try {
        // Fetch only samples for this container
        const allSamples = await fetchSamples(container.id);
        console.log('[PlasmaBoxDashboard] fetched samples for container', container.id, Array.isArray(allSamples) ? allSamples.length : 0);
        // Map to PlasmaSample shape if needed
        const mapSample = (s: any): PlasmaSample => ({
          // Normalize position to canonical form (handles 14A vs A14 etc)
          position: normalisePosition(s.position || s.pos || '' , container.containerType),
          // Normalize sample id to a trimmed string
          sampleId: normaliseSampleId(s.sample_id || s.sampleId || s.id || ''),
          storageDate: s.storage_date || s.storageDate || '',
          lastAccessed: s.last_accessed || s.lastAccessed || '',
          history: s.history || [],
          isArchived: Boolean((s.data && s.data.is_archived) || s.is_archived || false)
        });
        const mapped = (allSamples || []).map(mapSample);
        if (isMounted) setSamples(mapped);
      } catch (error) {
        console.error('Error loading samples from Supabase:', error);
        if (isMounted) setSamples([]);
      }
    }
    loadSamples();
    return () => { isMounted = false; };
  }, [container.id]);

  // Real-time subscription to samples table for this container
  useEffect(() => {
    const channel = supabase
      .channel('samples-changes-' + container.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'samples',
          filter: `container_id=eq.${container.id}`
        },
            (payload: any) => {
          // On any insert/update/delete, reload samples
            fetchSamples(container.id).then(allSamples => {
            const mapSample = (s: any): PlasmaSample => ({
              position: normalisePosition(s.position || s.pos || '' , container.containerType),
              sampleId: normaliseSampleId(s.sample_id || s.sampleId || s.id || ''),
              storageDate: s.storage_date || s.storageDate || '',
              lastAccessed: s.last_accessed || s.lastAccessed || '',
              history: s.history || [],
              isArchived: Boolean((s.data && s.data.is_archived) || s.is_archived || false)
            });
            const mapped = (allSamples || []).map(mapSample);
            setSamples(mapped);
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [container.id]);

  // Auto-save samples whenever they change, but not on initial load
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      prevSamplesRef.current = samples;
      return;
    }
    // Only save if samples actually changed (deep compare by JSON.stringify)
    const prevSamples = prevSamplesRef.current;
    if (JSON.stringify(samples) === JSON.stringify(prevSamples)) {
      return;
    }
    prevSamplesRef.current = samples;
    // Don't auto-save changes that originated from an initial server load or realtime sync.
    // Only proceed when the user has interacted with the UI (added/moved/cleared a sample).
    if (!userHasInteracted.current) {
      return;
    }
    if (samples.length >= 0) {
      const timeoutId = setTimeout(() => {
        async function saveSamples() {
          setIsSaving(true);
          setSaveStatus('saving');
          setSaveError(null);
            try {
              // Run all upserts and handle partial failures gracefully. We only surface an error
              // if every upsert failed. This prevents transient or per-row fallback errors from
              // showing to the user when most or all data saved successfully.
              const results = await Promise.allSettled(samples.map(sample => {
                const samplePayload: any = {
                  container_id: container.id,
                  position: sample.position,
                  sample_id: sample.sampleId,
                  created_at: sample.storageDate ? new Date(sample.storageDate).toISOString() : undefined,
                  updated_at: sample.lastAccessed ? new Date(sample.lastAccessed).toISOString() : undefined
                };
                if ('history' in sample) {
                  samplePayload.history = sample.history;
                }
                if ('status' in sample) {
                  samplePayload.status = sample.status;
                }
                return upsertSample(samplePayload);
              }));

              const fulfilled = results.filter(r => r.status === 'fulfilled');
              const rejected = results.filter(r => r.status === 'rejected');

              if (fulfilled.length > 0) {
                // At least one save succeeded — treat as saved for the user. Log any rejections for debugging.
                if (rejected.length > 0) {
                  console.debug('[autosave] Partial failures during samples upsert:', rejected);
                }
                setSaveStatus('saved');
                // Reset interaction flag after a successful user-initiated save
                userHasInteracted.current = false;
                setTimeout(() => setSaveStatus('idle'), 1200);
              } else {
                // All failed — surface an error to the user
                const firstErr = (rejected[0] as any)?.reason;
                setSaveStatus('error');
                setSaveError(firstErr?.message || 'Failed to save samples to Supabase.');
                console.error('Error saving samples to Supabase (all failed):', rejected);
                showDetailedErrorToast(firstErr, 'Failed to save samples to Supabase.');
              }
            } catch (error: any) {
              // If something unexpected happens running the upserts themselves
              setSaveStatus('error');
              setSaveError(error?.message || 'Failed to save samples to Supabase.');
              console.error('Unexpected error during autosave:', error);
              showDetailedErrorToast(error, 'Failed to save samples to Supabase.');
            } finally {
              setIsSaving(false);
            }
        }
        saveSamples();

        // Update container occupancy and lastUpdated
        if (onContainerUpdate) {
          const updatedContainer = {
            ...container,
            occupiedSlots: samples.length,
            lastUpdated: safeReplace(new Date().toISOString().slice(0, 16), 'T', ' ')
          };
          onContainerUpdate(updatedContainer);
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [samples, container, onContainerUpdate]);

  // Handle initial sample selection from search navigation
  useEffect(() => {
    if (initialSelectedSample && samples.length > 0) {
      const targetSample = samples.find(s => s.sampleId === initialSelectedSample);
      if (targetSample) {
        setSelectedPosition(targetSample.position);
        setSelectedSample(targetSample);
        // Notify parent that we've handled the selection
        if (onSampleSelectionHandled) {
          onSampleSelectionHandled();
        }
      }
    }
  }, [initialSelectedSample, samples, onSampleSelectionHandled]);

  const dimensions = getGridDimensions(container.containerType, container.sampleType);

  const generateGrid = () => {
    interface GridItem {
      position: string;
      sample: PlasmaSample | undefined;
      isDisabled: boolean;
    }
    
    const grid: GridItem[] = [];
    const isIDTRack = dimensions.rows === 14 && dimensions.cols === 7;
    if (isIDTRack) {
      // For IDT Plates (7x14), columns are letters A..G and rows are numbered 14..1 (top->bottom)
      for (let r = 0; r < dimensions.rows; r++) {
        const rowNumber = dimensions.rows - r; // 14..1
        for (let c = 0; c < dimensions.cols; c++) {
          const colLetter = String.fromCharCode(65 + c); // A..G
          const position = `${colLetter}${rowNumber}`;
          const sample = samples.find(s => s.position === position);
          const isDisabled = false; // No special disabled positions for IDT
          grid.push({ position, sample, isDisabled });
        }
      }
    } else {
      for (let row = 0; row < dimensions.rows; row++) {
        for (let col = 0; col < dimensions.cols; col++) {
          const position = `${String.fromCharCode(65 + row)}${col + 1}`;
          const sample = samples.find(s => s.position === position);
          
          // For DP Pools, position I9 (81st position) should be disabled since effective capacity is 80
          const isDisabled = container.sampleType === 'DP Pools' && 
                            container.containerType === '9x9-box' && 
                            position === 'I9';
          
          grid.push({ position, sample, isDisabled });
        }
      }
    }
    return grid;
  };

  const grid = generateGrid();
  const sampleHistory = selectedSample?.history || [];

  // Archive toggle handler: mark the authoritative backend sample row with is_archived flag
  const toggleArchiveForSelected = async (archived: boolean) => {
    if (!selectedSample) return;
    try {
      const serverSample = await fetchSampleById(selectedSample.sampleId, container.id);
      if (!serverSample) {
        toast.error('Unable to find authoritative sample record on server to archive.');
        return;
      }
      const payload: any = {
        id: serverSample.id,
        sample_id: serverSample.sample_id,
        container_id: serverSample.container_id,
        position: serverSample.position,
        data: serverSample.data || {}
      };
      payload.data = { ...(payload.data || {}), is_archived: archived };
      await upsertSample(payload);
      toast.success(archived ? 'Sample archived' : 'Sample unarchived');
      // refresh local samples
      const all = await fetchSamples(container.id);
      const mapped = (all || []).map((s: any) => ({
        position: normalisePosition(s.position || s.pos || '' , container.containerType),
        sampleId: normaliseSampleId(s.sample_id || s.sampleId || s.id || ''),
        storageDate: s.storage_date || s.storageDate || '',
        lastAccessed: s.last_accessed || s.lastAccessed || '',
        history: s.history || [],
        isArchived: Boolean((s.data && s.data.is_archived) || s.is_archived || false)
      }));
      setSamples(mapped);
      // Update selectedSample reference so UI shows updated archived state
      const refreshed = mapped.find((m: PlasmaSample) => m.sampleId === selectedSample.sampleId);
      if (refreshed) setSelectedSample(refreshed as PlasmaSample);
    } catch (e: any) {
      console.error('Archive toggle failed', e);
      showDetailedErrorToast(e, 'Failed to update archive state');
    }
  };

  function showDetailedErrorToast(err: any, fallbackMessage?: string) {
    // Prefer structured messages provided by helpers; fall back to generic message
    const message = (err && (err.message || String(err))) || fallbackMessage || 'An error occurred';
    const hint = (err as any)?.hint;
    const details = (err as any)?.details || (err as any)?.stack || null;

    // Map common technical messages to friendly user-facing messages
    let friendly = fallbackMessage || 'Something went wrong.';
    let friendlyHint = '';
    const m = String(message).toLowerCase();
    if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('request timeout') || m.includes('fetcherror')) {
      friendly = 'Network or server unavailable. Please check your connection or try again.';
      friendlyHint = 'If the problem persists, the backend may be down or unreachable.';
    } else if (m.includes('404') || m.includes('not found')) {
      friendly = 'Server endpoint not found. The backend route may be missing or misconfigured.';
      friendlyHint = 'Try refreshing; if it continues, contact your administrator.';
    } else if (m.includes('row-level security') || m.includes('permission') || m.includes('policy') || m.includes('forbidden') || m.includes('403')) {
      friendly = 'Permission error. You do not have permission to perform this action.';
      friendlyHint = 'Contact your administrator to request access.';
    } else if (m.includes('server') && m.includes('failed')) {
      friendly = 'Server error while saving. Please try again.';
      friendlyHint = 'If this repeats, check server logs or contact support.';
    } else {
      friendly = fallbackMessage || 'An unexpected error occurred.';
      if (hint) friendlyHint = String(hint);
    }

    // Log full technical details to console for debugging
    console.debug('Detailed error (user toast):', { message, hint, details, err });

    // Compose toast body (short and friendly)
    const toastParts = [friendly];
    if (friendlyHint) toastParts.push(friendlyHint);
    // Keep toast short — technical details are in console
    toast.error(toastParts.join(' — '));
  }

  const getCellSize = () => {
    // Make cells wider to accommodate full sample IDs like "C01039DPP1B" (11 characters)
    // Updated with more generous spacing for better sample ID visibility
    // Special handling for 7x14 racks (IDT Plates) - smaller cells due to large grid
  // For IDT Plates (7x14), make cells flexible to expand and use available whitespace
  if (dimensions.rows === 14 && dimensions.cols === 7) return 'flex-1 h-12 min-w-[48px]';
    if (dimensions.rows <= 5 && dimensions.cols <= 5) return 'w-32 h-14';
    if (dimensions.rows <= 7 && dimensions.cols <= 7) return 'w-28 h-12';
    return 'w-24 h-10';
  };

  const getHeaderCellSize = () => {
    // Header cells need to match the width of regular cells
    // Updated to match the new cell sizes for better sample ID visibility
    // Special handling for 7x14 racks (IDT Plates) - smaller cells due to large grid
  if (dimensions.rows === 14 && dimensions.cols === 7) return 'flex-1 h-12 min-w-[48px]';
    if (dimensions.rows <= 5 && dimensions.cols <= 5) return 'w-32 h-14';
    if (dimensions.rows <= 7 && dimensions.cols <= 7) return 'w-28 h-12';
    return 'w-24 h-10';
  };

  const cellSize = getCellSize();
  const headerCellSize = getHeaderCellSize();
  const fontSize = dimensions.rows === 14 ? 'text-xs' : dimensions.rows > 7 ? 'text-xs' : dimensions.rows > 5 ? 'text-sm' : 'text-base';

  const handlePositionClick = (position: string, sample?: PlasmaSample) => {
    // Don't allow selection of disabled positions
    const gridItem = grid.find(item => item.position === position);
    if (gridItem?.isDisabled) {
      return;
    }
    
    setSelectedPosition(position);
    setSelectedSample(sample || null);
    
    if (viewMode === 'edit') {
      setTargetPosition(position);
    }
  };


    // Utility function to check for duplicate conflicts and find existing samples for movement
    const checkForDuplicateConflicts = (sampleId: string) => {
      // Load all containers to check for duplicates across all containers
      const savedContainers = localStorage.getItem('saga-containers');
      let allContainers: PlasmaContainer[] = [];
    
      if (savedContainers) {
        try {
          const parsedContainers = JSON.parse(savedContainers);
          if (Array.isArray(parsedContainers)) {
            allContainers = parsedContainers;
          }
        } catch (error) {
          console.error('Error loading containers for duplicate check:', error);
        }
      }

      // Find all samples with this ID across all containers (excluding current container)
      const duplicateLocations: Array<{ container: PlasmaContainer; position: string; sample: any }> = [];
    
      allContainers.forEach(containerItem => {
        // Skip the current container - we handle that separately
        if (containerItem.id === container.id) return;
      
        const containerStorageKey = `samples-${containerItem.id}`;
        const savedSamples = localStorage.getItem(containerStorageKey);
      
        if (savedSamples) {
          try {
            const parsedData = JSON.parse(savedSamples);
          
            // Handle both formats: object and array
            if (typeof parsedData === 'object' && !Array.isArray(parsedData)) {
              Object.entries(parsedData).forEach(([position, data]: [string, any]) => {
                if (data.id === sampleId) {
                  duplicateLocations.push({ container: containerItem, position, sample: data });
                }
              });
            } else if (Array.isArray(parsedData)) {
              parsedData.forEach((sample: any) => {
                if (sample.sampleId === sampleId) {
                  duplicateLocations.push({ container: containerItem, position: sample.position, sample });
                }
              });
            }
          } catch (error) {
            console.error(`Error checking samples in container ${containerItem.id}:`, error);
          }
        }
      });

      // Apply the duplicate rules:
      // 1. Archive containers can have duplicates (no restrictions)
      // 2. General population can duplicate samples that exist only in archive OR move samples from other containers
      // 3. If sample exists in other containers, offer to move it instead of treating as duplicate error
    
      if (container.isArchived) {
        // Archive containers allow all duplicates
        return { allowed: true, conflicts: [], foundInOtherContainers: duplicateLocations };
      }

      // For general population containers, check if duplicates exist in other general population containers
      const genPopConflicts = duplicateLocations.filter(loc => !loc.container.isArchived);
    
      if (genPopConflicts.length > 0) {
        // Found duplicates in general population - offer to move instead of blocking
        return { allowed: true, conflicts: genPopConflicts, foundInOtherContainers: duplicateLocations, shouldMove: true };
      }

      // No conflicts found in general population - allow the duplicate
      return { allowed: true, conflicts: [], foundInOtherContainers: duplicateLocations };
    };

  const handleBarcodeSubmit = () => {
    if (!scannedBarcode.trim()) return;
    if (!userInitials.trim()) {
      toast.error('Please enter your initials before performing sample operations.');
      return;
    }
    
    // Clear any previous scan errors
    setScanError(null);
    
    let position = targetPosition || selectedPosition;
    
    if (!position) {
      // Find next available position (excluding disabled positions)
      const availablePosition = grid.find(g => !g.sample && !g.isDisabled)?.position;
      if (!availablePosition) {
        setScanError(`Container is full! Sample "${scannedBarcode.trim()}" was not saved.`);
        setTimeout(() => setScanError(null), 5000);
        return;
      }
      position = availablePosition;
      setSelectedPosition(position);
      setTargetPosition(position);
    }
    
    // Check if this sample ID already exists somewhere in the current container
    const existingSampleWithSameId = samples.find(s => s.sampleId === scannedBarcode.trim());
    
    if (existingSampleWithSameId) {
      // Sample exists in a different position within same container - move it
      if (existingSampleWithSameId.position !== position) {
        setMoveNotification({
          from: existingSampleWithSameId.position,
          to: position,
          sampleId: scannedBarcode.trim()
        });
        setTimeout(() => setMoveNotification(null), 3000);
      }
      // Remove from old position and add to new position
      handleMoveSample(existingSampleWithSameId.position, position);
      return;
    }

    // Check for duplicate conflicts across all containers based on archive rules
    const duplicateCheck = checkForDuplicateConflicts(scannedBarcode.trim());
    
    if (!duplicateCheck.allowed) {
      const conflictList = duplicateCheck.conflicts
        .map(conflict => `${conflict.container.name} (${conflict.position})`)
        .join(', ');
      
      setScanError(
        `Duplicate sample ID "${scannedBarcode.trim()}" already exists in general population container(s): ${conflictList}. ` +
        `Archive containers allow duplicates, but general population containers can only duplicate samples from archive.`
      );
      setTimeout(() => setScanError(null), 8000);
      return;
    }

    // Check if we should move the sample from another container
    if (duplicateCheck.shouldMove && duplicateCheck.foundInOtherContainers.length > 0) {
      // For now, take the first one, but could be enhanced to show user a choice dialog
      const sourceLocation = duplicateCheck.foundInOtherContainers[0];
      handleMoveSampleFromOtherContainer(sourceLocation, position);
      return;
    }

    // If sample exists in archive or other general population containers, automatically move it
    if (duplicateCheck.foundInOtherContainers.length > 0) {
      const sourceLocation = duplicateCheck.foundInOtherContainers[0];
      handleMoveSampleFromOtherContainer(sourceLocation, position);
      return;
    }
    
    // Check if target position is occupied by a different sample
    const existingSampleAtPosition = samples.find(s => s.position === position);
    if (existingSampleAtPosition) {
      setShowOverwriteDialog(true);
      return;
    }
    
    // Add the sample
    handleAddSample(position);
  };

  const findNextAvailablePosition = (currentPosition?: string) => {
    // Find the next available position searching column by column (left to right)
    const availablePositions = grid.filter(g => !g.sample && !g.isDisabled);
    if (availablePositions.length === 0) return null;
    
    if (!currentPosition) {
      // Return first position in column-first order
      return findFirstAvailableColumnFirst();
    }
    
    // Parse current position (e.g., "A1" -> row=0, col=0)
    const currentRow = currentPosition.charCodeAt(0) - 65; // A=0, B=1, etc.
    const currentCol = parseInt(currentPosition.slice(1)) - 1; // 1=0, 2=1, etc.
    
    // Search for next position in column-first order
    for (let col = 0; col < dimensions.cols; col++) {
      for (let row = 0; row < dimensions.rows; row++) {
        const position = `${String.fromCharCode(65 + row)}${col + 1}`;
        const gridItem = grid.find(g => g.position === position);
        
        // Skip if this position is occupied or disabled
        if (gridItem?.sample || gridItem?.isDisabled) continue;
        
        // Check if this position comes after current position in column-first order
        const isAfterCurrent = col > currentCol || (col === currentCol && row > currentRow);
        
        if (isAfterCurrent) {
          return position;
        }
      }
    }
    
    // If no position found after current, wrap to first available
    return findFirstAvailableColumnFirst();
  };

  const findFirstAvailableColumnFirst = () => {
    // Search column by column from left to right
    for (let col = 0; col < dimensions.cols; col++) {
      for (let row = 0; row < dimensions.rows; row++) {
        const position = `${String.fromCharCode(65 + row)}${col + 1}`;
        const gridItem = grid.find(g => g.position === position);
        
        // Return first available position in column-first order
        if (!gridItem?.sample && !gridItem?.isDisabled) {
          return position;
        }
      }
    }
    return null;
  };

  const handleAddSample = (position: string) => {
    if (!scannedBarcode.trim()) return;
    
    const now = new Date().toISOString();
    
    // Check if sample exists in current container
    const existingSampleInContainer = samples.find(s => s.sampleId === scannedBarcode.trim());
    
    // Check if sample was previously checked out
    let existingSampleHistory: SampleHistoryEntry[] = [];
    const checkedOutKey = `checked-out-samples`;
    const existingCheckedOut = localStorage.getItem(checkedOutKey);
    
    if (existingCheckedOut) {
      try {
        const checkedOutSamples: PlasmaSample[] = JSON.parse(existingCheckedOut);
        const checkedOutSample = checkedOutSamples.find(s => s.sampleId === scannedBarcode.trim());
        if (checkedOutSample) {
          existingSampleHistory = checkedOutSample.history;
          
          // Remove this sample from checked-out storage since it's being re-added
          const updatedCheckedOut = checkedOutSamples.filter(s => s.sampleId !== scannedBarcode.trim());
          localStorage.setItem(checkedOutKey, JSON.stringify(updatedCheckedOut));
        }
      } catch (error) {
        console.error('Error loading checked out samples:', error);
      }
    }
    
    // Use existing history from container sample, checked-out sample, or start fresh
    const baseHistory = existingSampleInContainer?.history || existingSampleHistory;
    
    const newSample: PlasmaSample = {
      position,
      sampleId: scannedBarcode.trim(),
      storageDate: new Date().toISOString().split('T')[0],
      status: 'in_container',
      history: baseHistory.length > 0 ? [
        ...baseHistory,
        {
          timestamp: now,
          action: 'check-in',
          user: userInitials.trim(),
          notes: `Sample checked into position ${position}`
        }
      ] : [{
        timestamp: now,
        action: 'check-in',
        user: userInitials.trim(),
        notes: `Initial storage in position ${position}`
      }]
      ,
      isArchived: false
    };
    
    // Remove existing sample at position and add new one
    // Mark that this change was user-initiated so autosave is allowed
    userHasInteracted.current = true;
    setSamples(prev => [
      ...prev.filter(s => s.position !== position),
      newSample
    ]);

    // Persist audit log / movement for this check-in
    try {
      let userId = userInitials.trim();
      try {
        const userInfo = JSON.parse(localStorage.getItem('saga-user-info') || 'null');
        if (userInfo && userInfo.id) userId = userInfo.id;
      } catch {}
      createAuditLog(
        'sample-check-in',
        'sample',
        newSample.sampleId,
        {
          description: `Checked in sample ${newSample.sampleId} to ${container.name} (${container.id}) position ${position}`,
          metadata: {
            sampleId: newSample.sampleId,
            toContainerId: container.id,
            toContainerName: container.name,
            toPosition: position
          }
        },
        userId
      );
    } catch (err) {
      console.debug('Non-blocking: failed to create audit log for check-in', err);
    }
    
    // Reset form and prepare for next scan
    setScannedBarcode('');
    setTargetPosition('');
    
    // Auto-advance to next available position
    const nextPosition = findNextAvailablePosition(position);
    if (nextPosition) {
      setSelectedPosition(nextPosition);
      setTargetPosition(nextPosition);
    } else {
      // No more positions available
      setSelectedPosition(null);
      setTargetPosition('');
    }
    
    // Focus the barcode input for next scan
    setTimeout(() => {
      const barcodeInput = document.querySelector('input[placeholder*="Scan or enter sample ID"]') as HTMLInputElement;
      if (barcodeInput) {
        barcodeInput.focus();
      }
    }, 100);
  };

  const handleMoveSample = (fromPosition: string, toPosition: string) => {
    if (!scannedBarcode.trim()) return;
    
    let existingSample = samples.find(s => s.position === fromPosition);
    
    // If sample not found in current container, check if it's being moved from checked-out storage
    if (!existingSample) {
      const checkedOutKey = `checked-out-samples`;
      const existingCheckedOut = localStorage.getItem(checkedOutKey);
      
      if (existingCheckedOut) {
        try {
          const checkedOutSamples: PlasmaSample[] = JSON.parse(existingCheckedOut);
          const checkedOutSample = checkedOutSamples.find(s => s.sampleId === scannedBarcode.trim());
          if (checkedOutSample) {
            existingSample = checkedOutSample;
            
            // Remove from checked-out storage since it's being moved back into a container
            const updatedCheckedOut = checkedOutSamples.filter(s => s.sampleId !== scannedBarcode.trim());
            localStorage.setItem(checkedOutKey, JSON.stringify(updatedCheckedOut));
          }
        } catch (error) {
          console.error('Error loading checked out samples:', error);
        }
      }
    }
    
    if (!existingSample) return;
    
    const now = new Date().toISOString();
    
    const movedSample: PlasmaSample = {
      ...existingSample,
      position: toPosition,
      lastAccessed: new Date().toISOString().split('T')[0],
      status: 'in_container',
      history: [
        ...existingSample.history,
        {
          timestamp: now,
          action: 'moved',
          user: userInitials.trim(),
          fromPosition,
          toPosition,
          notes: `Sample moved from position ${fromPosition} to ${toPosition}`
        }
      ]
      ,
      isArchived: existingSample.isArchived ?? false
    };
    
    // Remove sample from old position and any sample at new position, then add moved sample
    userHasInteracted.current = true;
    // Remove sample from old position and any sample at new position, then add moved sample
    setSamples(prev => [
      ...prev.filter(s => s.position !== fromPosition && s.position !== toPosition),
      movedSample
    ]);

    // Persist audit log / movement for this move
    try {
      let userId = userInitials.trim();
      try {
        const userInfo = JSON.parse(localStorage.getItem('saga-user-info') || 'null');
        if (userInfo && userInfo.id) userId = userInfo.id;
      } catch {}
      createAuditLog(
        'sample-move',
        'sample',
        movedSample.sampleId,
        {
          description: `Moved sample ${movedSample.sampleId} from ${fromPosition} to ${toPosition} in ${container.name} (${container.id})`,
          metadata: {
            sampleId: movedSample.sampleId,
            fromContainerId: container.id,
            fromContainerName: container.name,
            fromPosition,
            toContainerId: container.id,
            toContainerName: container.name,
            toPosition
          }
        },
        userId
      );
    } catch (err) {
      console.debug('Non-blocking: failed to create audit log for move', err);
    }
    
    // Reset form and prepare for next scan
    setScannedBarcode('');
    setTargetPosition('');
    
    // Auto-advance to next available position  
    const nextPosition = findNextAvailablePosition(toPosition);
    if (nextPosition) {
      setSelectedPosition(nextPosition);
      setTargetPosition(nextPosition);
    } else {
      // Update selected position to moved sample's location if no next position
      setSelectedPosition(toPosition);
      setSelectedSample(movedSample);
    }
    
    // Focus the barcode input for next scan
    setTimeout(() => {
      const barcodeInput = document.querySelector('input[placeholder*="Scan or enter sample ID"]') as HTMLInputElement;
      if (barcodeInput) {
        barcodeInput.focus();
      }
    }, 100);
  };

  const handleMoveSampleFromOtherContainer = (sourceLocation: { container: PlasmaContainer; position: string; sample: any }, toPosition: string) => {
    if (!scannedBarcode.trim()) return;
    
    const now = new Date().toISOString();
    
    // Get the existing sample data from the source location
    let existingSampleData: any = sourceLocation.sample;
    
    // Convert sample data to PlasmaSample format if needed
    let existingSample: PlasmaSample;
    if (existingSampleData.sampleId) {
      // Already in PlasmaSample format
      existingSample = existingSampleData;
    } else {
      // Convert from admin import format
      existingSample = {
        position: sourceLocation.position,
        sampleId: existingSampleData.id,
        storageDate: existingSampleData.timestamp ? existingSampleData.timestamp.split('T')[0] : new Date().toISOString().split('T')[0],
        lastAccessed: existingSampleData.lastAccessed,
        history: existingSampleData.history || [{
          timestamp: existingSampleData.timestamp || new Date().toISOString(),
          action: 'check-in',
          notes: `Initial storage in position ${sourceLocation.position}`
        }]
      };
    }
    
    // Create moved sample with updated history
    const movedSample: PlasmaSample = {
      ...existingSample,
      position: toPosition,
      lastAccessed: new Date().toISOString().split('T')[0],
      status: 'in_container',
      history: [
        ...existingSample.history,
        {
          timestamp: now,
          action: 'moved',
          user: userInitials.trim(),
          fromPosition: sourceLocation.position,
          toPosition,
          notes: `Sample moved from ${sourceLocation.container.name} (${sourceLocation.position}) to ${container.name} (${toPosition})`
        }
      ]
      ,
      isArchived: existingSample.isArchived ?? false
    };
    
    // Remove sample from source container
    const sourceStorageKey = `samples-${sourceLocation.container.id}`;
    const sourceSavedSamples = localStorage.getItem(sourceStorageKey);
    
    if (sourceSavedSamples) {
      try {
        const parsedData = JSON.parse(sourceSavedSamples);
        
        if (typeof parsedData === 'object' && !Array.isArray(parsedData)) {
          // Object format - remove by position
          delete parsedData[sourceLocation.position];
          localStorage.setItem(sourceStorageKey, JSON.stringify(parsedData));
        } else if (Array.isArray(parsedData)) {
          // Array format - filter out the sample
          const updatedSamples = parsedData.filter((sample: any) => 
            sample.sampleId !== scannedBarcode.trim() || sample.position !== sourceLocation.position
          );
          localStorage.setItem(sourceStorageKey, JSON.stringify(updatedSamples));
        }
        
        // Update source container occupancy
        updateSourceContainerOccupancy(sourceLocation.container.id);
      } catch (error) {
        console.error('Error removing sample from source container:', error);
      }
    }
    
    // Add sample to current container (remove any existing sample at target position)
    userHasInteracted.current = true;
    setSamples(prev => [
      ...prev.filter(s => s.position !== toPosition),
      movedSample
    ]);

    // Persist audit log / movement for cross-container move
    try {
      let userId = userInitials.trim();
      try {
        const userInfo = JSON.parse(localStorage.getItem('saga-user-info') || 'null');
        if (userInfo && userInfo.id) userId = userInfo.id;
      } catch {}
      createAuditLog(
        'sample-move',
        'sample',
        movedSample.sampleId,
        {
          description: `Moved sample ${movedSample.sampleId} from ${sourceLocation.container.name} (${sourceLocation.container.id}) ${sourceLocation.position} to ${container.name} (${container.id}) ${toPosition}`,
          metadata: {
            sampleId: movedSample.sampleId,
            fromContainerId: sourceLocation.container.id,
            fromContainerName: sourceLocation.container.name,
            fromPosition: sourceLocation.position,
            toContainerId: container.id,
            toContainerName: container.name,
            toPosition
          }
        },
        userId
      );
    } catch (err) {
      console.debug('Non-blocking: failed to create audit log for cross-container move', err);
    }
    
    // Show move notification
    setMoveNotification({
      from: `${sourceLocation.container.name} (${sourceLocation.position})`,
      to: `${container.name} (${toPosition})`,
      sampleId: scannedBarcode.trim()
    });
    setTimeout(() => setMoveNotification(null), 4000);
    
    // Reset form and prepare for next scan
    setScannedBarcode('');
    setTargetPosition('');
    
    // Auto-advance to next available position  
    const nextPosition = findNextAvailablePosition(toPosition);
    if (nextPosition) {
      setSelectedPosition(nextPosition);
      setTargetPosition(nextPosition);
    } else {
      // Update selected position to moved sample's location if no next position
      setSelectedPosition(toPosition);
      setSelectedSample(movedSample);
    }
    
    // Focus the barcode input for next scan
    setTimeout(() => {
      const barcodeInput = document.querySelector('input[placeholder*="Scan or enter sample ID"]') as HTMLInputElement;
      if (barcodeInput) {
        barcodeInput.focus();
      }
    }, 100);
  };

  // Helper function to update source container occupancy when sample is moved out
  const updateSourceContainerOccupancy = (sourceContainerId: string) => {
    if (!onContainerUpdate) return;
    
    // Get current sample count for source container
    const sourceStorageKey = `samples-${sourceContainerId}`;
    const sourceSavedSamples = localStorage.getItem(sourceStorageKey);
    let sourceOccupiedSlots = 0;
    
    if (sourceSavedSamples) {
      try {
        const parsedData = JSON.parse(sourceSavedSamples);
        
        if (typeof parsedData === 'object' && !Array.isArray(parsedData)) {
          sourceOccupiedSlots = Object.keys(parsedData).length;
        } else if (Array.isArray(parsedData)) {
          sourceOccupiedSlots = parsedData.length;
        }
      } catch (error) {
        console.error('Error counting samples in source container:', error);
      }
    }
    
    // Load and update the source container
    const savedContainers = localStorage.getItem('saga-containers');
    if (savedContainers) {
      try {
        const parsedContainers = JSON.parse(savedContainers);
        if (Array.isArray(parsedContainers)) {
          const sourceContainer = parsedContainers.find((c: PlasmaContainer) => c.id === sourceContainerId);
          if (sourceContainer) {
            const updatedSourceContainer = {
              ...sourceContainer,
              occupiedSlots: sourceOccupiedSlots,
              lastUpdated: safeReplace(new Date().toISOString().slice(0, 16), 'T', ' ')
            };
            
            // Update the containers list
            const updatedContainers = parsedContainers.map((c: PlasmaContainer) => 
              c.id === sourceContainerId ? updatedSourceContainer : c
            );
            
            localStorage.setItem('saga-containers', JSON.stringify(updatedContainers));
            
            // Trigger a container update if this component has the callback
            // Note: This will only update the current container, but the source container
            // will be updated when the user navigates to it or the app reloads
          }
        }
      } catch (error) {
        console.error('Error updating source container occupancy:', error);
      }
    }
  };

  const handleOverwriteConfirm = () => {
    setShowOverwriteDialog(false);
    const position = targetPosition || selectedPosition;
    if (position) {
      handleAddSample(position);
    }
  };

  // Auto-focus barcode input when entering edit mode
  useEffect(() => {
    if (viewMode === 'edit') {
      setTimeout(() => {
        const barcodeInput = document.querySelector('input[placeholder*="Scan or enter sample ID"]') as HTMLInputElement;
        if (barcodeInput) {
          barcodeInput.focus();
        }
      }, 100);
    }
  }, [viewMode]);

  const handleCheckoutSample = () => {
    if (selectedPosition && selectedSample) {
      if (!userInitials.trim()) {
        toast.error('Please enter your initials before checking out samples.');
        return;
      }
      const now = new Date().toISOString();
      // Add check-out entry to history before removing
      const updatedSample: PlasmaSample = {
        ...selectedSample,
        status: 'checked_out',
        history: [
          ...selectedSample.history,
          {
            timestamp: now,
            action: 'check-out',
            user: userInitials.trim(),
            notes: `Sample checked out from position ${selectedPosition}`
          }
        ]
      };
      // Store the sample with updated history in a separate storage for checked-out samples
      const checkedOutKey = `checked-out-samples`;
      const existingCheckedOut = localStorage.getItem(checkedOutKey);
      let checkedOutSamples: PlasmaSample[] = [];
      if (existingCheckedOut) {
        try {
          checkedOutSamples = JSON.parse(existingCheckedOut);
        } catch (error) {
          console.error('Error loading checked out samples:', error);
        }
      }
      // Remove any existing entry for this sample and add the updated one
      checkedOutSamples = checkedOutSamples.filter(s => s.sampleId !== updatedSample.sampleId);
      checkedOutSamples.push(updatedSample);
      localStorage.setItem(checkedOutKey, JSON.stringify(checkedOutSamples));
      // Audit log: checkout
      let userId = userInitials.trim();
      let userName = userInitials.trim();
      try {
        const userInfo = JSON.parse(localStorage.getItem('saga-user-info') || 'null');
        if (userInfo && userInfo.id) userId = userInfo.id;
        if (userInfo && userInfo.name) userName = userInfo.name;
      } catch {}
      createAuditLog(
        'sample-check-out',
        'sample',
        selectedSample.sampleId,
        {
          description: `Checked out sample ${selectedSample.sampleId} from ${container.name} (${container.id}) position ${selectedPosition}`,
          metadata: {
            sampleId: selectedSample.sampleId,
            fromContainerId: container.id,
            fromContainerName: container.name,
            fromPosition: selectedPosition
          }
        },
        userId
      );
      // Remove from current container
        userHasInteracted.current = true;
        setSamples(prev => prev.map(s =>
          s.sampleId === updatedSample.sampleId ? updatedSample : s
        ));
      setSelectedSample(null);
    }
  };

  const handleClearPosition = () => {
    if (selectedPosition && selectedSample) {
      if (!userInitials.trim()) {
        toast.error('Please enter your initials before clearing this position.');
        return;
      }
      if (confirm(`Are you sure you want to permanently delete sample ${selectedSample.sampleId}? This will remove the sample and all its history permanently.`)) {
        // Audit log: clear position
        let userId = userInitials.trim();
        let userName = userInitials.trim();
        try {
          const userInfo = JSON.parse(localStorage.getItem('saga-user-info') || 'null');
          if (userInfo && userInfo.id) userId = userInfo.id;
          if (userInfo && userInfo.name) userName = userInfo.name;
        } catch {}
        createAuditLog(
          'sample-clear-position',
          'sample',
          selectedSample.sampleId,
          {
            description: `Cleared sample ${selectedSample.sampleId} from ${container.name} (${container.id}) position ${selectedPosition}`,
            metadata: {
              sampleId: selectedSample.sampleId,
              fromContainerId: container.id,
              fromContainerName: container.name,
              fromPosition: selectedPosition
            }
          },
          userId
        );
        // Completely remove the sample without preserving history
  userHasInteracted.current = true;
  setSamples(prev => prev.filter(s => s.position !== selectedPosition));
        setSelectedSample(null);
        setSelectedPosition(null);
      }
    }
  };

  const handleClearBox = () => {
    if (confirm('Are you sure you want to clear all samples from this container?')) {
      // Audit log: clear box
      let userId = userInitials.trim();
      let userName = userInitials.trim();
      try {
        const userInfo = JSON.parse(localStorage.getItem('saga-user-info') || 'null');
        if (userInfo && userInfo.id) userId = userInfo.id;
        if (userInfo && userInfo.name) userName = userInfo.name;
      } catch {}
      createAuditLog(
        'container-clear-box',
        'container',
        container.id,
        {
          description: `Cleared all samples from container ${container.name} (${container.id})`,
          metadata: {
            containerId: container.id,
            containerName: container.name
          }
        },
        userId
      );
  userHasInteracted.current = true;
  setSamples([]);
      setSelectedSample(null);
      setSelectedPosition(null);
    }
  };

  const isAddingSample = viewMode === 'edit';

  return (
    <div className="flex h-full">
      {/* Main Content Area */}
      <div className="flex-1 p-6 space-y-6">
        {/* Action Bar */}
        <Card className="p-4">
          {/* Save Status Indicator */}
          <div className="mb-2 min-h-[24px]">
            {isSaving && (
              <span className="text-xs text-blue-600">Saving...</span>
            )}
            {saveStatus === 'saved' && !isSaving && (
              <span className="text-xs text-green-600">Saved</span>
            )}
            {saveStatus === 'error' && saveError && (
              <span className="text-xs text-red-600">{saveError}</span>
            )}
          </div>
          {/* Move Notification */}
          {moveNotification && (
            <Alert className="mb-4 border-blue-200 bg-blue-50">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Sample <strong>{moveNotification.sampleId}</strong> moved from position <strong>{moveNotification.from}</strong> to <strong>{moveNotification.to}</strong>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Scan Error Notification */}
          {scanError && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {scanError}
              </AlertDescription>
            </Alert>
          )}

          {/* Duplicate Policy Information */}
          {viewMode === 'edit' && (
            <Alert className="mb-4 border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Sample Movement Policy:</strong> {container.isArchived ? (
                  <>Archive containers allow duplicate sample IDs without restrictions. Scanning an existing sample ID will move it to the new position.</>
                ) : (
                  <>General population containers prevent duplicates but allow sample movement. Scanning an existing sample ID will automatically move it from its current location to the new position.</>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'view' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setViewMode('view');
                    setScannedBarcode('');
                    setUserInitials('');
                  }}
                >
                  View Mode
                </Button>
                <Button
                  variant={viewMode === 'edit' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('edit')}
                >
                  <Scan className="w-4 h-4 mr-2" />
                  Scan Mode
                </Button>
              </div>
              
              {viewMode === 'edit' && (
                <div className="flex items-center gap-2">
                  {/* Initials input removed, always use saga-user-initials */}
                  <Input
                    placeholder="Scan or enter sample ID"
                    value={scannedBarcode}
                    onChange={(e) => setScannedBarcode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleBarcodeSubmit()}
                    className="w-48"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleBarcodeSubmit} 
                    disabled={!scannedBarcode.trim() || !userInitials.trim()}
                  >
                    {samples.find(s => s.sampleId === scannedBarcode.trim()) ? 'Move Sample' : 'Add Sample'}
                  </Button>
                  {selectedSample && (
                    <Button 
                      variant="outline"
                      size="sm" 
                      onClick={() => {
                        if (!userInitials.trim()) {
                          toast.error('Please enter your initials before checking out samples.');
                          return;
                        }
                        handleCheckoutSample();
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Checkout
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClearBox}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Box
              </Button>
              <Button variant="outline" size="sm" onClick={() => setViewMode('edit')}>
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Box
              </Button>
            </div>
          </div>
        </Card>

        {/* Storage Grid */}
        <Card className="p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">{container.name} <span className="text-sm text-muted-foreground">({container.location})</span></h3>
            </div>
            {selectedPosition && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary bg-primary/20 rounded"></div>
                <span className="text-sm">Selected: {selectedPosition}</span>
              </div>
            )}
          </div>
          
          <div className="overflow-auto">
            <div className={`flex flex-col gap-1 ${dimensions.rows === 14 && dimensions.cols === 7 ? 'w-full' : 'w-fit min-w-full'}`}>
            {/* Column Headers */}
            {(() => {
              const isIDTRack = dimensions.rows === 14 && dimensions.cols === 7;
              if (isIDTRack) {
                // IDT: columns are letters A..G
                return (
                  <div className="flex gap-1 mb-2">
                    <div className={headerCellSize}></div>
                    {Array.from({ length: dimensions.cols }, (_, i) => (
                      <div key={i} className={`${headerCellSize} flex items-center justify-center font-medium ${fontSize}`}>
                        {String.fromCharCode(65 + i)}
                      </div>
                    ))}
                  </div>
                );
              }

              // Default: columns are numbers
              return (
                <div className="flex gap-1 mb-2">
                  <div className={headerCellSize}></div>
                  {Array.from({ length: dimensions.cols }, (_, i) => (
                    <div key={i} className={`${headerCellSize} flex items-center justify-center font-medium ${fontSize}`}>
                      {i + 1}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Grid Rows */}
            {Array.from({ length: dimensions.rows }).map((_, row) => {
              const isIDTRack = dimensions.rows === 14 && dimensions.cols === 7;
              const rowLabel = isIDTRack ? String(dimensions.rows - row) : String.fromCharCode(65 + row);
              return (
                <div key={row} className="flex gap-1">
                  <div className={`${headerCellSize} flex items-center justify-center font-medium ${fontSize}`}>
                    {rowLabel}
                  </div>

                  {Array.from({ length: dimensions.cols }).map((_, col) => {
                    const position = isIDTRack ? `${String.fromCharCode(65 + col)}${dimensions.rows - row}` : `${String.fromCharCode(65 + row)}${col + 1}`;
                    const gridItem = grid.find(item => item.position === position);
                    const sample = gridItem?.sample;
                    const isDisabled = gridItem?.isDisabled;
                    const isSelected = selectedPosition === position;
                    const isHighlighted = Boolean(sample && highlightSampleIds.includes(sample.sampleId));
                    const isArchivedCell = Boolean(sample && (sample.isArchived || (sample as any).is_archived));

                    return (
                      <div
                        key={position}
                        className={`${cellSize} border-2 rounded transition-all duration-200 flex items-center justify-center ${
                          isDisabled
                            ? 'bg-gray-800 border-gray-600 cursor-not-allowed opacity-50'
                            : sample
                              ? isHighlighted
                                ? 'bg-yellow-500 text-black border-yellow-600 cursor-pointer hover:scale-105'
                                : (isArchivedCell ? 'bg-blue-500/30 text-white/70 cursor-pointer hover:scale-105 filter grayscale opacity-70' : 'bg-blue-500 text-white cursor-pointer hover:scale-105')
                              : 'bg-gray-100 border-gray-300 hover:bg-gray-200 cursor-pointer hover:scale-105'
                        } ${isSelected ? 'ring-2 ring-primary' : ''} ${isHighlighted ? 'ring-2 ring-yellow-400' : ''}`}
                        onClick={() => !isDisabled && handlePositionClick(position, sample)}
                        title={
                          isDisabled
                            ? `Position ${position} disabled - DP Pools come in sets of 4 (effective capacity: 80)`
                            : sample
                              ? `${sample.sampleId}${isHighlighted ? ' (From Worklist)' : ''}`
                              : `Empty position ${position}`
                        }
                        >
                        {isDisabled ? (
                          <div className={`${fontSize} font-medium leading-tight text-center px-1 text-gray-400`}>
                            ✕
                          </div>
                        ) : sample ? (
                          <div className={`${fontSize} font-medium leading-tight text-center px-1 whitespace-nowrap relative`}>
                            {sample.sampleId}
                            {isArchivedCell && (
                              <span className="absolute -top-2 -right-2 bg-muted text-xs px-1 rounded border">arch</span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            </div>
          </div>
        </Card>
      </div>

      {/* Right Panel - Sample Details */}
      <div className="w-96 border-l bg-muted/30">
        {selectedSample ? (
          /* Sample History Panel */
          <div className="p-6 h-full flex flex-col">
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <h3>Sample Details</h3>
                {selectedSample && (
                  <div className="flex items-center gap-2">
                    {!selectedSample.isArchived ? (
                      <Button variant="ghost" size="sm" onClick={() => toggleArchiveForSelected(true)}>
                        Archive
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => toggleArchiveForSelected(false)}>
                        Unarchive
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div>
                    <label className="text-muted-foreground">Sample ID</label>
                    <p className="font-medium">{selectedSample.sampleId}</p>
                  </div>
                  <div>
                    <label className="text-muted-foreground">Position</label>
                    <p className="font-medium">{selectedSample.position}</p>
                  </div>
                  <div>
                    <label className="text-muted-foreground">Storage Date</label>
                    <p className="font-medium">{selectedSample.storageDate}</p>
                  </div>
                  <div>
                    <label className="text-muted-foreground">Archived</label>
                    <p className="font-medium">{selectedSample.isArchived ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <label className="text-muted-foreground">Last Accessed</label>
                    <div className="flex gap-2">
                      {/* Show only the action button that makes sense for current state */}
                      {!selectedSample.isArchived ? (
                        <Button variant="ghost" size="sm" className="w-1/2" onClick={() => toggleArchiveForSelected(true)}>
                          Archive
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="w-1/2" onClick={() => toggleArchiveForSelected(false)}>
                          Unarchive
                        </Button>
                      )}
                    </div>
                    {selectedSample.lastAccessed && (
                      <p className="font-medium">{selectedSample.lastAccessed}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex-1 mt-6">
              <h4 className="mb-4">Sample History ({sampleHistory.length} entries) {selectedSample.isArchived ? '(Archived)' : ''}</h4>
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  {sampleHistory.map((entry, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {entry.action === 'check-in' && <Calendar className="w-4 h-4 text-green-600" />}
                          {entry.action === 'check-out' && <Trash2 className="w-4 h-4 text-red-600" />}
                          {entry.action === 'moved' && <TestTube className="w-4 h-4 text-blue-600" />}
                          {entry.action === 'accessed' && <User className="w-4 h-4 text-orange-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm capitalize">{safeReplace(entry.action, '-', ' ')}</p>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {entry.user && (
                            <p className="text-sm text-muted-foreground">{entry.user}</p>
                          )}
                          {/* If this history entry recorded an archive/unarchive, surface it */}
                          {entry.notes && /archive/i.test(entry.notes) && (
                            <p className="text-sm text-muted-foreground">{entry.notes}</p>
                          )}
                          {entry.fromPosition && entry.toPosition && (
                            <p className="text-sm text-muted-foreground">
                              {entry.fromPosition} → {entry.toPosition}
                            </p>
                          )}
                          {entry.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{entry.notes}</p>
                          )}
                        </div>
                      </div>
                      {index < sampleHistory.length - 1 && <Separator />}
                    </div>
                  ))}
                  {sampleHistory.length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-muted-foreground">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No history available for this sample</p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="mt-6 space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
              if (!safeTrim(userInitials)) {
                    toast.error('Please enter your initials in scan mode to clear this position.');
                    return;
                  }
                  handleClearPosition();
                }}
                disabled={!selectedSample}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Position
              </Button>
            </div>
          </div>
        ) : (
          /* Default Panel */
          <div className="p-6 flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <TestTube className="w-12 h-12 mx-auto mb-4 opacity-50" />
              {viewMode === 'edit' ? (
                <div>
                  <p className="mb-2">Scan Mode Active</p>
                  <p className="text-sm">
                    {selectedPosition 
                      ? `Ready to add sample to position ${selectedPosition}` 
                      : 'Select a position or scan to add samples'
                    }
                  </p>
                </div>
              ) : (
                <div>
                  <p className="mb-2">Select a sample to view its details and history</p>
                    {isAddingSample && scannedBarcode.trim() !== '' && (
                    <div className="text-sm text-muted-foreground">
                      {samples.find(s => s.sampleId === scannedBarcode.trim()) ? (
                        <p>⚠️ Sample exists - will be moved to new position</p>
                      ) : (
                        <p>✓ New sample ready to add</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Overwrite Warning Dialog */}
      <Dialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Position Already Occupied
            </DialogTitle>
            <DialogDescription>
              Confirm whether you want to replace the existing sample in this position.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Position {targetPosition || selectedPosition} already contains a sample. 
                Do you want to replace the existing sample with the new one?
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverwriteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleOverwriteConfirm}>
              Replace Sample
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}