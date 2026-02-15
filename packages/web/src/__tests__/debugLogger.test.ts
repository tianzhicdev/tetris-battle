import { describe, it, expect, beforeEach } from 'vitest';
import { DebugLogger } from '../services/debug/DebugLogger';

describe('DebugLogger', () => {
  let logger: DebugLogger;

  beforeEach(() => {
    logger = new DebugLogger();
  });

  it('should log incoming messages', () => {
    logger.logIncoming({ type: 'test', data: 'value' });
    const events = logger.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].direction).toBe('in');
    expect(events[0].type).toBe('test');
  });

  it('should log outgoing messages', () => {
    logger.logOutgoing({ type: 'test', data: 'value' });
    const events = logger.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].direction).toBe('out');
  });

  it('should limit to maxEvents', () => {
    logger.setMaxEvents(3);
    logger.logIncoming({ type: 'msg1' });
    logger.logIncoming({ type: 'msg2' });
    logger.logIncoming({ type: 'msg3' });
    logger.logIncoming({ type: 'msg4' });
    const events = logger.getEvents();
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('msg2'); // First one was dropped
  });

  it('should notify subscribers', () => {
    let notified = false;
    logger.subscribe(() => { notified = true; });
    logger.logIncoming({ type: 'test' });
    expect(notified).toBe(true);
  });

  it('should clear events', () => {
    logger.logIncoming({ type: 'test' });
    logger.clear();
    expect(logger.getEvents()).toHaveLength(0);
  });

  it('should export to JSON', () => {
    logger.logIncoming({ type: 'test', value: 123 });
    const json = logger.exportToJSON();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe('test');
  });

  it('should unsubscribe correctly', () => {
    let count = 0;
    const unsubscribe = logger.subscribe(() => { count++; });
    logger.logIncoming({ type: 'test1' });
    expect(count).toBe(1);
    unsubscribe();
    logger.logIncoming({ type: 'test2' });
    expect(count).toBe(1); // Should not increment
  });
});
