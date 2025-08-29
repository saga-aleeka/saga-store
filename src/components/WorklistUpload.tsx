import React, { useState, useRef } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Upload, FileText, AlertTriangle, CheckCircle, XCircle, Download } from 'lucide-react';

interface WorklistUploadProps {
  onSamplesExtracted: (sampleIds: string[], duplicateIds?: string[]) => void;
  className?: string;
}

interface ParsedWorklistData {
  totalRows: number;
  sampleIds: string[];
  duplicateIds: string[];
  invalidRows: number;
  fileName: string;
}

export function WorklistUpload({ onSamplesExtracted, className }: WorklistUploadProps) {
  const [parsedData, setParsedData] = useState<ParsedWorklistData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setParsedData(null);

    try {
      const fileContent = await readFileContent(file);
      const parsed = parseWorklistFile(fileContent, file.name);
      setParsedData(parsed);
      onSamplesExtracted(parsed.sampleIds, parsed.duplicateIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setIsProcessing(false);
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const parseWorklistFile = (content: string, fileName: string): ParsedWorklistData => {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
      throw new Error('File appears to be empty');
    }

    // Try to detect if it's CSV or tab-separated
    const firstLine = lines[0];
    const separator = firstLine.includes('\t') ? '\t' : ',';
    
    // Parse header row to find sample ID column
    const headers = firstLine.split(separator).map(h => h.trim().replace(/"/g, ''));
    
    // Look for common sample ID column names
    const sampleIdColumnNames = [
      'Sample_SampleID', 'SampleID', 'Sample ID', 'Sample_ID', 'sampleid', 'sample_id',
      'ID', 'Sample', 'Barcode', 'sample_barcode', 'Sample_Barcode'
    ];
    
    let sampleIdColumnIndex = -1;
    for (const columnName of sampleIdColumnNames) {
      const index = headers.findIndex(h => 
        h.toLowerCase() === columnName.toLowerCase() || 
        h.toLowerCase().includes(columnName.toLowerCase())
      );
      if (index !== -1) {
        sampleIdColumnIndex = index;
        break;
      }
    }

    if (sampleIdColumnIndex === -1) {
      // If no standard column found, assume first column contains sample IDs
      sampleIdColumnIndex = 0;
    }

    const allSampleIds: string[] = [];
    const duplicateCounts = new Map<string, number>();
    let invalidRows = 0;

    // Parse data rows (skip header) and collect all sample IDs
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(separator).map(cell => cell.trim().replace(/"/g, ''));
      
      if (row.length <= sampleIdColumnIndex) {
        invalidRows++;
        continue;
      }

      const sampleId = row[sampleIdColumnIndex];
      
      if (!sampleId || sampleId.length === 0) {
        invalidRows++;
        continue;
      }

      allSampleIds.push(sampleId);
      
      // Track duplicate counts
      const currentCount = duplicateCounts.get(sampleId) || 0;
      duplicateCounts.set(sampleId, currentCount + 1);
    }

    // Get unique sample IDs for searching
    const uniqueSampleIds = Array.from(new Set(allSampleIds));
    
    // Get list of sample IDs that appear more than once
    const duplicateIds = Array.from(duplicateCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([sampleId, _]) => sampleId);

    if (uniqueSampleIds.length === 0) {
      throw new Error('No valid sample IDs found in the file');
    }

    return {
      totalRows: lines.length - 1, // Exclude header
      sampleIds: uniqueSampleIds, // Only unique IDs for searching
      duplicateIds, // IDs that appear multiple times (for info only)
      invalidRows,
      fileName
    };
  };

  const handleClearWorklist = () => {
    setParsedData(null);
    setError(null);
    onSamplesExtracted([], []);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const csvContent = `Sample_SampleID,Sample_Type,Source_Plate,Source_Well,Destination_Plate,Destination_Well,Volume
M00H4FAD,Plasma,MagPlate,A1,M00H4FAFP,A1,
M00H4FBD,Plasma,MagPlate,A2,M00H4FAFP,A2,
M00H4FCD,Plasma,MagPlate,A3,M00H4FAFP,A3,`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'worklist_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Worklist
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a CSV or TSV file containing sample IDs to search for multiple samples at once
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Template
          </Button>
        </div>

        {!parsedData && (
          <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="worklist-upload"
            />
            <label
              htmlFor="worklist-upload"
              className="cursor-pointer flex flex-col items-center gap-4"
            >
              <div className="flex items-center justify-center w-16 h-16 border-2 border-dashed border-muted-foreground/20 rounded-full">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Click to upload worklist file
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports CSV, TSV, and TXT files
                </p>
              </div>
            </label>
          </div>
        )}

        {isProcessing && (
          <Alert>
            <Upload className="h-4 w-4" />
            <AlertDescription>
              Processing worklist file...
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {parsedData && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <strong>Worklist processed successfully!</strong>
                <br />
                Found {parsedData.sampleIds.length} unique sample IDs from {parsedData.fileName}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-medium text-green-600">{parsedData.sampleIds.length}</p>
                <p className="text-sm text-muted-foreground">Unique Samples</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-medium">{parsedData.totalRows}</p>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-medium text-blue-600">{parsedData.duplicateIds.length}</p>
                <p className="text-sm text-muted-foreground">Multi-Use</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-medium text-red-600">{parsedData.invalidRows}</p>
                <p className="text-sm text-muted-foreground">Invalid Rows</p>
              </div>
            </div>

            {parsedData.duplicateIds.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                  Samples with Multiple Entries ({parsedData.duplicateIds.length})
                </h4>
                <div className="text-sm text-muted-foreground mb-2">
                  These samples appear multiple times in the worklist (likely used in multiple process steps)
                </div>
                <ScrollArea className="h-20 border rounded p-2">
                  <div className="flex flex-wrap gap-1">
                    {parsedData.duplicateIds.map((id, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {id}
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div>
              <h4 className="mb-2">Sample IDs to Search ({parsedData.sampleIds.length})</h4>
              <ScrollArea className="h-32 border rounded p-2">
                <div className="flex flex-wrap gap-1">
                  {parsedData.sampleIds.map((id, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {id}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearWorklist}
                className="flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Clear Worklist
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload New File
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}