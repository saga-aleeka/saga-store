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
function getPositions(containers: Container[]): string[] {
  const positions = new Set<string>();
  containers.forEach(c => c.samples.forEach(s => positions.add(s.position)));
  return Array.from(positions).sort();
}

const GridSnapshotView: React.FC<GridSnapshotViewProps> = ({ containers }: GridSnapshotViewProps) => {
  const sampleTypes = getSampleTypes(containers);

  return (
    <div>
      {sampleTypes.map(sampleType => {
        const containersOfType = getContainersBySampleType(containers, sampleType);
        const positions = getPositions(containersOfType);
        return (
          <div key={sampleType} style={{ marginBottom: 32 }}>
            <h2 style={{ fontWeight: "bold", fontSize: 18 }}>{sampleType}</h2>
            <div style={{ display: "flex", gap: 32 }}>
              {containersOfType.map(container => (
                <table key={container.id} style={{ borderCollapse: "collapse", minWidth: 200 }}>
                  <thead>
                    <tr>
                      <th colSpan={positions.length + 1} style={{ background: "#eee", textAlign: "center" }}>{container.name}</th>
                    </tr>
                    <tr>
                      <th></th>
                      {positions.map(pos => (
                        <th key={pos} style={{ background: "#f5f5f5", textAlign: "center" }}>{pos}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Contents</td>
                      {positions.map(pos => {
                        const sample = container.samples.find(s => s.position === pos);
                        return (
                          <td key={pos} style={{ border: "1px solid #ccc", textAlign: "center" }}>
                            {sample ? sample.id : ""}
                          </td>
                        );
                      })}
                    </tr>
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
