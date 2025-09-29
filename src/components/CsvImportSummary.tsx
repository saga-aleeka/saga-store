import React, { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface ContainerItem {
  id: string;
  name: string;
  location: string;
  containerType?: string;
  sampleType?: string;
  temperature?: string;
}
interface SampleItem {
  containerId: string;
  sampleId: string;
  position: string;
}
interface ImportSummary {
  containers: ContainerItem[];
  samples: SampleItem[];
}
interface CsvImportSummaryProps {
  onImport: (items: ImportSummary) => void;
}

function parseCsv(csv: string): ImportSummary {
  // Find first non-empty row, then stop after 10 consecutive blank rows
  const lines = csv.split(/\r?\n/);
  let startIdx = 0;
  while (startIdx < lines.length && !lines[startIdx].trim()) {
    startIdx++;
  }
  const containers: ContainerItem[] = [];
  const samples: SampleItem[] = [];
  const containerMap = new Map<string, ContainerItem>();
  let blankCount = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      blankCount++;
      if (blankCount >= 10) break;
      continue;
    } else {
      blankCount = 0;
    }
    const cols = line.split(',').map(s => s.trim());
    if (cols.length >= 4) {
      const [location, name, sampleId, position] = cols;
      if (location && name && sampleId && position) {
        let container = containerMap.get(name);
        if (!container) {
          container = {
            id: name + '-' + location,
            name,
            location,
          };
          containers.push(container);
          containerMap.set(name, container);
        }
        samples.push({
          containerId: container.id,
          sampleId,
          position,
        });
      }
    }
  }
  return { containers, samples };
}

export function CsvImportSummary({ onImport }: CsvImportSummaryProps) {
  const [fileName, setFileName] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setImported(false);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      setSummary(parsed);
    } catch (err) {
      setError('Failed to parse CSV');
      setSummary(null);
    }
  };

  const handleImport = () => {
    if (summary) {
      onImport(summary);
      setImported(true);
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-2">
        <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
      </div>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      {summary && (
        <div className="mb-2">
          <div>File: <b>{fileName}</b></div>
          <div>Containers found: <b>{summary.containers.length}</b></div>
          <div>Samples found: <b>{summary.samples.length}</b></div>
        </div>
      )}
      {summary && !imported && (
        <Button onClick={handleImport}>Import {summary.containers.length} containers, {summary.samples.length} samples</Button>
      )}
      {imported && <div className="text-green-600 mt-2">Import complete!</div>}
    </Card>
  );
}

export default CsvImportSummary;
