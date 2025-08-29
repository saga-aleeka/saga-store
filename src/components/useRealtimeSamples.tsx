import { useState, useEffect, useCallback, useRef } from 'react';

interface RealtimeSamplesProps {
  containerId: string;
  broadcastSampleUpdate?: (containerId: string, samples: any) => void;
  userId?: string;
  userName?: string;
}

export function useRealtimeSamples({ 
  containerId, 
  broadcastSampleUpdate,
  userId,
  userName 
}: RealtimeSamplesProps) {
  const [samples, setSamples] = useState<any>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const samplesRef = useRef<any>([]);
  const storageKey = `samples-${containerId}`;

  // Load samples from localStorage
  const loadSamples = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSamples(parsed);
        samplesRef.current = parsed;
        return parsed;
      }
    } catch (error) {
      console.error('Error loading samples:', error);
    }
    return [];
  }, [storageKey]);

  // Save samples to localStorage and broadcast
  const saveSamples = useCallback((newSamples: any, shouldBroadcast = true) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newSamples));
      setSamples(newSamples);
      samplesRef.current = newSamples;
      setLastUpdate(Date.now());
      
      if (shouldBroadcast && broadcastSampleUpdate) {
        broadcastSampleUpdate(containerId, newSamples);
      }
    } catch (error) {
      console.error('Error saving samples:', error);
    }
  }, [storageKey, containerId, broadcastSampleUpdate]);

  // Handle external sample updates (from other users)
  useEffect(() => {
    const handleSampleUpdate = (event: CustomEvent) => {
      const { containerId: updatedContainerId, samples: updatedSamples } = event.detail;
      
      if (updatedContainerId === containerId) {
        // Update without broadcasting (to avoid loops)
        setSamples(updatedSamples);
        samplesRef.current = updatedSamples;
        setLastUpdate(Date.now());
      }
    };

    window.addEventListener('plasma-sample-update', handleSampleUpdate as EventListener);
    
    return () => {
      window.removeEventListener('plasma-sample-update', handleSampleUpdate as EventListener);
    };
  }, [containerId]);

  // Load samples on mount
  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  // Add sample with optimistic update
  const addSample = useCallback((sampleData: any) => {
    const currentSamples = samplesRef.current;
    let newSamples;

    if (Array.isArray(currentSamples)) {
      newSamples = [...currentSamples, sampleData];
    } else {
      // Handle object format (position-based storage)
      newSamples = { ...currentSamples, [sampleData.position]: sampleData };
    }

    saveSamples(newSamples);
    return newSamples;
  }, [saveSamples]);

  // Remove sample with optimistic update
  const removeSample = useCallback((sampleId: string) => {
    const currentSamples = samplesRef.current;
    let newSamples;

    if (Array.isArray(currentSamples)) {
      newSamples = currentSamples.filter((sample: any) => sample.sampleId !== sampleId);
    } else {
      // Handle object format
      newSamples = { ...currentSamples };
      for (const [position, sample] of Object.entries(newSamples)) {
        if ((sample as any).id === sampleId || (sample as any).sampleId === sampleId) {
          delete newSamples[position];
          break;
        }
      }
    }

    saveSamples(newSamples);
    return newSamples;
  }, [saveSamples]);

  // Update sample with optimistic update
  const updateSample = useCallback((sampleId: string, updateData: any) => {
    const currentSamples = samplesRef.current;
    let newSamples;

    if (Array.isArray(currentSamples)) {
      newSamples = currentSamples.map((sample: any) => 
        sample.sampleId === sampleId ? { ...sample, ...updateData } : sample
      );
    } else {
      // Handle object format
      newSamples = { ...currentSamples };
      for (const [position, sample] of Object.entries(newSamples)) {
        if ((sample as any).id === sampleId || (sample as any).sampleId === sampleId) {
          newSamples[position] = { ...sample, ...updateData };
          break;
        }
      }
    }

    saveSamples(newSamples);
    return newSamples;
  }, [saveSamples]);

  // Get sample count
  const getSampleCount = useCallback(() => {
    if (Array.isArray(samplesRef.current)) {
      return samplesRef.current.length;
    } else if (typeof samplesRef.current === 'object') {
      return Object.keys(samplesRef.current).length;
    }
    return 0;
  }, []);

  // Check if position is occupied
  const isPositionOccupied = useCallback((position: string) => {
    if (Array.isArray(samplesRef.current)) {
      return samplesRef.current.some((sample: any) => sample.position === position);
    } else if (typeof samplesRef.current === 'object') {
      return position in samplesRef.current;
    }
    return false;
  }, []);

  // Get sample at position
  const getSampleAtPosition = useCallback((position: string) => {
    if (Array.isArray(samplesRef.current)) {
      return samplesRef.current.find((sample: any) => sample.position === position);
    } else if (typeof samplesRef.current === 'object') {
      return samplesRef.current[position];
    }
    return null;
  }, []);

  return {
    samples,
    addSample,
    removeSample,
    updateSample,
    getSampleCount,
    isPositionOccupied,
    getSampleAtPosition,
    lastUpdate,
    refresh: loadSamples
  };
}