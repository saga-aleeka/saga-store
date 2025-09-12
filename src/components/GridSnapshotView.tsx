import * as React from "react";

export interface Sample {
  id: string;
  position: string;
  [key: string]: any;
}

export interface Container {
  id: string;
  name: string;
  sampleType: string;
  samples: Sample[];
  containerType?: string;
}

export interface GridSnapshotViewProps {
  containers: Container[];
}

// Helper to get unique sample types
function getSampleTypes(containers: Container[]): string[] {
  return Array.from(new Set(containers.map(c => c.sampleType)));
}

// Helper to get containers by sample type
function getContainersBySampleType(containers: Container[], sampleType: string): Container[] {
  return containers.filter(c => c.sampleType === sampleType);
}

// Helper to get unique positions (A, B, C, ...)
interface GridPositions {
  columns: string[];
  rows: string[];
}
function getPositions(containers: Container[]): GridPositions {
  // Always pad grid to full size based on container type
  if (containers.length === 0) {
    return { columns: [], rows: [] };
  }
  const type = containers[0].containerType;
  if (type === '5x5-box') {
    return {
      columns: ['1','2','3','4','5'],
      rows: ['A','B','C','D','E']
    };
  } else if (type === '9x9-box') {
    return {
      columns: ['1','2','3','4','5','6','7','8','9'],
      rows: ['A','B','C','D','E','F','G','H','I']
    };
  } else {
    // Fallback: use detected positions
    const columns = new Set<string>();
    const rows = new Set<string>();
    containers.forEach(c => c.samples.forEach(s => {
      if (s.position && typeof s.position === 'string' && s.position.length > 1) {
        columns.add(s.position[0]);
        rows.add(s.position.slice(1));
      }
    }));
    return {
      columns: Array.from(columns).sort(),
      rows: Array.from(rows).sort((a,b) => Number(a)-Number(b))
    };
  }
}

const GridSnapshotView: React.FC<GridSnapshotViewProps> = ({ containers }: GridSnapshotViewProps) => {
  const sampleTypes = getSampleTypes(containers);

  return (
    <div>
      {sampleTypes.map(sampleType => {
        const containersOfType = getContainersBySampleType(containers, sampleType);
        // Get full grid columns and rows for this sample type
        const grid = getPositions(containersOfType);
        const columns = grid.columns;
        const rows = grid.rows;
        return (
          <div key={sampleType} style={{ marginBottom: 32 }}>
            <h2 style={{ fontWeight: "bold", fontSize: 18 }}>{sampleType}</h2>
            <div style={{ display: "flex", gap: 32 }}>
              {containersOfType.map(container => (
                <table key={container.id} style={{ borderCollapse: "collapse", minWidth: 200 }}>
                  <thead>
                    <tr>
                      <th colSpan={columns.length + 1} style={{ background: "#eee", textAlign: "center" }}>{container.name}</th>
                    </tr>
                    <tr>
                      <th></th>
                      {columns.map((col: string) => (
                        <th key={col} style={{ background: "#f5f5f5", textAlign: "center" }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((rowNum: string) => (
                      <tr key={rowNum}>
                        <td style={{ fontWeight: "bold" }}>{rowNum}</td>
                        {columns.map((col: string) => {
                          const pos = `${rowNum}${col}`;
                          const sample = container.samples.find(s => s.position === pos);
                          return (
                            <td key={pos} style={{ border: "1px solid #ccc", textAlign: "center" }}>
                              {sample ? sample.id || sample.sampleId : ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GridSnapshotView;
