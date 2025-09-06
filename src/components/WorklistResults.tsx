import React, { useMemo } from 'react';

export function WorklistResults({ 
  searchedSampleIds, 
  searchResults, 
  duplicateIds = [],
  onNavigateToSample, 
  onClearWorklist 
}: WorklistResultsProps) {
  const analysis = useMemo((): WorklistAnalysis => {
    // ...existing code...
  }, [searchedSampleIds, searchResults]);

  const exportResults = () => {
    // ...existing code...
  };

  if (searchedSampleIds.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                <TestTube className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-medium">{analysis.totalValidSearched}</p>
                <p className="text-sm text-muted-foreground">Total Searched</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-medium text-green-600">{analysis.found.length}</p>
                <p className="text-sm text-muted-foreground">Found</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-medium text-red-600">{analysis.missing.length}</p>
                <p className="text-sm text-muted-foreground">Missing</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Status Alert */}
        <Alert className={analysis.missing.length === 0 ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}>
          {analysis.missing.length === 0 ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          )}
          <AlertDescription className={analysis.missing.length === 0 ? 'text-green-800' : 'text-orange-800'}>
            {analysis.missing.length === 0 ? (
              <>
                <strong>All samples found!</strong>
                {duplicateIds.length > 0 && (
                  <> ({duplicateIds.length} samples appear multiple times in worklist)</>
                )}
              </>
            ) : (
              <>
                <strong>{analysis.missing.length} samples not found</strong> - they may be checked out, in different containers, or have different IDs.
                {duplicateIds.length > 0 && (
                  <> ({duplicateIds.length} samples appear multiple times in worklist)</>
                )}
              </>
            )}
          </AlertDescription>
        </Alert>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={exportResults}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Results
          </Button>
          <Button
            onClick={onClearWorklist}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            Clear Worklist
          </Button>
        </div>

        {/* Containers to Pull */}
        {Object.keys(analysis.foundByContainer).length > 0 && (
          <Card className="p-6">
            <h3 className="mb-4">Containers to Pull</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(analysis.foundByContainer).map(([containerId, containerResults]) => {
                const containerResultsTyped = containerResults as SampleSearchResult[];
                const container = containerResultsTyped[0].container;
                return (
                  <div key={containerId} className="flex flex-col gap-2 p-3 bg-muted/30 rounded-lg border">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{container.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {container.id}
                      </Badge>
                    </div>
                    <ContainerResults
                      containerResults={containerResultsTyped}
                      containerId={containerId}
                      onNavigateToSample={onNavigateToSample}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Missing Samples */}
        {analysis.missing.length > 0 && (
          <Card className="p-6">
            <h3 className="flex items-center gap-2 mb-4">
              <XCircle className="w-5 h-5 text-red-600" />
              Missing Samples ({analysis.missing.length})
            </h3>
            <ScrollArea className="h-32">
              <div className="flex flex-wrap gap-2">
                {analysis.missing.map((sampleId, index) => (
                  <Badge key={index} variant="destructive" className="text-xs">
                    {sampleId}
                  </Badge>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>These samples were not found in any container. They may be:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Currently checked out of storage</li>
                <li>Stored in containers not in the system</li>
                <li>Have different sample IDs than expected</li>
                <li>Not yet processed or stored</li>
              </ul>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}
            
                  {/* Missing Samples */}
                  {analysis.missing.length > 0 && (
                    <Card className="p-6">
                      <h3 className="flex items-center gap-2 mb-4">
                        <XCircle className="w-5 h-5 text-red-600" />
                        Missing Samples ({analysis.missing.length})
                      </h3>
                      <ScrollArea className="h-32">
                        <div className="flex flex-wrap gap-2">
                          {analysis.missing.map((sampleId, index) => (
                            <Badge key={index} variant="destructive" className="text-xs">
                              {sampleId}
                            </Badge>
                          ))}
                        </div>
                      </ScrollArea>
                      <div className="mt-4 text-sm text-muted-foreground">
                        <p>These samples were not found in any container. They may be:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Currently checked out of storage</li>
                          <li>Stored in containers not in the system</li>
                          <li>Have different sample IDs than expected</li>
                          <li>Not yet processed or stored</li>
                        </ul>
                      </div>
                    </Card>
                  )}
                    const { sample } = result;
                    const daysSinceStorage = Math.floor(
                      (new Date().getTime() - new Date(sample.storageDate).getTime()) / (1000 * 60 * 60 * 24)
                    );
                  
                    return (
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                        <div className="flex items-center gap-2">
                          <TestTube className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="font-medium text-sm">{sample.sampleId}</p>
                            <p className="text-xs text-muted-foreground">
                              Position {sample.position} • {daysSinceStorage}d ago
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onNavigateToSample(containerId, sample.sampleId)}
                          className="h-6 w-6 p-0"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  };
                  
                  const ContainerResults: React.FC<{
                    containerResults: SampleSearchResult[];
                    containerId: string;
                    onNavigateToSample: (containerId: string, sampleId: string) => void;
                  }> = ({ containerResults, containerId, onNavigateToSample }) => (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {containerResults.map((result, index) => (
                        <ContainerResult
                          key={index}
                          result={result}
                          containerId={containerId}
                          onNavigateToSample={onNavigateToSample}
                        />
                      ))}
                    </div>
                  );

                  <ContainerResults
                    containerResults={containerResults}
                    containerId={containerId}
                    onNavigateToSample={onNavigateToSample}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Missing Samples */}
      {analysis.missing.length > 0 && (
        <Card className="p-6">
          <h3 className="flex items-center gap-2 mb-4">
            <XCircle className="w-5 h-5 text-red-600" />
            Missing Samples ({analysis.missing.length})
          </h3>
          <ScrollArea className="h-32">
            <div className="flex flex-wrap gap-2">
              {analysis.missing.map((sampleId, index) => (
                <Badge key={index} variant="destructive" className="text-xs">
                  {sampleId}
                </Badge>
              ))}
            </div>
          </ScrollArea>
          <div className="mt-4 text-sm text-muted-foreground">
            <p>These samples were not found in any container. They may be:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Currently checked out of storage</li>
              <li>Stored in containers not in the system</li>
              <li>Have different sample IDs than expected</li>
              <li>Not yet processed or stored</li>
            </ul>
          </div>
        </Card>
      )}


    </div>
  );
}

// Ensure the Button component is exported properly
export const Button = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={`px-4 py-2 rounded-md font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${props.className}`}
  >
    {children}
  </button>
);