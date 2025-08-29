import React, { useState, useRef } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  Upload, 
  Download, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Settings, 
  Database,
  Trash2,
  ArrowLeft 
} from 'lucide-react';
import { PlasmaContainer, ContainerType, SampleType, getGridDimensions } from './PlasmaContainerList';
import { Header } from './Header';

interface AdminDashboardProps {
  onExitAdmin: () => void;
  containers: PlasmaContainer[];
  onContainersChange: (containers: PlasmaContainer[]) => void;
  userId?: string;
  userName?: string;
  currentUser?: { initials: string };
  broadcastSampleUpdate?: (containerId: string, samples: any) => void;
  broadcastUserActivity?: (activity: any) => void;
  lockContainer?: (containerId: string) => Promise<void>;
  unlockContainer?: (containerId: string) => Promise<void>;
  isContainerLocked?: (containerId: string) => boolean;
  lockedContainers?: Map<string, { userId: string; userName: string }>;
  userActivities?: any[];
  isOnline?: boolean;
  databaseStatus?: string;
}

interface ImportPreview {
  valid: boolean;
  errors: string[];
  data: any[];
}

const STORAGE_KEY = 'plasma-containers';

export function AdminDashboard({ onExitAdmin, containers, onContainersChange }: AdminDashboardProps) {
  const [containerPreview, setContainerPreview] = useState<ImportPreview | null>(null);
  const [samplePreview, setSamplePreview] = useState<ImportPreview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<string | null>(null);
  
  const containerFileRef = useRef<HTMLInputElement>(null);
  const sampleFileRef = useRef<HTMLInputElement>(null);

  const validateContainerData = (data: any[]): ImportPreview => {
    const errors: string[] = [];
    const validData: any[] = [];

    const validContainerTypes: ContainerType[] = ['9x9-box', '5x5-box', '5x4-rack', '9x9-rack'];
    const validSampleTypes: SampleType[] = ['DP Pools', 'cfDNA Tubes', 'DTC Tubes', 'MNC Tubes', 'PA Pool Tubes', 'Plasma Tubes', 'BC Tubes'];

    data.forEach((row, index) => {
      const rowErrors: string[] = [];
      
      if (!row.name || typeof row.name !== 'string') {
        rowErrors.push(`Row ${index + 1}: Missing or invalid name`);
      }
      
      if (!row.location || typeof row.location !== 'string') {
        rowErrors.push(`Row ${index + 1}: Missing or invalid location`);
      }
      
      if (!row.containerType || !validContainerTypes.includes(row.containerType)) {
        rowErrors.push(`Row ${index + 1}: Invalid container type. Must be one of: ${validContainerTypes.join(', ')}`);
      }
      
      if (!row.sampleType || !validSampleTypes.includes(row.sampleType)) {
        rowErrors.push(`Row ${index + 1}: Invalid sample type. Must be one of: ${validSampleTypes.join(', ')}`);
      }
      
      if (!row.temperature) {
        row.temperature = '-80°C'; // Default temperature
      }

      if (rowErrors.length === 0) {
        validData.push({
          ...row,
          totalSlots: getGridDimensions(row.containerType, row.sampleType).total
        });
      } else {
        errors.push(...rowErrors);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      data: validData
    };
  };

  const validateSampleData = (data: any[]): ImportPreview => {
    const errors: string[] = [];
    const validData: any[] = [];

    data.forEach((row, index) => {
      const rowErrors: string[] = [];
      
      if (!row.containerId || typeof row.containerId !== 'string') {
        rowErrors.push(`Row ${index + 1}: Missing or invalid container ID`);
      }
      
      if (!row.sampleId || typeof row.sampleId !== 'string') {
        rowErrors.push(`Row ${index + 1}: Missing or invalid sample ID`);
      }
      
      if (!row.position || typeof row.position !== 'string') {
        rowErrors.push(`Row ${index + 1}: Missing or invalid position (e.g., A1, B2)`);
      }

      // Validate position format (letter + number)
      if (row.position && !/^[A-Z][0-9]+$/.test(row.position)) {
        rowErrors.push(`Row ${index + 1}: Invalid position format. Use format like A1, B2, etc.`);
      }

      if (rowErrors.length === 0) {
        validData.push(row);
      } else {
        errors.push(...rowErrors);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      data: validData
    };
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
    
    return data;
  };

  // Helper function to detect sample type from rack ID
  const detectSampleTypeFromRackId = (rackId: string): SampleType => {
    const normalizedRackId = rackId.toUpperCase();
    
    if (normalizedRackId.includes('CFDNA')) return 'cfDNA Tubes';
    if (normalizedRackId.includes('DP_POOL') || normalizedRackId.includes('DP') || normalizedRackId.includes('DPPOOL')) return 'DP Pools';
    if (normalizedRackId.includes('DTC')) return 'DTC Tubes';
    if (normalizedRackId.includes('MNC')) return 'MNC Tubes';
    if (normalizedRackId.includes('PA_POOL') || normalizedRackId.includes('PA') || normalizedRackId.includes('PAPOOL')) return 'PA Pool Tubes';
    if (normalizedRackId.includes('PLASMA')) return 'Plasma Tubes';
    if (normalizedRackId.includes('BC')) return 'BC Tubes';
    
    // Default fallback
    return 'DP Pools';
  };

  // Helper function to detect container type from sample type
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

  const parseGridCSV = (text: string): { containers: any[], samples: any[] } => {
    const lines = text.split('\n');
    if (lines.length === 0) return { containers: [], samples: [] };
    
    const containers: any[] = [];
    const samples: any[] = [];
    let currentContainer: any = null;
    let columnHeaders: string[] = [];
    let isParsingGrid = false;
    let gridRowLabels: string[] = [];
    let gridSamples: Array<{ position: string; sampleId: string }> = [];
    
    lines.forEach((line, lineIndex) => {
      const cells = line.split(',').map(c => c.trim().replace(/"/g, ''));
      
      // Skip completely empty lines
      if (cells.length === 1 && cells[0] === '') {
        return;
      }
      
      // Check if this is a container header line (original 3-column format: RackID, "Box Name:", BoxName)
      if (cells.length >= 3 && cells[1] === 'Box Name:' && cells[0] && cells[2] && !isParsingGrid) {
        const rackId = cells[0];
        const containerName = cells[2];
        
        if (containerName && rackId) {
          // Auto-detect sample type from rack ID
          const detectedSampleType = detectSampleTypeFromRackId(rackId);
          
          currentContainer = {
            name: containerName,
            location: `${rackId} - Imported Location`, // Include rack info in location
            sampleType: detectedSampleType,
            temperature: '-80°C',
            rackId: rackId // Store for reference
          };
          
          // Reset grid parsing variables
          isParsingGrid = false;
          columnHeaders = [];
          gridRowLabels = [];
          gridSamples = [];
        }
        return;
      }
      
      // Check if this is column headers (empty first two cells, then numbers)
      if (cells[0] === '' && cells[1] === '' && cells[2] && /^\d+$/.test(cells[2])) {
        columnHeaders = cells.slice(2).filter(c => c && /^\d+$/.test(c));
        isParsingGrid = true;
        return;
      }
      
      // Parse sample grid rows (empty first cell, letter in second cell, then sample IDs)
      if (isParsingGrid && cells[0] === '' && cells[1] && /^[A-I]$/.test(cells[1]) && currentContainer) {
        const rowLetter = cells[1];
        gridRowLabels.push(rowLetter);
        
        cells.slice(2).forEach((sampleId, colIndex) => {
          if (sampleId && sampleId.trim() && colIndex < columnHeaders.length) {
            const position = `${rowLetter}${columnHeaders[colIndex]}`;
            gridSamples.push({
              position: position,
              sampleId: sampleId.trim()
            });
          }
        });
        return;
      }
      
      // Reset grid parsing when we hit multiple empty cells (end of grid section)
      if (cells.every(c => !c.trim()) && isParsingGrid) {
        // Finalize the current container with auto-detected container type
        if (currentContainer && columnHeaders.length > 0 && gridRowLabels.length > 0) {
          // Auto-detect container type from sample type
          const detectedContainerType = detectContainerTypeFromSampleType(currentContainer.sampleType);
          
          // Complete the container object
          const finalContainer = {
            ...currentContainer,
            containerType: detectedContainerType
          };
          
          containers.push(finalContainer);
          
          // Add all samples for this container
          gridSamples.forEach(gridSample => {
            samples.push({
              containerId: currentContainer.name,
              sampleId: gridSample.sampleId,
              position: gridSample.position
            });
          });
        }
        
        isParsingGrid = false;
        currentContainer = null;
        columnHeaders = [];
        gridRowLabels = [];
        gridSamples = [];
      }
    });
    
    // Handle case where file ends without empty lines (finalize last container)
    if (currentContainer && columnHeaders.length > 0 && gridRowLabels.length > 0) {
      // Auto-detect container type from sample type
      const detectedContainerType = detectContainerTypeFromSampleType(currentContainer.sampleType);
      
      const finalContainer = {
        ...currentContainer,
        containerType: detectedContainerType
      };
      
      containers.push(finalContainer);
      
      gridSamples.forEach(gridSample => {
        samples.push({
          containerId: currentContainer.name,
          sampleId: gridSample.sampleId,
          position: gridSample.position
        });
      });
    }
    
    return { containers, samples };
  };

  const handleContainerFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        
        // Try to parse as grid format first
        const gridData = parseGridCSV(text);
        if (gridData.containers.length > 0) {
          const preview = validateContainerData(gridData.containers);
          setContainerPreview(preview);
          
          // Also set sample preview if samples were found
          if (gridData.samples.length > 0) {
            const samplePreview = validateSampleData(gridData.samples);
            setSamplePreview(samplePreview);
          }
        } else {
          // Fallback to standard CSV format
          const data = parseCSV(text);
          const preview = validateContainerData(data);
          setContainerPreview(preview);
        }
      } catch (error) {
        setContainerPreview({
          valid: false,
          errors: ['Failed to parse CSV file'],
          data: []
        });
      }
    };
    reader.readAsText(file);
  };

  const handleSampleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseCSV(text);
        const preview = validateSampleData(data);
        setSamplePreview(preview);
      } catch (error) {
        setSamplePreview({
          valid: false,
          errors: ['Failed to parse CSV file'],
          data: []
        });
      }
    };
    reader.readAsText(file);
  };

  const importContainers = async () => {
    if (!containerPreview?.valid || !containerPreview.data.length) return;

    setIsImporting(true);
    try {
      const newContainers: PlasmaContainer[] = containerPreview.data.map((data, index) => ({
        id: `PB${String(containers.length + index + 1).padStart(3, '0')}`,
        name: data.name,
        location: data.location,
        containerType: data.containerType,
        sampleType: data.sampleType,
        temperature: data.temperature,
        totalSlots: getGridDimensions(data.containerType, data.sampleType).total,
        occupiedSlots: 0,
        lastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' ')
      }));

      const updatedContainers = [...containers, ...newContainers];
      onContainersChange(updatedContainers);
      
      // Also import associated samples if they exist
      let sampleCount = 0;
      if (samplePreview?.valid && samplePreview.data.length > 0) {
        // Group samples by container name
        const samplesByContainer = samplePreview.data.reduce((acc, sample) => {
          if (!acc[sample.containerId]) {
            acc[sample.containerId] = [];
          }
          acc[sample.containerId].push(sample);
          return acc;
        }, {} as Record<string, any[]>);

        // Import samples for each new container
        Object.keys(samplesByContainer).forEach(containerName => {
          const containerSamples = samplesByContainer[containerName];
          
          // Find the newly created container
          const container = newContainers.find(c => c.name === containerName);
          
          if (container) {
            const containerKey = `samples-${container.id}`;
            const currentSamples: Record<string, any> = {};
            
            // Add samples
            containerSamples.forEach(sample => {
              currentSamples[sample.position] = {
                id: sample.sampleId,
                timestamp: new Date().toISOString()
              };
              sampleCount++;
            });
            
            // Save samples
            localStorage.setItem(containerKey, JSON.stringify(currentSamples));
            
            // Update container occupied slots
            container.occupiedSlots = Object.keys(currentSamples).length;
          }
        });

        // Container state is already updated via onContainersChange above
      }
      
      const resultMessage = sampleCount > 0 
        ? `Successfully imported ${newContainers.length} containers with ${sampleCount} samples`
        : `Successfully imported ${newContainers.length} containers`;
      
      setImportResults(resultMessage);
      setContainerPreview(null);
      setSamplePreview(null);
      if (containerFileRef.current) containerFileRef.current.value = '';
    } catch (error) {
      setImportResults('Failed to import containers');
    } finally {
      setIsImporting(false);
    }
  };

  const importSamples = async () => {
    if (!samplePreview?.valid || !samplePreview.data.length) return;

    setIsImporting(true);
    try {
      // Use current containers from props
      const existingContainers: PlasmaContainer[] = [...containers];
      
      // Group samples by container
      const samplesByContainer = samplePreview.data.reduce((acc, sample) => {
        if (!acc[sample.containerId]) {
          acc[sample.containerId] = [];
        }
        acc[sample.containerId].push(sample);
        return acc;
      }, {} as Record<string, any[]>);

      let importedSamples = 0;
      
      // Update each container with its samples
      Object.keys(samplesByContainer).forEach(containerName => {
        const containerSamples = samplesByContainer[containerName];
        
        // Find matching container (by name or ID)
        const container = existingContainers.find(c => 
          c.name === containerName || c.id === containerName
        );
        
        if (container) {
          // Load existing samples for this container
          const containerKey = `samples-${container.id}`;
          const existingSamples = localStorage.getItem(containerKey);
          const currentSamples = existingSamples ? JSON.parse(existingSamples) : {};
          
          // Add new samples
          containerSamples.forEach(sample => {
            currentSamples[sample.position] = {
              id: sample.sampleId,
              timestamp: new Date().toISOString()
            };
            importedSamples++;
          });
          
          // Save updated samples
          localStorage.setItem(containerKey, JSON.stringify(currentSamples));
          
          // Update container occupied slots
          container.occupiedSlots = Object.keys(currentSamples).length;
        }
      });

      // Update containers through props
      onContainersChange(existingContainers);
      
      setImportResults(`Successfully imported ${importedSamples} samples into ${Object.keys(samplesByContainer).length} containers`);
      setSamplePreview(null);
      if (sampleFileRef.current) sampleFileRef.current.value = '';
    } catch (error) {
      setImportResults('Failed to import samples');
    } finally {
      setIsImporting(false);
    }
  };

  const clearAllData = () => {
    if (confirm('Are you sure you want to delete ALL containers and samples? This cannot be undone.')) {
      // Clear all sample data
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('samples-')) {
          localStorage.removeItem(key);
        }
      });
      onContainersChange([]);
      setImportResults('All data cleared');
    }
  };

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

  const containerTemplate = `name,location,containerType,sampleType,temperature
"Plasma Box Alpha","Freezer A - Rack 1","5x5-box","DP Pools","-80°C"
"cfDNA Storage Unit","Freezer B - Rack 2","9x9-box","cfDNA Tubes","-80°C"`;

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

  const sampleTemplate = `containerId,sampleId,position
"PB001","C01039DPP1B","A1"
"PB001","C01040DPP2B","A2"`;

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

        {importResults && (
          <Alert className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{importResults}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="import" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="import">Mass Import</TabsTrigger>
            <TabsTrigger value="export">Export Data</TabsTrigger>
            <TabsTrigger value="manage">Data Management</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Container Import */}
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
                              {containerPreview.errors.map((error, index) => (
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
                            {isImporting ? 'Importing...' : 
                              samplePreview && samplePreview.data.length > 0 
                                ? `Import ${containerPreview.data.length} Containers + ${samplePreview.data.length} Samples`
                                : `Import ${containerPreview.data.length} Containers`
                            }
                          </Button>
                          
                          {samplePreview && samplePreview.data.length > 0 && (
                            <p className="text-xs text-muted-foreground text-center">
                              ✨ Samples from grid will be imported automatically with containers
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              {/* Sample Import */}
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
                              {samplePreview.errors.map((error, index) => (
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
            </div>
          </TabsContent>

          <TabsContent value="export" className="space-y-6">
            <Card className="p-6">
              <div className="space-y-4">
                <h3>Export Current Data</h3>
                <p className="text-sm text-muted-foreground">
                  Download your current container and sample data for backup or analysis.
                </p>
                
                <div className="flex gap-4">
                  <Button onClick={exportContainers} disabled={containers.length === 0}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Containers ({containers.length})
                  </Button>
                  <Button disabled>
                    <Download className="w-4 h-4 mr-2" />
                    Export Samples (Coming Soon)
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="manage" className="space-y-6">
            <Card className="p-6">
              <div className="space-y-4">
                <h3>Data Management</h3>
                <p className="text-sm text-muted-foreground">
                  Manage and maintain your storage system data.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4>Current Containers</h4>
                      <p className="text-sm text-muted-foreground">
                        {containers.length} containers in system
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg border-red-200">
                    <div>
                      <h4 className="text-red-800">Danger Zone</h4>
                      <p className="text-sm text-red-600">
                        Permanently delete all containers and samples
                      </p>
                    </div>
                    <Button variant="destructive" onClick={clearAllData}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear All Data
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}