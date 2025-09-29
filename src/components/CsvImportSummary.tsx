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
  // Parse grid format: scan for container header, parse grid, extract info, repeat for all blocks
  const lines = csv.split(/\r?\n/);
  const containers: ContainerItem[] = [];
  const samples: SampleItem[] = [];
  let i = 0;
  let blankCount = 0;
  while (i < lines.length) {
    // Skip leading blanks
    while (i < lines.length && !lines[i].trim()) {
      i++;
      blankCount++;
      if (blankCount >= 10) return { containers, samples };
    }
    blankCount = 0;
    // Look for container header: Container_Location, "Box Name:", Container_Name
    const headerMatch = lines[i] && lines[i].includes('Box Name:');
    if (!headerMatch) { i++; continue; }
    const headerCols = lines[i].split(',').map(s => s.trim());
    const containerLocation = headerCols[0];
    const containerName = headerCols[2];
    const containerId = containerName + '-' + containerLocation;
    containers.push({ id: containerId, name: containerName, location: containerLocation });
    i++;
    // Next line: column headers (skip)
    while (i < lines.length && !lines[i].trim()) { i++; }
    const colHeaderLine = lines[i] || '';
    const colHeaders = colHeaderLine.split(',').map(s => s.trim());
    // Find where columns start (usually after two empty columns)
    let colStart = 0;
    for (let c = 0; c < colHeaders.length; c++) {
      if (colHeaders[c] === '1') { colStart = c; break; }
    }
    i++;
    // Parse grid rows (A,B,C,...) until blank or next header
    while (i < lines.length && lines[i].trim()) {
      const rowCols = lines[i].split(',').map(s => s.trim());
      const rowLabel = rowCols[0];
      if (!rowLabel || !/^[A-Z]$/.test(rowLabel)) break;
      for (let c = colStart; c < rowCols.length; c++) {
        const sampleId = rowCols[c];
        if (sampleId) {
          const colNum = colHeaders[c] || (c - colStart + 1).toString();
          const position = rowLabel + colNum;
          samples.push({ containerId, sampleId, position });
        }
      }
      i++;
    }
    // After grid, skip to next block or end
    while (i < lines.length && !lines[i].trim()) {
      i++;
      blankCount++;
      if (blankCount >= 10) return { containers, samples };
    }
    blankCount = 0;
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
