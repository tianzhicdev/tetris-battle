import { describe, it, expect, beforeEach } from 'vitest';
import { useDebugStore } from '../stores/debugStore';

describe('DebugStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useDebugStore.setState({
      isOpen: false,
      position: { x: 10, y: 10 },
      collapsedSections: new Set(),
      eventLimit: 100,
      autoScroll: true,
      selectedTarget: 'opponent',
      pingHistory: [],
    });
  });

  it('should toggle panel open/closed', () => {
    expect(useDebugStore.getState().isOpen).toBe(false);
    useDebugStore.getState().togglePanel();
    expect(useDebugStore.getState().isOpen).toBe(true);
    useDebugStore.getState().togglePanel();
    expect(useDebugStore.getState().isOpen).toBe(false);
  });

  it('should update position', () => {
    useDebugStore.getState().setPosition(100, 200);
    expect(useDebugStore.getState().position).toEqual({ x: 100, y: 200 });
  });

  it('should toggle sections', () => {
    useDebugStore.getState().toggleSection('events');
    expect(useDebugStore.getState().collapsedSections.has('events')).toBe(true);
    useDebugStore.getState().toggleSection('events');
    expect(useDebugStore.getState().collapsedSections.has('events')).toBe(false);
  });

  it('should add ping results and limit to 10', () => {
    for (let i = 0; i < 15; i++) {
      useDebugStore.getState().addPingResult(i * 10);
    }
    expect(useDebugStore.getState().pingHistory).toHaveLength(10);
    expect(useDebugStore.getState().pingHistory[0]).toBe(50); // First 5 were dropped
  });

  it('should change selected target', () => {
    useDebugStore.getState().setSelectedTarget('self');
    expect(useDebugStore.getState().selectedTarget).toBe('self');
  });

  it('should update event limit', () => {
    useDebugStore.getState().setEventLimit(50);
    expect(useDebugStore.getState().eventLimit).toBe(50);
  });

  it('should update auto scroll', () => {
    useDebugStore.getState().setAutoScroll(false);
    expect(useDebugStore.getState().autoScroll).toBe(false);
  });
});
