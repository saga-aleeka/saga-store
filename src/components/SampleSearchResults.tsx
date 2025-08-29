import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { TestTube, MapPin, Calendar, ArrowRight, AlertCircle } from 'lucide-react';
import { PlasmaContainer, getSampleTypeColor } from './PlasmaContainerList';

interface SampleHistoryEntry {
  timestamp: string;
  action: 'check-in' | 'check-out' | 'moved' | 'accessed';
  user?: string;
  notes?: string;
  fromPosition?: string;
  toPosition?: string;
}

export interface PlasmaSample {
  position: string;
  sampleId: string;
  storageDate: string;
  lastAccessed?: string;
  history: SampleHistoryEntry[];
}

interface SampleWithContainer extends PlasmaSample {
  containerId: string;
  containerName: string;
  containerLocation: string;
}

interface SampleSearchResultsProps {
  samples: SampleWithContainer[];
  searchQuery: string;
  onNavigateToSample: (containerId: string, sampleId: string) => void;
}

export function SampleSearchResults({ samples, searchQuery, onNavigateToSample }: SampleSearchResultsProps) {
  // Parse search terms for better display
  const searchTerms = searchQuery.split(',').map(term => term.trim()).filter(term => term.length > 0);
  const isMultipleTerms = searchTerms.length > 1;

  if (samples.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="text-muted-foreground">
          <TestTube className="w-12 h-12 mx-auto mb-4 opacity-50" />
          {searchQuery ? (
            <>
              <h3 className="mb-2">No samples found</h3>
              <p className="text-sm">
                No samples match your search for{' '}
                {isMultipleTerms ? (
                  <>
                    <strong>{searchTerms.length} terms</strong>: {searchTerms.map((term, index) => (
                      <span key={index}>
                        <strong>"{term}"</strong>
                        {index < searchTerms.length - 1 && (index === searchTerms.length - 2 ? ' or ' : ', ')}
                      </span>
                    ))}
                  </>
                ) : (
                  <strong>"{searchQuery}"</strong>
                )}
              </p>
              <p className="text-sm mt-2">
                Try searching by sample ID, container name, or location{isMultipleTerms && ', or separate multiple terms with commas'}
              </p>
            </>
          ) : (
            <>
              <h3 className="mb-2">Search for samples</h3>
              <p className="text-sm">
                Enter a sample ID, container name, or location to find samples
              </p>
              <p className="text-sm mt-1 text-xs">
                Tip: Use commas to search for multiple samples at once
              </p>
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3>
          Search Results
          <span className="text-muted-foreground ml-2">
            ({samples.length} samples found{isMultipleTerms ? ` for ${searchTerms.length} search terms` : ''})
          </span>
        </h3>
        {isMultipleTerms && (
          <div className="text-sm text-muted-foreground">
            Searching: {searchTerms.map((term, index) => (
              <span key={index} className="bg-muted px-2 py-1 rounded mr-1">
                {term}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {samples.map((sample, index) => {
          // Calculate days since storage
          const daysSinceStorage = Math.floor(
            (new Date().getTime() - new Date(sample.storageDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          
          // Calculate days since last access
          const daysSinceAccess = sample.lastAccessed 
            ? Math.floor(
                (new Date().getTime() - new Date(sample.lastAccessed).getTime()) / (1000 * 60 * 60 * 24)
              )
            : null;
          
          // Find which search term matched this result (for multi-term searches)
          const matchedTerm = isMultipleTerms ? searchTerms.find(term => {
            const lowerTerm = term.toLowerCase();
            return (
              sample.sampleId.toLowerCase().includes(lowerTerm) ||
              sample.position.toLowerCase().includes(lowerTerm) ||
              sample.containerName.toLowerCase().includes(lowerTerm) ||
              sample.containerLocation.toLowerCase().includes(lowerTerm) ||
              sample.containerId.toLowerCase().includes(lowerTerm)
            );
          }) : null;

          return (
            <Card 
              key={`${sample.containerId}-${sample.position}-${index}`}
              className="p-4 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  {/* Sample Header */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <TestTube className="w-5 h-5 text-blue-600" />
                      <div>
                        <h4 className="font-medium">{sample.sampleId}</h4>
                        <p className="text-sm text-muted-foreground">
                          Position {sample.position}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {matchedTerm && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Matched: "{matchedTerm}"
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Container Info */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{sample.containerName}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">{sample.containerLocation}</span>
                    </div>
                  </div>

                  {/* Sample Metadata */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Stored {daysSinceStorage === 0 ? 'today' : `${daysSinceStorage} days ago`}
                      </span>
                      <span>({sample.storageDate})</span>
                    </div>
                    
                    {sample.lastAccessed && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <span>
                            Last accessed {daysSinceAccess === 0 ? 'today' : `${daysSinceAccess} days ago`}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Status Indicators */}
                  <div className="flex items-center gap-2">
                    {daysSinceStorage > 90 && (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Long-term storage ({daysSinceStorage} days)
                      </Badge>
                    )}
                    {sample.lastAccessed && daysSinceAccess && daysSinceAccess < 7 && (
                      <Badge variant="outline" className="text-xs text-green-600">
                        Recently accessed
                      </Badge>
                    )}
                    {!sample.lastAccessed && (
                      <Badge variant="outline" className="text-xs text-orange-600">
                        Never accessed
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs text-blue-600">
                      {sample.history?.length || 0} history entries
                    </Badge>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    onClick={() => onNavigateToSample(sample.containerId, sample.sampleId)}
                    className="flex items-center gap-2"
                  >
                    View Sample
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}