          import { TabsContent } from '../components/TabsContent'; // Adjusted the path to the correct location of TabsContent
          import { SamplesTab } from './SamplesTab'; // Adjust the path as needed

          const [sampleSearchQuery, setSampleSearchQuery] = React.useState<string>("");
          const [sampleSearchMode, setSampleSearchMode] = React.useState<string | null>(null);

          // Define worklistSampleIds as an empty array or provide appropriate data
          const worklistSampleIds: string[] = [];
          const worklistDuplicateIds: string[] = [];
          const filteredSamples: string[] = []; // Initialize filteredSamples as an empty array
          const allSamples: string[] = []; // Define allSamples as an empty array or provide appropriate data

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

          function handleWorklistSamplesExtracted(sampleIds: string[], duplicateIds?: string[] | undefined): void {
            // Update the worklistSampleIds with the provided sampleIds
            worklistSampleIds.splice(0, worklistSampleIds.length, ...sampleIds);

            // If duplicateIds are provided, update the worklistDuplicateIds
            if (duplicateIds) {
            worklistDuplicateIds.splice(0, worklistDuplicateIds.length, ...duplicateIds);
            }

            // Optionally, log the extracted samples for debugging
            console.log('Worklist samples extracted:', sampleIds);
            if (duplicateIds) {
            console.log('Duplicate samples:', duplicateIds);
            }
          }
