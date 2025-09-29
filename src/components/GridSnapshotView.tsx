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
  onConvert?: (container: Container) => void;
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


const GridSnapshotView: React.FC<GridSnapshotViewProps> = ({ containers, onConvert }) => {
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<string | null>(null);

  const sampleTypes = getSampleTypes(containers);

  return (
    <div>
      {sampleTypes.map(sampleType => {
        const containersOfType = getContainersBySampleType(containers, sampleType);
        return (
          <div key={sampleType} style={{ marginBottom: 32 }}>
            <h2 style={{ fontWeight: "bold", fontSize: 18 }}>{sampleType}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {containersOfType.map(container => {
                const grid = getPositions([container]);
                const columns = grid.columns;
                const rows = grid.rows;
                const isOpen = openDropdown === container.id;
                return (
                  <div key={container.id} style={{ border: '1px solid #ddd', borderRadius: 8, marginBottom: 8, background: '#fafbfc' }}>
                    <div
                      style={{ cursor: 'pointer', padding: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      onClick={() => setOpenDropdown(isOpen ? null : container.id)}
                    >
                      <span>{container.name}</span>
                      <span style={{ fontSize: 18 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                    {isOpen && (
                      <div style={{ padding: 16, background: '#fff', borderTop: '1px solid #eee' }}>
                        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                          <table style={{ borderCollapse: 'collapse', minWidth: 400, maxWidth: '100%' }}>
                            <thead>
                              <tr>
                                <th></th>
                                {columns.map(col => (
                                  <th key={col} style={{ background: '#f5f5f5', textAlign: 'center' }}>{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(rowNum => (
                                <tr key={rowNum}>
                                  <td style={{ fontWeight: 'bold' }}>{rowNum}</td>
                                  {columns.map(col => {
                                    const pos = `${rowNum}${col}`;
                                    const sample = container.samples.find(s => s.position === pos);
                                    return (
                                      <td key={pos} style={{ border: '1px solid #ccc', textAlign: 'center', minWidth: 40, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {sample ? sample.id || sample.sampleId : ''}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <button
                            style={{
                              background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', marginRight: 8
                            }}
                            onClick={() => setConfirming(container.id)}
                          >
                            Convert
                          </button>
                        </div>
                        {confirming === container.id && (
                          <div style={{ marginTop: 12, background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 4, padding: 12 }}>
                            <div style={{ marginBottom: 8 }}>Are you sure you want to convert and overwrite this container with the above snapshot?</div>
                            <button
                              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600, marginRight: 8, cursor: 'pointer' }}
                              onClick={() => {
                                setConfirming(null);
                                if (onConvert) onConvert(container);
                              }}
                            >Yes, Convert</button>
                            <button
                              style={{ background: '#e11d48', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}
                              onClick={() => setConfirming(null)}
                            >Cancel</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GridSnapshotView;
