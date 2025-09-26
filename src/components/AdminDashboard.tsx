
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
// ...other imports as needed

// Types for preview objects
interface Preview<T> {
  valid: boolean;
  data: T[];
  errors: string[];
};

  // State for containers
  const [containers, setContainers] = useState<Array<{ name: string; location: string; containerType: string; sampleType: string; temperature: string; id: string }>>([]);
  
  const handleContainerFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        // TODO: Grid import parser has been removed. Implement new logic or show error.
        // const parsed = parseGridImport(content);
        // if (parsed.containers.length > 0) {
        //   ...
        // }
        // For now, show an alert or handle as needed:
        alert('Grid import is no longer supported. Please use the standard CSV import.');
      };
      reader.readAsText(file);
    }
  };




  const sampleTemplate = `containerName,sampleId,position
"cfDNA_BOX_001","C01039DPP1B","A1"
"cfDNA_BOX_001","C01040DPP2B","A2"`;

  // Helper: Export containers as CSV
  const exportContainers = () => {
    const csvContent = [
      'name,location,containerType,sampleType,temperature',
      ...containers.map(c => `"${c.name}","${c.location}","${c.containerType}","${c.sampleType}","${c.temperature}"`)
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'containers-export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };


  // Helper: Export samples as CSV
  const exportSamples = () => {
    let rows = ['containerId,sampleId,position'];
    containers.forEach(container => {
      const storageKey = `samples-${container.id}`;
      const savedSamples = localStorage.getItem(storageKey);
      if (savedSamples) {
        const samples = JSON.parse(savedSamples);
        Object.entries(samples).forEach(([position, sample]) => {
          const typedSample = sample as { id: string }; // Cast sample to the expected type
          rows.push(`"${container.id}","${typedSample.id}","${position}"`);
        });
      }
    });
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'samples-export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const [showClearDialog, setShowClearDialog] = useState(false);




    
