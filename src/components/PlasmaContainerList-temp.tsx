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