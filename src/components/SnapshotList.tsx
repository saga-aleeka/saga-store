import * as React from "react";
// (deleted)
interface SnapshotEntry {
  container: any;
  samples: any[];
}

interface SnapshotListProps {
  onRevert: (containerId: string, samples: any[]) => void;
}

export const SnapshotList: React.FC<SnapshotListProps> = ({ onRevert }) => {
  // Find all snapshot keys
  const backupKeys = Object.keys(localStorage)
    .filter((k) => k.startsWith("nightly-backup-"))
    .sort()
    .reverse();
  const [selectedDate, setSelectedDate] = React.useState(backupKeys[0] || "");
  const [sampleTypeFilter, setSampleTypeFilter] = React.useState<string>("");

  const snapshotData: SnapshotEntry[] = React.useMemo(() => {
    if (!selectedDate) return [];
    try {
      const raw = localStorage.getItem(selectedDate);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }, [selectedDate]);

  // Get all sample types in this snapshot
  const allSampleTypes = Array.from(
    new Set(
      snapshotData.map((entry) => entry.container.sampleType).filter(Boolean)
    )
  );
  const filtered = sampleTypeFilter
    ? snapshotData.filter((entry) => entry.container.sampleType === sampleTypeFilter)
    : snapshotData;

  return (
    <div>
      <div className="flex gap-4 mb-4 flex-wrap">
        <label>
          Snapshot Date:
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="ml-2 border rounded px-2 py-1"
          >
            {backupKeys.map((k) => (
              <option key={k} value={k}>
                {k.replace("nightly-backup-", "")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sample Type:
          <select
            value={sampleTypeFilter}
            onChange={(e) => setSampleTypeFilter(e.target.value)}
            className="ml-2 border rounded px-2 py-1"
          >
            <option value="">All</option>
            {allSampleTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="space-y-4">
        {filtered.length === 0 && <div className="text-muted-foreground">No containers in this snapshot.</div>}
        {filtered.map((entry) => (
          <div key={entry.container.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <b>{entry.container.name}</b> <span className="text-xs text-muted-foreground">({entry.container.sampleType})</span>
              <div className="text-xs text-muted-foreground">Location: {entry.container.location}</div>
            </div>
            <button
              className="bg-blue-600 text-white rounded px-3 py-1 mt-2 md:mt-0"
              onClick={() => onRevert(entry.container.id, entry.samples)}
            >
              Revert to this snapshot
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
