import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Separator } from './ui/separator';
import { 
  Upload, 
  FileText, 
  Search, 
  X, 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  List
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface BulkSampleResult {
  sampleId: string;
  found: boolean;
  containerId?: string;
  containerName?: string;
  containerLocation?: string;
  position?: string;
  sampleType?: string;
  isArchived?: boolean;
  error?: string;
}

interface BulkSampleSearchProps {
  allSamples: Array<{
    sample: {
      sampleId: string;
      position: string;
    };
    container: {
      id: string;
      name: string;
      location: string;
      sampleType: string;
      isArchived?: boolean;
    };
  }>;
  onNavigateToSample: (containerId: string, sampleId: string) => void;
}

export function BulkSampleSearch({ allSamples, onNavigateToSample }: BulkSampleSearchProps) {
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<BulkSampleResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'paste' | 'upload'>('paste');

  // Parse CSV content
  const parseCSVContent = useCallback((csvContent: string): string[] => {
    const lines = csvContent.trim().split('\n');
    const sampleIds: string[] = [];

    lines.forEach((line, index) => {
      // Handle CSV with headers or without
      if (index === 0 && (
        line.toLowerCase().includes('sample') || 
        line.toLowerCase().includes('id') ||
        line.toLowerCase().includes('tube')
      )) {
        return; // Skip header row
      }

      // Split by comma and take first column, clean up
      const columns = line.split(',');
      const sampleId = columns[0]?.trim().replace(/['"]/g, '');
      
      if (sampleId && sampleId.length > 0) {
        sampleIds.push(sampleId);
      }
    });

    return sampleIds;
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setSearchInput(content);
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  }, []);

  // Perform bulk search
  const performBulkSearch = useCallback(() => {
    if (!searchInput.trim()) {
      toast.error('Please enter sample IDs or upload a CSV file');
      return;
    }

    setIsSearching(true);
    
    try {
      // Parse input - could be CSV content or newline/comma separated
      let sampleIds: string[];
      
      if (searchInput.includes(',') && searchInput.includes('\n')) {
        // Looks like CSV
        sampleIds = parseCSVContent(searchInput);
      } else {
        // Simple list - split by newlines or commas
        sampleIds = searchInput
          .split(/[\n,]/)
          .map(id => id.trim())
          .filter(id => id.length > 0);
      }

      if (sampleIds.length === 0) {
        toast.error('No valid sample IDs found in input');
        setIsSearching(false);
        return;
      }

      // Remove duplicates
      const uniqueSampleIds = [...new Set(sampleIds)];
      
      // Search for each sample ID
      const results: BulkSampleResult[] = uniqueSampleIds.map(sampleId => {
        // For archive, we allow duplicates, so find all matches
        const matches = allSamples.filter(({ sample }) => 
          sample.sampleId.toLowerCase() === sampleId.toLowerCase()
        );

        if (matches.length === 0) {
          return {
            sampleId,
            found: false,
            error: 'Sample not found'
          };
        }

        // If multiple matches (duplicates in archive), prefer non-archived
        let bestMatch = matches[0];
        if (matches.length > 1) {
          const nonArchivedMatch = matches.find(match => !match.container.isArchived);
          if (nonArchivedMatch) {
            bestMatch = nonArchivedMatch;
          }
        }

        return {
          sampleId,
          found: true,
          containerId: bestMatch.container.id,
          containerName: bestMatch.container.name,
          containerLocation: bestMatch.container.location,
          position: bestMatch.sample.position,
          sampleType: bestMatch.container.sampleType,
          isArchived: bestMatch.container.isArchived
        };
      });

      setSearchResults(results);
      
      const foundCount = results.filter(r => r.found).length;
      const notFoundCount = results.length - foundCount;
      
      if (notFoundCount === 0) {
        toast.success(`All ${foundCount} samples found!`);
      } else {
        toast.warning(`Found ${foundCount} samples, ${notFoundCount} not found`);
      }

    } catch (error) {
      console.error('Error performing bulk search:', error);
      toast.error('Error processing search. Please check your input format.');
    } finally {
      setIsSearching(false);
    }
  }, [searchInput, allSamples, parseCSVContent]);

  // Export results to CSV
  const exportResults = useCallback(() => {
    if (searchResults.length === 0) {
      toast.error('No results to export');
      return;
    }

    const csvContent = [
      'Sample ID,Status,Container ID,Container Name,Location,Position,Sample Type,Archived,Notes',
      ...searchResults.map(result => [
        result.sampleId,
        result.found ? 'Found' : 'Not Found',
        result.containerId || '',
        result.containerName || '',
        result.containerLocation || '',
        result.position || '',
        result.sampleType || '',
        result.isArchived ? 'Yes' : 'No',
        result.error || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-sample-search-results-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Results exported to CSV');
  }, [searchResults]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchInput('');
    setSearchResults([]);
  }, []);

  const foundCount = searchResults.filter(r => r.found).length;
  const notFoundCount = searchResults.length - foundCount;
  const archivedCount = searchResults.filter(r => r.found && r.isArchived).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Bulk Sample Search
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file or paste a list of sample IDs to locate multiple samples at once.
            Archive samples may have duplicate IDs.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={searchMode === 'paste' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSearchMode('paste')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Paste List
            </Button>
            <Button
              variant={searchMode === 'upload' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSearchMode('upload')}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
          </div>

          {searchMode === 'upload' ? (
            <div className="space-y-2">
              <Label htmlFor="csv-upload">CSV File Upload</Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Upload a CSV file with sample IDs in the first column. Headers are automatically detected.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="sample-list">Sample IDs</Label>
              <Textarea
                id="sample-list"
                placeholder="Enter sample IDs separated by commas or new lines:&#10;SAMPLE001&#10;SAMPLE002&#10;SAMPLE003&#10;&#10;Or paste CSV content directly..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter one sample ID per line, or separate with commas. You can also paste CSV content directly.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={performBulkSearch}
              disabled={isSearching || !searchInput.trim()}
              className="flex-1"
            >
              {isSearching ? (
                <>
                  <Search className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search Samples
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={clearSearch}
              disabled={isSearching}
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Search Results
                <Badge variant="outline">
                  {searchResults.length} samples searched
                </Badge>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={exportResults}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            
            {/* Summary Stats */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-600">{foundCount} found</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-red-600">{notFoundCount} not found</span>
              </div>
              {archivedCount > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-orange-600">{archivedCount} in archive</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((result, index) => (
                <div key={index}>
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${
                    result.found 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      {result.found ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{result.sampleId}</span>
                          {result.isArchived && (
                            <Badge variant="secondary" className="text-xs">
                              Archived
                            </Badge>
                          )}
                        </div>
                        {result.found ? (
                          <p className="text-sm text-muted-foreground">
                            {result.containerName} • {result.containerLocation} • Position {result.position}
                          </p>
                        ) : (
                          <p className="text-sm text-red-600">{result.error}</p>
                        )}
                      </div>
                    </div>
                    {result.found && result.containerId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onNavigateToSample(result.containerId!, result.sampleId)}
                      >
                        View Sample
                      </Button>
                    )}
                  </div>
                  {index < searchResults.length - 1 && <Separator className="my-1" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}