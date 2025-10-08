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
function normalisePosition(value: unknown): { row: string | null; column: string | null } {
  if (typeof value !== 'string') {
    return { row: null, column: null };
  }
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return { row: null, column: null };
  const match = trimmed.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { row: null, column: null };
  const [, row, column] = match;
  return { row, column: String(Number(column)) };
}

function normaliseSamples(samples: any): Sample[] {
  // Handle array input and object-mapping input
  if (Array.isArray(samples)) {
    return samples.map(s => {
      const pos = typeof s.position === 'string' ? s.position.trim().toUpperCase() : (s.position ? String(s.position).trim().toUpperCase() : '');
      const sampleId = (s.sampleId ?? s.sample_id ?? s.id ?? s.code ?? '').toString().trim();
      return { ...s, position: pos, sampleId } as Sample;
    });
  }

  if (samples && typeof samples === 'object') {
    return Object.entries(samples).map(([position, value]) => {
      if (value && typeof value === 'object') {
        const sampleId = (value as any).sampleId ?? (value as any).sample_id ?? (value as any).id ?? (value as any).sample ?? (value as any).code ?? '';
        const resolvedId = typeof (value as any).id === 'string' ? (value as any).id : typeof sampleId === 'string' ? sampleId : String(sampleId ?? '');
        const rawPosition = typeof (value as any).position === 'string' && (value as any).position.trim().length > 0 ? (value as any).position : position;
        const pos = String(rawPosition).trim().toUpperCase();
        return {
          ...(value as Record<string, any>),
          id: resolvedId,
          sampleId: typeof sampleId === 'string' ? sampleId.trim() : String(sampleId ?? ''),
          position: pos,
        } as Sample;
      }
      const fallbackId = value != null ? String(value) : '';
      return { id: fallbackId, sampleId: fallbackId, position: String(position).trim().toUpperCase() } as Sample;
    });
  }

  return [];
}

function getSampleDisplayId(sample: any): string {
  if (!sample || typeof sample !== 'object') return '';
  const id = sample.sampleId ?? sample.sample_id ?? sample.id ?? sample.sample ?? sample.code ?? '';
  return typeof id === 'string' ? id : String(id);
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
    // Fallback: infer rows/columns from stored sample positions (row letters, column numbers)
    const columnSet = new Set<string>();
    const rowSet = new Set<string>();

    containers.forEach(container => {
      const samples = Array.isArray(container.samples) ? container.samples : [];
      samples.forEach(sample => {
        const { row, column } = normalisePosition((sample && (sample.position ?? sample.pos)) || sample?.position);
        if (row) rowSet.add(row);
        if (column) columnSet.add(column);
      });
    });

    return {
      columns: Array.from(columnSet).sort((a, b) => Number(a) - Number(b)),
      rows: Array.from(rowSet).sort((a, b) => a.localeCompare(b)),
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
