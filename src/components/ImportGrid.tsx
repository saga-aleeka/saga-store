import React, { useState } from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './ui/table';

export default function ImportGrid() {
  // Example grid state: 5x5 for demo, can be made dynamic
  const [grid, setGrid] = useState(
    Array.from({ length: 5 }, (_, row) =>
      Array.from({ length: 5 }, (_, col) => ({ value: '', row, col }))
    )
  );

  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    setGrid(prev =>
      prev.map((row, r) =>
        row.map((cell, c) =>
          r === rowIdx && c === colIdx ? { ...cell, value } : cell
        )
      )
    );
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Row/Col</TableHead>
            {[1,2,3,4,5].map(col => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {grid.map((row, rowIdx) => (
            <TableRow key={rowIdx}>
              <TableHead>{String.fromCharCode(65 + rowIdx)}</TableHead>
              {row.map((cell, colIdx) => (
                <TableCell key={colIdx}>
                  <input
                    className="border rounded px-1 py-0.5 w-16 text-xs"
                    value={cell.value}
                    onChange={e => handleCellChange(rowIdx, colIdx, e.target.value)}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
