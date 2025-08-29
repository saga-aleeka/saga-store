import React, { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Search, Upload, List, FileText } from 'lucide-react';
import { SampleSearchResults, PlasmaSample } from './SampleSearchResults';
import { WorklistUpload } from './WorklistUpload';
import { WorklistResults } from './WorklistResults';
import { BulkSampleSearch } from './BulkSampleSearch';
import { PlasmaContainer } from './PlasmaContainerList';

interface SamplesTabProps {
  sampleSearchQuery: string;
  setSampleSearchQuery: (query: string) => void;
  sampleSearchMode: 'manual' | 'worklist' | 'bulk';
  setSampleSearchMode: (mode: 'manual' | 'worklist' | 'bulk') => void;
  worklistSampleIds: string[];
  worklistDuplicateIds: string[];
  filteredSamples: Array<{ sample: PlasmaSample; container: PlasmaContainer }>;
  allSamples: Array<{ sample: PlasmaSample; container: PlasmaContainer }>;
  clearSampleFilters: () => void;
  handleWorklistSamplesExtracted: (sampleIds: string[], duplicateIds?: string[]) => void;
  handleClearWorklist: () => void;
  handleNavigateToSample: (containerId: string, sampleId: string) => void;
  onBulkSearchFromCSV: (sampleIds: string[]) => void;
}

export function SamplesTab({
  sampleSearchQuery,
  setSampleSearchQuery,
  sampleSearchMode,
  setSampleSearchMode,
  worklistSampleIds,
  worklistDuplicateIds,
  filteredSamples,
  allSamples,
  clearSampleFilters,
  handleWorklistSamplesExtracted,
  handleClearWorklist,
  handleNavigateToSample,
  onBulkSearchFromCSV,
}: SamplesTabProps) {
  const [activeSampleTab, setActiveSampleTab] = useState<'search' | 'worklist' | 'bulk'>('search');

  // Prepare samples for BulkSampleSearch component
  const allSamplesForBulkSearch = allSamples.map(({ sample, container }) => ({
    sample: {
      sampleId: sample.sampleId,
      position: sample.position,
    },
    container: {
      id: container.id,
      name: container.name,
      location: container.location,
      sampleType: container.sampleType,
      isArchived: container.isArchived,
    },
  }));

  // Handle bulk search results from CSV upload
  const handleBulkSearchResults = (results: any[]) => {
    // Extract sample IDs from successful search results
    const foundSampleIds = results
      .filter(result => result.found)
      .map(result => result.sampleId);
    
    onBulkSearchFromCSV(foundSampleIds);
  };

  return (
    <div className="space-y-6">
      {/* Sample Search Tabs */}
      <Tabs value={activeSampleTab} onValueChange={(value) => setActiveSampleTab(value as 'search' | 'worklist' | 'bulk')}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Manual Search
          </TabsTrigger>
          <TabsTrigger value="worklist" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Worklist Upload
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Bulk CSV Search
          </TabsTrigger>
        </TabsList>

        {/* Manual Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search samples by ID, position, container..."
                    value={sampleSearchQuery}
                    onChange={(e) => {
                      setSampleSearchQuery(e.target.value);
                      if (sampleSearchMode !== 'manual') {
                        setSampleSearchMode('manual');
                      }
                    }}
                    className="pl-10"
                  />
                </div>
                {(sampleSearchQuery || sampleSearchMode !== 'manual') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSampleFilters}
                    className="text-muted-foreground"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Search by sample ID, position, container name, or location. Use commas to search multiple terms.
              </p>
            </div>
          </Card>

          {/* Manual Search Results */}
          {filteredSamples.length > 0 && sampleSearchMode === 'manual' && (
            <SampleSearchResults
              samples={filteredSamples}
              onNavigateToSample={handleNavigateToSample}
              searchQuery={sampleSearchQuery}
            />
          )}
        </TabsContent>

        {/* Worklist Upload Tab */}
        <TabsContent value="worklist" className="space-y-4">
          <WorklistUpload
            onSamplesExtracted={handleWorklistSamplesExtracted}
            onClearWorklist={handleClearWorklist}
          />

          {/* Worklist Results */}
          {worklistSampleIds.length > 0 && (
            <WorklistResults
              worklistSampleIds={worklistSampleIds}
              worklistDuplicateIds={worklistDuplicateIds}
              filteredSamples={filteredSamples}
              onNavigateToSample={handleNavigateToSample}
              onClearWorklist={handleClearWorklist}
            />
          )}
        </TabsContent>

        {/* Bulk CSV Search Tab */}
        <TabsContent value="bulk" className="space-y-4">
          <BulkSampleSearch
            allSamples={allSamplesForBulkSearch}
            onNavigateToSample={handleNavigateToSample}
          />
        </TabsContent>
      </Tabs>

      {/* Show no results message when appropriate */}
      {(sampleSearchMode === 'manual' && sampleSearchQuery && filteredSamples.length === 0) && (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="mb-2">No samples found</h3>
            <p className="text-sm">
              No samples match your search criteria. Try adjusting your search terms or check the archive tab.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}