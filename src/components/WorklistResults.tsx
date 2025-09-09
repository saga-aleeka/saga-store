

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
  return (
    <div>
      <div className="flex items-center gap-2">
        <Badge />
      {/* Missing Samples */}
      {analysis.missing.length > 0 && (
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
      </div>
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