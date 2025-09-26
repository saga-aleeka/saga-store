


// Removed unused string to fix the error
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Header } from './Header';
import { ArrowLeft } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { WorklistUpload } from './WorklistUpload';
// ...other imports as needed
  // Stub for onExitAdmin if not provided
  const onExitAdmin = () => { window.location.reload(); };

// --- Snapshot/Save File Logic ---
type ContainerSnapshot = {
  id: string;
  name: string;
  location: string;
  containerType: string;
  sampleType: string;
  temperature: string;
};
type SampleSnapshot = {
  containerId: string;
  sampleId: string;
  position: string;
};
type SaveFile = {
  containers: ContainerSnapshot[];
  samples: SampleSnapshot[];
  savedAt: string; // ISO timestamp
};
function getSampleTypes(containers: Array<{ sampleType: string }>) {
  return Array.from(new Set(containers.map(c => c.sampleType)));
}
function getSnapshotKey(sampleType: string) {
  return `snapshot-${sampleType}`;
}
function createSaveFileForSampleType(sampleType: string, containers: any[]) {
  const relevantContainers = containers.filter(c => c.sampleType === sampleType);
  const containerSnaps: ContainerSnapshot[] = relevantContainers.map(c => ({
    id: c.id,
    name: c.name,
    location: c.location,
    containerType: c.containerType,
    sampleType: c.sampleType,
    temperature: c.temperature,
  }));
  let sampleSnaps: SampleSnapshot[] = [];
  relevantContainers.forEach(container => {
    const storageKey = `samples-${container.id}`;
    const savedSamples = localStorage.getItem(storageKey);
    if (savedSamples) {
      const samples = JSON.parse(savedSamples);
      Object.entries(samples).forEach(([position, sample]) => {
        const typedSample = sample as { id: string };
        sampleSnaps.push({
          containerId: container.id,
          sampleId: typedSample.id,
          position,
        });
      });
    }
  });
  return {
    containers: containerSnaps,
    samples: sampleSnaps,
    savedAt: new Date().toISOString(),
  } as SaveFile;
}
function saveSnapshotForSampleType(sampleType: string, containers: any[]) {
  const saveFile = createSaveFileForSampleType(sampleType, containers);
  localStorage.setItem(getSnapshotKey(sampleType), JSON.stringify(saveFile));
}
function loadSnapshotForSampleType(sampleType: string): SaveFile | null {
  const raw = localStorage.getItem(getSnapshotKey(sampleType));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function formatSaveFileAsGridCSV(saveFile: SaveFile): string {
  let csv = '';
  saveFile.containers.forEach(container => {
    csv += `${container.name},Box Name:,${container.name},,,\n`;
    const samples = saveFile.samples.filter(s => s.containerId === container.id);
    const rows = ['A','B','C','D','E','F','G','H','I'];
    const cols = [1,2,3,4,5,6,7,8,9];
    csv += ',,' + cols.join(',') + '\n';
    rows.forEach(row => {
      csv += row;
      cols.forEach(col => {
        const pos = row + col;
        const sample = samples.find(s => s.position === pos);
        csv += ',' + (sample ? sample.sampleId : '');
      });
      csv += '\n';
    });
    csv += '\n';
  });
  return csv;
}
// --- End Snapshot/Save File Logic ---

export function AdminDashboard() {
  // --- State ---
  const [containers, setContainers] = useState<Array<{ name: string; location: string; containerType: string; sampleType: string; temperature: string; id: string }>>([]);
  const [selectedSampleType, setSelectedSampleType] = useState<string | null>(null);
  const [viewedSaveFile, setViewedSaveFile] = useState<SaveFile | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const sampleTypes = useMemo(() => getSampleTypes(containers), [containers]);

  // --- 2am ET Nightly Save Logic ---
  useEffect(() => {
    function msUntilNext2amET() {
      const now = new Date();
      const next2am = new Date(now);
      next2am.setUTCHours(6, 0, 0, 0); // 2am ET = 6am UTC (for EDT)
      if (now > next2am) {
        next2am.setUTCDate(next2am.getUTCDate() + 1);
      }
      return next2am.getTime() - now.getTime();
    }
    function nightlySaveAllSampleTypes() {
      const types = getSampleTypes(containers);
      types.forEach(type => saveSnapshotForSampleType(type, containers));
    }
    const timeout = setTimeout(() => {
      nightlySaveAllSampleTypes();
      setInterval(nightlySaveAllSampleTypes, 24 * 60 * 60 * 1000);
    }, msUntilNext2amET());
    if (msUntilNext2amET() < 1000 * 60) {
      nightlySaveAllSampleTypes();
    }
    return () => clearTimeout(timeout);
  }, [containers]);
  // --- End 2am ET Nightly Save Logic ---

  // --- Manual Save, Download, and View UI ---
  function handleManualSave(sampleType: string) {
    saveSnapshotForSampleType(sampleType, containers);
    alert(`Save file for ${sampleType} updated.`);
  }
  function handleDownloadSaveFile(sampleType: string) {
    const saveFile = loadSnapshotForSampleType(sampleType);
    if (!saveFile) {
      alert('No save file found for this sample type.');
      return;
    }
    const csv = formatSaveFileAsGridCSV(saveFile);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sampleType}-snapshot.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
  function handleViewSaveFile(sampleType: string) {
    const saveFile = loadSnapshotForSampleType(sampleType);
    setViewedSaveFile(saveFile);
    setSelectedSampleType(sampleType);
  }
  // --- End Manual Save, Download, and View UI ---

  // ...other dashboard logic (import/export/manage tabs, etc.)...

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

        {/* --- Admin Dashboard Tabs --- */}
        <Tabs defaultValue="import" className="w-full mt-6">
          <TabsList className="mb-4">
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="snapshot">Snapshot / Export</TabsTrigger>
          </TabsList>


          {/* Import Tab Content */}
          <TabsContent value="import">
            <Card className="p-6 mb-6">
              <h3 className="mb-2 font-semibold">Import Containers & Samples</h3>
              <WorklistUpload onSamplesExtracted={() => {}} />
            </Card>
          </TabsContent>

          {/* Snapshot/Export Tab Content */}
          <TabsContent value="snapshot">
            <Card className="p-6 mb-6">
              <h3 className="mb-2 font-semibold">Nightly & Manual Save Files (Snapshots)</h3>
              {/* Filtering UI */}
              <div className="flex flex-wrap gap-4 mb-4 items-end">
                <div>
                  <label className="block text-xs font-medium mb-1">Sample Type</label>
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={selectedSampleType || ''}
                    onChange={e => setSelectedSampleType(e.target.value || null)}
                  >
                    <option value="">All</option>
                    {sampleTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Container Name</label>
                  <Input
                    className="w-48"
                    placeholder="Search container name..."
                    value={viewedSaveFile?.containers[0]?.name || ''}
                    onChange={e => {
                      // This is a placeholder; real search logic would filter containers
                      // For now, just clear the viewed file if search changes
                      setViewedSaveFile(null);
                    }}
                  />
                </div>
                {selectedSampleType && (
                  <Button size="sm" variant="outline" onClick={() => handleDownloadSaveFile(selectedSampleType)}>
                    Download CSV for {selectedSampleType}
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                {sampleTypes.length === 0 && <span className="text-muted-foreground">No sample types found.</span>}
                {(selectedSampleType ? sampleTypes.filter(type => type === selectedSampleType) : sampleTypes).map(type => (
                  <div key={type} className="border rounded p-3 flex flex-col items-start gap-2 bg-muted/50">
                    <div className="font-mono text-xs mb-1">{type}</div>
                    <Button size="sm" variant="outline" onClick={() => handleManualSave(type)}>
                      Save Now
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDownloadSaveFile(type)}>
                      Download CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleViewSaveFile(type)}>
                      View File
                    </Button>
                    {selectedSampleType === type && viewedSaveFile && (
                      <div className="mt-2 w-full max-w-xl overflow-x-auto bg-background border rounded p-2">
                        <pre className="text-xs whitespace-pre-wrap">{formatSaveFileAsGridCSV(viewedSaveFile)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
        {/* --- End Admin Dashboard Tabs --- */}
      </div>
    </div>
  );
}
