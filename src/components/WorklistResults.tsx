

// Define or import the SampleSearchResult type
interface SampleSearchResult {
  sample: {
    sampleId: string;
    position: string;
    storageDate: string;
  } | null;
}
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';
import { TestTube, CheckCircle, XCircle, AlertTriangle, Download, MapPin, ArrowRight } from 'lucide-react';

interface WorklistResultsProps {
  searchedSampleIds: string[];
  searchResults: Record<string, any>; // Replace 'any' with actual sample result type
  duplicateIds?: string[];
  analysis: {
    missing: string[];
  }
  onNavigateToSample: (containerId: string, sampleId: string) => void;
  onClearWorklist: () => void;
}

// Ensure analysis is destructured from props
import React, { useMemo } from 'react';

export const WorklistResults: React.FC<WorklistResultsProps> = ({
  searchedSampleIds,
  searchResults,
  duplicateIds,
  analysis,
  onNavigateToSample,
  onClearWorklist,
}) => {
  // Defensive: fallback to empty object if analysis is undefined
  const safeAnalysis = analysis ?? { missing: [] };
  // Defensive: get found samples from searchResults
  const foundSamples = Object.values(searchResults ?? {}).filter((result: any) => result && result.sample && result.container);
  const hasFoundSamples = foundSamples.length > 0;

  // State for selected samples to checkout
  const [selectedSamples, setSelectedSamples] = React.useState<string[]>([]);
  const [checkedOutSamples, setCheckedOutSamples] = React.useState<string[]>([]);

  // Handle select/deselect
  const handleSelectSample = (sampleId: string) => {
    setSelectedSamples((prev) =>
      prev.includes(sampleId) ? prev.filter((id) => id !== sampleId) : [...prev, sampleId]
    );
  };

  // Handle checkout
  const handleCheckout = (sampleIds: string[]) => {
    setCheckedOutSamples((prev) => [...prev, ...sampleIds.filter(id => !prev.includes(id))]);
    setSelectedSamples([]);
    // Optionally: persist to localStorage
    // localStorage.setItem('checkedOutSamples', JSON.stringify([...checkedOutSamples, ...sampleIds]));
  };

  // Handle undo checkout
  const handleUndoCheckout = (sampleIds: string[]) => {
    setCheckedOutSamples((prev) => prev.filter((id) => !sampleIds.includes(id)));
    // Optionally: update localStorage
    // localStorage.setItem('checkedOutSamples', JSON.stringify(checkedOutSamples.filter(id => !sampleIds.includes(id))));
  };

  return (
    <div className="space-y-8">
      {/* Missing Samples */}
      {safeAnalysis.missing.length > 0 && (
        <Card className="p-6">
          <h3 className="flex items-center gap-2 mb-4">
            <XCircle className="w-5 h-5 text-red-600" />
            Missing Samples ({analysis.missing.length})
          </h3>
          <ScrollArea className="h-32">
            <div className="flex flex-wrap gap-2">
              {analysis.missing.map((sampleId: string, index: number) => (
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
            </ul>
          </div>
        </Card>
      )}

      {/* Found Samples - full width, below missing */}
      {hasFoundSamples && (
        <div className="w-full">
          <Card className="p-6">
            <h3 className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Found Samples ({foundSamples.length})
            </h3>
            <div className="flex gap-2 mb-4 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => handleCheckout(foundSamples.map((r: any) => r.sample.sampleId))}>
                Check Out All
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleCheckout(selectedSamples)} disabled={selectedSamples.length === 0}>
                Check Out Selected
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleUndoCheckout(checkedOutSamples)} disabled={checkedOutSamples.length === 0}>
                Undo Checkout
              </Button>
            </div>
            <ScrollArea className="h-64">
              <div className="flex flex-col gap-2 w-full">
                {foundSamples.map((result: any, index: number) => {
                  const sampleId = result.sample.sampleId;
                  const isCheckedOut = checkedOutSamples.includes(sampleId);
                  return (
                    <div key={index} className={`flex items-center gap-3 bg-muted/30 rounded px-2 py-1 ${isCheckedOut ? 'opacity-50' : ''}`} style={{ width: '100%' }}>
                      <input
                        type="checkbox"
                        checked={selectedSamples.includes(sampleId)}
                        onChange={() => handleSelectSample(sampleId)}
                        disabled={isCheckedOut}
                      />
                      <Badge variant="secondary" className="text-xs">
                        {sampleId}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        in <strong>{result.container.name}</strong> (<span className="font-mono">{result.container.location}</span>)
                      </span>
                      <span className="text-xs text-muted-foreground">Position: <strong>{result.sample.position}</strong></span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onNavigateToSample(result.container.id, sampleId)}
                        className="h-6 w-6 p-0"
                        aria-label={`Go to ${sampleId}`}
                      >
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>
        </div>
      )}
    </div>
  );
};

const ContainerResult: React.FC<{
  result: SampleSearchResult;
  containerId: string;
  onNavigateToSample: (containerId: string, sampleId: string) => void;
}> = (props) => {
  const sample = props.result.sample;
  if (!sample) {
    return null;
  }
  if (!sample.storageDate) {
    return null;
  }

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
        onClick={() => props.onNavigateToSample(props.containerId, sample.sampleId)}
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