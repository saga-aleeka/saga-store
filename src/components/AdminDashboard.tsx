import React, { useState, useRef } from 'react';
import { SAMPLE_TYPES, getSampleTypeColor } from './PlasmaContainerList';
// Types for preview objects
interface Preview<T> {
  valid: boolean;
  data: T[];
  errors: string[];
}
import GridSnapshotView from './GridSnapshotView';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Upload, Download, FileText, AlertTriangle, CheckCircle, Database, ArrowLeft, Trash2 } from 'lucide-react';
import { Header } from './Header';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';

interface Container {
  id: string;
  name: string;
  location: string;
  containerType: string;
  sampleType: string;
  temperature: string;
}

export const AdminDashboard = ({ containers = [], onContainersChange, onExitAdmin }: { containers: Container[]; onContainersChange: (containers: Container[]) => void; onExitAdmin: () => void }) => {
  // Utility: Parse grid-style import template
  function parseGridImport(content: string) {
  console.log('--- Grid Import Debug Start ---');
    // Returns: { containers: Array<{rackId, containerName, location, samples: Array<{sampleId, position}>}> }
  const lines = content.split(/\r?\n/).map(l => l.trimEnd());
    const containers: any[] = [];
    let i = 0;
  while (i < lines.length) {
      // Find start of a block (must have 'Box Name:')
      if (lines[i] && lines[i].includes('Box Name:')) {
        console.log(`Parsing container block at line ${i}:`, lines[i]);
        // Parse header line: can be [rack, 'Box Name:', box] or ['', 'Box Name:', box]
  let parts = lines[i].includes(',') ? lines[i].split(',') : lines[i].split(/\t|\s{2,}/);
  parts = parts.map(p => (p || '').trim());
  console.log('Header parts:', parts);
        let rackId = parts[0] && !parts[0].includes('Box Name:') ? parts[0] : '';
        let containerName = '';
        // Find the part after 'Box Name:'
        const boxNameIdx = parts.findIndex(p => p.includes('Box Name:'));
        if (boxNameIdx !== -1 && parts.length > boxNameIdx + 1) {
          containerName = (parts[boxNameIdx + 1] || '').trim();
        } else if (parts.length > 2) {
          containerName = (parts[2] || '').trim();
        }
        let location = rackId || '';
        let samples: any[] = [];
        i++;
        // Skip empty lines
        while (i < lines.length && lines[i].trim() === '') i++;
        // Next line: column headers (should start with two empty columns, then numbers)
        const colHeaderLine = lines[i] || '';
        let colHeaders: string[] = [];
        if (colHeaderLine.includes(',')) {
          colHeaders = colHeaderLine.split(',').slice(2).map(h => (h || '').trim()).filter(Boolean);
        } else {
          colHeaders = colHeaderLine.split(/\t|\s{2,}/).slice(2).map(h => (h || '').trim()).filter(Boolean);
        }
        console.log('Column headers:', colHeaders);
        i++;
        // Parse all rows until next container or end of file
        while (i < lines.length && lines[i] && !lines[i].includes('Box Name:')) {
          let rowParts: string[] = [];
          if (lines[i].includes(',')) {
            rowParts = lines[i].split(',');
          } else {
            rowParts = lines[i].split(/\t|\s{2,}/);
          }
          rowParts = rowParts.map(cell => (cell || '').replace(/\u00A0/g, '').trim());
          console.log(`Row ${i} (${lines[i]}):`, rowParts);
          // Use first cell as row label if present, else use blank or row number
          // Detect offset: if first cell is empty and second is a single letter, use second as row label
          let rowLabel = rowParts[0] || String(i);
          let sampleStartIdx = 1;
          if (rowParts[0] === '' && /^[A-I]$/.test(rowParts[1] || '')) {
            rowLabel = rowParts[1];
            sampleStartIdx = 2;
          }
          const isRowHeader = /^[A-I]$/.test(rowLabel);
          for (let c = 0; c < colHeaders.length; c++) {
            let sampleId = rowParts[sampleStartIdx + c] || '';
            sampleId = sampleId.replace(/\u00A0/g, '').trim();
            // Never import the row header as a sample ID
            if (isRowHeader && c === 0 && sampleId === rowLabel) {
              // This is the row header, skip
              continue;
            }
            // Only allow row/column form for position (e.g., A1, B2)
            const colNum = colHeaders[c] || String(c + 1);
            const position = /^[A-I]$/.test(rowLabel) && /^\d+$/.test(colNum) ? `${rowLabel}${colNum}` : '';
            if (sampleId && position) {
              samples.push({
                sampleId,
                position,
                containerName, // preserve all characters and symbols
                location,
              });
              console.log(`Parsed sample: ${sampleId} at ${position} in ${containerName}`);
            } else if (rowParts[sampleStartIdx + c] && rowParts[sampleStartIdx + c].replace(/\u00A0/g, '').trim().length === 0 && rowParts[sampleStartIdx + c].length > 0) {
              console.log(`Skipped cell at ${rowLabel}${colNum}: only spaces/invisible chars`);
            } else {
              console.log(`Empty cell at ${rowLabel}${colNum}`);
            }
          }
          i++;
        }
        containers.push({
          rackId,
          containerName,
          location,
          samples,
        });
        console.log(`Parsed ${samples.length} samples for container ${containerName}`);
      } else {
        i++;
      }
    }
    console.log('--- Grid Import Debug End ---');
    return { containers };
  }

  const handleContainerFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        // Try to parse as grid import
        const parsed = parseGridImport(content);
        if (parsed.containers.length > 0) {
          // Preview for user
          setContainerPreview({ valid: true, data: parsed.containers, errors: [] });
          // Also set sample preview for all samples
          const allSamples = parsed.containers.flatMap(c => c.samples);
          setSamplePreview({ valid: true, data: allSamples, errors: [] });
        } else {
          setContainerPreview({ valid: false, data: [], errors: ['No containers found in grid import.'] });
        }
      };
      reader.readAsText(file);
    }
  };
  const [containerPreview, setContainerPreview] = useState<Preview<any> | null>(null);

  const handleSampleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result;
        console.log('Sample file content:', content);
        // Add logic to process the file content
      };
      reader.readAsText(file);
    }
  };
  const [samplePreview, setSamplePreview] = useState<Preview<any> | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState('');
  const containerFileRef = useRef(null);
  const sampleFileRef = useRef(null);

  const importSamples = () => {
    console.log('Importing samples...');
    // Example: Assume samplePreview.data is [{ containerName, sampleId, position }]
    if (!samplePreview || !samplePreview.valid) {
      alert('No valid sample data to import.');
      return;
    }
    // Map container names to IDs
    const nameToId: { [name: string]: string } = {};
    containers.forEach(c => {
      nameToId[c.name] = c.id;
    });
    let importedCount = 0;
    samplePreview.data.forEach((sample: any) => {
      const containerId = nameToId[sample.containerName];
      if (!containerId) {
        console.warn(`No container found for name: ${sample.containerName}`);
        return;
      }
      // Load samples for this container
      const storageKey = `samples-${containerId}`;
      let samples: Record<string, any> = {};
      const savedSamples = localStorage.getItem(storageKey);
      if (savedSamples) {
        samples = JSON.parse(savedSamples);
      }
      // Assign sample to position
      samples[sample.position] = { id: sample.sampleId, ...sample };
      localStorage.setItem(storageKey, JSON.stringify(samples));
      importedCount++;
    });
    alert(`Imported ${importedCount} samples by container name.`);
  };

  const importContainers = () => {
    if (!containerPreview || !containerPreview.valid) {
      alert('No valid container data to import.');
      return;
    }
    setIsImporting(true);
    setTimeout(() => {
      // For each container, create or update in saga-containers
      const savedContainers = JSON.parse(localStorage.getItem('saga-containers') || '[]');
      let containers = Array.isArray(savedContainers) ? savedContainers : [];
      let importedCount = 0;
      let retainedCount = 0;
      containerPreview.data.forEach((c: any) => {
        // Use containerName as unique name, location as location (preserve all input, including underscores/symbols)
        let existing = containers.find((x: any) => x.name === c.containerName);
        // Determine sampleType from containerName (case-insensitive keyword match)
        const nameLower = (c.containerName || '').toLowerCase();
        let sampleType = 'Unknown';
  if (nameLower.includes('dp pool') || nameLower.includes('dp_pools') || nameLower.includes('dp_pools') || nameLower.includes('dp')) sampleType = 'DP Pools';
  else if (nameLower.includes('cfdna')) sampleType = 'cfDNA Tubes';
  else if (nameLower.includes('dtc')) sampleType = 'DTC Tubes';
  else if (nameLower.includes('mnc')) sampleType = 'MNC Tubes';
  else if (nameLower.includes('pa pool') || nameLower.includes('pap')) sampleType = 'PA Pool Tubes';
  else if (nameLower.includes('plasma')) sampleType = 'Plasma Tubes';
  else if (nameLower.includes('bc')) sampleType = 'BC Tubes';
  else if (nameLower.includes('idt')) sampleType = 'IDT Plates';
        let type = c.samples.length === 25 ? '5x5-box' : '9x9-box';
        if (!existing) {
          existing = {
            id: `${c.containerName}_${Date.now()}`,
            name: c.containerName, // preserve exactly as input
            location: c.location,
            containerType: type,
            sampleType,
            temperature: '-80°C',
          };
          containers.push(existing);
        } else {
          // Update sampleType if needed
          existing.sampleType = sampleType;
        }
        // Save samples for this container
        const storageKey = `samples-${existing.id}`;
        let samples: Record<string, any> = {};
        // Load existing samples for this container (if any)
        const savedSamples = localStorage.getItem(storageKey);
        if (savedSamples) {
          try {
            samples = JSON.parse(savedSamples);
          } catch {}
        }
        c.samples.forEach((sample: any) => {
          // If a sample already exists at this position and has the same ID, retain it
          const existingSample = samples[sample.position];
          if (existingSample && existingSample.id === sample.sampleId) {
            retainedCount++;
            // Retain the existing sample object (including history)
            return;
          }
          // Otherwise, overwrite or add new
          samples[sample.position] = {
            id: sample.sampleId, // PlasmaBoxDashboard expects 'id' property
            position: sample.position,
            containerName: c.containerName,
            location: c.location,
            timestamp: new Date().toISOString(),
            history: [{
              timestamp: new Date().toISOString(),
              action: 'check-in',
              notes: `Imported from grid at position ${sample.position}`
            }]
          };
          importedCount++;
        });
        localStorage.setItem(storageKey, JSON.stringify(samples));
      });
      localStorage.setItem('saga-containers', JSON.stringify(containers));
      // Update containers state/UI after import
      if (typeof onContainersChange === 'function') {
        onContainersChange(containers);
      }
      setIsImporting(false);
      // Show confirmation dialog
      window.setTimeout(() => {
        window.confirm(`Import complete! ${importedCount} samples imported. ${retainedCount} samples retained in their original positions.\n\nClick OK to continue.`);
      }, 100);
    }, 100);
  };

  // Templates
  const containerTemplate = `name,location,containerType,sampleType,temperature\n"Plasma Box Alpha","Freezer A - Rack 1","5x5-box","DP Pools","-80°C"\n"cfDNA Storage Unit","Freezer B - Rack 2","9x9-box","cfDNA Tubes","-80°C"`;
  const gridTemplate = `cfDNA_RACK_001,Box Name:,cfDNA_BOX_001,,,,,,,,,,
,,1,2,3,4,5,6,7,8,9
,A,C00388cD010,C00395cD008,C00304cD005,C00397cD036,C00402cD006,C00411cD016,C00554cD002,C00405cD018,C00394cD016
,B,C00552cD001,C00394cD008,C00411cD014,C00375cD016,C00403cD006,C00386cD014,C00397cD014,C00403cD018,C00386cD018
,C,C00558cD004,C00853cD004,C00372cD014,C00394cD006,C00553cD001,C00553cD002,C00396cD014,C00402cD018,C00411cD016
,D,C00394cD010,C00400cD010,C00477cD016,C00398cD006,C00405cD006,C00386cD008,C00400cD014,C00304cD004,C00397cD008
,E,C00395cD010,C00487cD011,C00411cD010,C00336cD002,C00406cD006,C00553cD003,C00402cD014,C00400cD018,C00396cD008
,F,C00552cD002,C00402cD010,C00386cD006,C00397cD006,C00446cD018,C00640cD003,C00403cD014,C00396cD018,C00403cD008
,G,C00397cD010,C00403cD010,C00554cD001,C00396cD006,C00555cD002,C00336cD002,C00554cD003,C00397cD018,C00556cD019
,H,C00396cD010,C00552cD003,C00395cD036,C00400cD006,C00558cD006,C00394cD014,C00405cD014,C00416cD020,C00402cD008
,I,C00406cD010,C00405cD010,C00330cD004,C00487cD012,C00555cD001,C00395cD014,C00406cD014,C00395cD018,C00403cD008


PLASMA_RACK_001,Box Name:,PLASMA_BOX_001,,,,,

,,1,2,3,4,5
,A,C03001PL1A,C03002PL2A,C03003PL3A,C03004PL4A,C03005PL5A
,B,C03006PL6A,C03007PL7A,C03008PL8A,C03009PL9A,C03010PL10A
,C,C03011PL11A,C03012PL12A,C03013PL13A,C03014PL14A,C03015PL15A
,D,C03016PL16A,C03017PL17A,C03018PL18A,C03019PL19A,C03020PL20A
,E,C03021PL21A,C03022PL22A,C03023PL23A,C03024PL24A,C03025PL25A


DP_POOL_RACK_001,Box Name:,DP_POOL_BOX_001,,,,,,,,,,
,,1,2,3,4,5,6,7,8,9
,A,C01039DPP1B,C01040DPP2B,C01041DPP3B,C01042DPP4B,C01043DPP5B,C01044DPP6B,C01045DPP7B,C01046DPP8B,C01047DPP9B
,B,C01048DPP10B,C01049DPP11B,C01050DPP12B,C01051DPP13B,C01052DPP14B,C01053DPP15B,C01054DPP16B,C01055DPP17B,C01056DPP18B
,C,C01057DPP19B,C01058DPP20B,C01059DPP21B,C01060DPP22B,C01061DPP23B,C01062DPP24B,C01063DPP25B,C01064DPP26B,C01065DPP27B`;

  const sampleTemplate = `containerName,sampleId,position
"cfDNA_BOX_001","C01039DPP1B","A1"
"cfDNA_BOX_001","C01040DPP2B","A2"`;

  // Helper: Export containers as CSV
  const exportContainers = () => {
    const csvContent = [
      'name,location,containerType,sampleType,temperature',
      ...containers.map(c => `"${c.name}","${c.location}","${c.containerType}","${c.sampleType}","${c.temperature}"`)
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'containers-export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Helper: Manual backup
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
  console.log('[SNAPSHOT] Manual backup: writing to', backupKey, backupData);
  localStorage.setItem(backupKey, JSON.stringify(backupData));
    alert('Manual backup completed. This will be overwritten at the next 2am snapshot.');
  };

  // Helper: Download snapshot as CSV
  const handleDownloadSnapshot = () => {
    const today = new Date().toISOString().slice(0, 10);
    const backupKey = `nightly-backup-${today}`;
    const backupDataRaw = localStorage.getItem(backupKey);
    if (!backupDataRaw) {
      alert('No snapshot found for today.');
      return;
    }
    // Parse backupDataRaw and convert to grid CSV format
    const backupData = JSON.parse(backupDataRaw);
    // For each container, output grid: rack, Box Name:, box, then column headers, then grid rows
    let csvSections: string[] = [];
    backupData.forEach((entry: any) => {
      const c = entry.container;
      const samples = Array.isArray(entry.samples)
        ? entry.samples
        : Object.entries(entry.samples || {}).map(([position, sample]: [string, any]) => ({ ...sample, position }));

      // Try to extract rack from location, fallback to blank
      let rack = c.location || '';
      // Use container name as box
      let box = c.name || '';

      // Determine grid size and columns/rows
      let columns: string[] = [];
      let rows: string[] = [];
      if (c.containerType === '5x5-box') {
        columns = ['1','2','3','4','5'];
        rows = ['A','B','C','D','E'];
      } else if (c.containerType === '9x9-box') {
        columns = ['1','2','3','4','5','6','7','8','9'];
        rows = ['A','B','C','D','E','F','G','H','I'];
      } else {
        // Fallback: detect from sample positions
        const allPositions = samples.map((s: any) => s.position).filter((p: any): p is string => typeof p === 'string' && p.length > 1);
        const colSet = new Set<string>();
        const rowSet = new Set<string>();
        allPositions.forEach((p: string) => {
          if (p.length > 1) {
            rowSet.add(p[0]);
            colSet.add(p.slice(1));
          }
        });
        columns = Array.from(colSet).sort((a,b) => Number(a)-Number(b));
        rows = Array.from(rowSet).sort();
      }

      // Header: rack, Box Name:, box, then fill to grid width
      const header = [rack, 'Box Name:', box, ...Array(columns.length).fill('')];
      csvSections.push(header.join(','));
      // Second row: two blanks, then column numbers
      csvSections.push([ '', '', ...columns ].join(','));
      // Each row: row label, then sample IDs for each column
      rows.forEach(rowLabel => {
        const row = [rowLabel];
        columns.forEach(colNum => {
          const pos = `${rowLabel}${colNum}`;
          const sample = samples.find((s: any) => s.position === pos);
          row.push(sample ? sample.id || sample.sampleId : '');
        });
        csvSections.push([ '', ...row ].join(','));
      });
      // Blank line between containers
      csvSections.push('');
    });
    const csvContent = csvSections.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshot-grid-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper: Export samples as CSV
  const exportSamples = () => {
    let rows = ['containerId,sampleId,position'];
    containers.forEach(container => {
      const storageKey = `samples-${container.id}`;
      const savedSamples = localStorage.getItem(storageKey);
      if (savedSamples) {
        const samples = JSON.parse(savedSamples);
        Object.entries(samples).forEach(([position, sample]) => {
          const typedSample = sample as { id: string }; // Cast sample to the expected type
          rows.push(`"${container.id}","${typedSample.id}","${position}"`);
        });
      }
    });
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'samples-export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const [showClearDialog, setShowClearDialog] = useState(false);
  // Add sample type filter state for export tab
  const [filteredSampleType, setFilteredSampleType] = useState<string>('All');

  return (
    <div className="p-6 min-h-screen bg-background">
      <div className="max-w-6xl mx-auto">
        <Header 
          actions={
            <>
              <Badge variant="destructive">Admin Only</Badge>
              <Button variant="outline" onClick={onExitAdmin}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Exit Admin Mode
              </Button>
            </>
          }
        />
        <Tabs defaultValue="import" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
          </TabsList>
          <TabsContent value="import" className="space-y-6">
            {/* Import Containers Card */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  <h3>Import Containers</h3>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="containerFile">Upload Container CSV</Label>
                  <Input
                    ref={containerFileRef}
                    id="containerFile"
                    type="file"
                    accept=".csv"
                    onChange={handleContainerFileUpload}
                  />
                  <p className="text-xs text-muted-foreground">
                    Grid format auto-detects sample type from rack ID (e.g., cfDNA_RACK_001 → cfDNA Tubes) and container size from sample type (Plasma → 5x5 box, others → 9x9 box). Imports containers AND samples together.
                  </p>
                </div>
                <Tabs defaultValue="grid" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="grid">Grid Format</TabsTrigger>
                    <TabsTrigger value="standard">Standard CSV</TabsTrigger>
                  </TabsList>
                  <TabsContent value="grid" className="space-y-2">
                    <Label>Grid CSV Template (Your Format)</Label>
                    <Textarea
                      value={gridTemplate}
                      readOnly
                      className="font-mono text-xs h-32"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const blob = new Blob([gridTemplate], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'grid-template.csv';
                        a.click();
                        window.URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Grid Template
                    </Button>
                  </TabsContent>
                  <TabsContent value="standard" className="space-y-2">
                    <Label>Standard CSV Template</Label>
                    <Textarea
                      value={containerTemplate}
                      readOnly
                      className="font-mono text-xs h-20"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const blob = new Blob([containerTemplate], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'container-template.csv';
                        a.click();
                        window.URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Standard Template
                    </Button>
                  </TabsContent>
                </Tabs>
                {containerPreview && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {containerPreview.valid ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-sm">
                        {containerPreview.valid 
                          ? `${containerPreview.data.length} containers ready to import`
                          : `${containerPreview.errors.length} errors found`
                        }
                      </span>
                    </div>
                    {samplePreview && samplePreview.data.length > 0 && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-blue-600">
                          + {samplePreview.data.length} samples detected in grid
                        </span>
                      </div>
                    )}
                    {!containerPreview.valid && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <ul className="list-disc list-inside space-y-1">
                            {containerPreview.errors.map((error: string, index: number) => (
                              <li key={index} className="text-xs">{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    {containerPreview.valid && (
                      <div className="space-y-2">
                        <Button 
                          onClick={importContainers}
                          disabled={isImporting}
                          className="w-full"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {isImporting ? 'Importing...' : `Import All (Containers + Samples)`}
                        </Button>
                        <p className="text-xs text-blue-700 text-center font-semibold">
                          This will import <b>all containers and all samples</b> from the grid file in one step.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
            {/* Import Samples Card */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  <h3>Import Samples</h3>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="sampleFile">Upload Sample CSV</Label>
                  <Input
                    ref={sampleFileRef}
                    id="sampleFile"
                    type="file"
                    accept=".csv"
                    onChange={handleSampleFileUpload}
                  />
                  <p className="text-xs text-muted-foreground">
                    CSV format: containerId, sampleId, position
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>CSV Template</Label>
                  <Textarea
                    value={sampleTemplate}
                    readOnly
                    className="font-mono text-xs h-16"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob([sampleTemplate], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'sample-template.csv';
                      a.click();
                      window.URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                </div>
                {samplePreview && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {samplePreview.valid ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-sm">
                        {samplePreview.valid 
                          ? `${samplePreview.data.length} samples ready to import`
                          : `${samplePreview.errors.length} errors found`
                        }
                      </span>
                    </div>
                    {!samplePreview.valid && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <ul className="list-disc list-inside space-y-1">
                            {samplePreview.errors.map((error: string, index: number) => (
                              <li key={index} className="text-xs">{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    {samplePreview.valid && (
                      <Button 
                        onClick={importSamples}
                        disabled={isImporting}
                        className="w-full"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {isImporting ? 'Importing...' : 'Import Samples'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
          <TabsContent value="export" className="space-y-6">
            <Card className="p-6">
              <div className="space-y-4">
                <h3>Export & Backup Data</h3>
                <p className="text-sm text-muted-foreground">
                  Download your current container and sample data, or perform a manual backup of the current state. Manual backup will be overwritten at the next 2am snapshot.
                </p>
                {/* Show last snapshot date/time */}
                {(() => {
                  // Find the latest nightly-backup key in localStorage
                  const backupKeys = Object.keys(localStorage).filter(k => k.startsWith('nightly-backup-'));
                  if (backupKeys.length === 0) return null;
                  // Sort by date descending
                  const latestKey = backupKeys.sort().reverse()[0];
                  // Extract date from key
                  const dateStr = latestKey.replace('nightly-backup-', '');
                  // Try to get the time from the backup data if available
                  let timeStr = '';
                  try {
                    const backupData = JSON.parse(localStorage.getItem(latestKey) || 'null');
                    if (Array.isArray(backupData) && backupData.length > 0 && backupData[0].timestamp) {
                      // Use the timestamp from the first container if present
                      timeStr = backupData[0].timestamp;
                    }
                  } catch {}
                  return (
                    <div className="text-xs text-muted-foreground">
                      Last snapshot: <b>{dateStr}</b>{timeStr ? `, time: ${timeStr}` : ''}
                    </div>
                  );
                })()}
                <div className="flex gap-4 flex-wrap">
                  <Button onClick={handleManualBackup}>
                    <Database className="w-4 h-4 mr-2" />
                    Manual Backup
                  </Button>
                  {/* Download button, only enabled if grid view is filtered to one sample type */}
                  <Button
                    onClick={handleDownloadSnapshot}
                    disabled={filteredSampleType === null || filteredSampleType === 'All'}
                    variant="outline"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </Card>
            <Card className="p-6 mt-6">
              <h3 className="mb-4">Snapshot Grid View</h3>
              {/* Sample type filter UI */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-muted-foreground">Filter by sample type:</span>
                <Button
                  variant={filteredSampleType === 'All' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilteredSampleType('All')}
                >
                  All Types
                </Button>
                {SAMPLE_TYPES.map((sampleType: string) => (
                  <Button
                    key={sampleType}
                    variant={filteredSampleType === sampleType ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilteredSampleType(sampleType)}
                    className={filteredSampleType === sampleType ? '' : getSampleTypeColor(sampleType as any)}
                  >
                    {sampleType}
                  </Button>
                ))}
              </div>
              <GridSnapshotView
                containers={(() => {
                  // Use snapshot data if available
                  const today = new Date().toISOString().slice(0, 10);
                  const backupKey = `nightly-backup-${today}`;
                  const backupDataRaw = localStorage.getItem(backupKey);
                  if (!backupDataRaw) {
                    // fallback to live containers if no snapshot
                    return containers
                      .filter(container => filteredSampleType === 'All' || container.sampleType === filteredSampleType)
                      .map(container => {
                        const storageKey = `samples-${container.id}`;
                        const savedSamples = localStorage.getItem(storageKey);
                        let samples = [];
                        if (savedSamples) {
                          try {
                            samples = Object.entries(JSON.parse(savedSamples)).map(([position, sample]: [string, any]) => ({
                              ...sample,
                              position,
                            }));
                          } catch (e) {}
                        }
                        return {
                          ...container,
                          samples,
                        };
                      });
                  }
                  // Parse snapshot backup data
                  let backupData = [];
                  try {
                    backupData = JSON.parse(backupDataRaw);
                  } catch {}
                  return backupData
                    .map((entry: any) => {
                      const c = entry.container;
                      let samples = [];
                      if (Array.isArray(entry.samples)) {
                        samples = entry.samples;
                      } else if (entry.samples && typeof entry.samples === 'object') {
                        samples = Object.entries(entry.samples).map(([position, sample]: [string, any]) => ({
                          ...sample,
                          position,
                        }));
                      }
                      return {
                        ...c,
                        samples,
                      };
                    })
                    .filter((container: any) => filteredSampleType === 'All' || container.sampleType === filteredSampleType);
                })()}
                onConvert={(container) => {
                  // Overwrite the container's samples in localStorage and update dashboard
                  const storageKey = `samples-${container.id}`;
                  // Build a map of position -> sample (removing any extra fields)
                  const sampleMap: Record<string, any> = {};
                  container.samples.forEach(s => {
                    sampleMap[s.position] = { id: s.id || s.sampleId };
                  });
                  localStorage.setItem(storageKey, JSON.stringify(sampleMap));
                  // Optionally update the container list if needed
                  if (typeof onContainersChange === 'function') {
                    // Re-read all containers and their samples
                    const updated = containers.map(c => {
                      if (c.id === container.id) {
                        return {
                          ...c,
                          samples: container.samples,
                        };
                      }
                      return c;
                    });
                    onContainersChange(updated);
                  }
                  alert('Container has been converted and updated from snapshot.');
                }}
              />
            </Card>
          </TabsContent>
          <TabsContent value="manage" className="space-y-6">
            <Card className="p-6">
              <div className="space-y-4">
                <h3>Danger Zone</h3>
                <p className="text-sm text-muted-foreground">
                  This will permanently delete all containers and samples from the database. This action cannot be undone.
                </p>
                <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                  <DialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear All Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Data Deletion</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete <b>ALL</b> containers and samples? This cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowClearDialog(false)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={() => {
                        Object.keys(localStorage).forEach(key => {
                          if (key.startsWith('samples-') || key.startsWith('nightly-backup-')) {
                            localStorage.removeItem(key);
                          }
                        });
                        if (typeof onContainersChange === 'function') onContainersChange([]);
                        setShowClearDialog(false);
                        alert('All data cleared.');
                      }}>
                        Yes, Delete Everything
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};