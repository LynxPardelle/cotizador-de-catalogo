import { FlowMeasurement } from './pilot-tracker';
describe('Ephemeral quote flow measurement',()=>{
  let now=0;let sequence=0;let flow:FlowMeasurement;
  beforeEach(()=>{now=0;sequence=0;flow=new FlowMeasurement(()=>now,()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`);});
  it('starts at interaction and limits inactive time to sixty seconds',()=>{now=50000;flow.interact();now+=120000;expect(flow.freeze().activeDurationMs).toBe(60000);});
  it('accumulates visible focused work across interactions using a monotonic clock',()=>{flow.interact();now=40000;flow.interact();now=80000;flow.interact();now=120000;expect(flow.freeze().activeDurationMs).toBe(120000);});
  it('excludes hidden and unfocused intervals without restarting activity on focus alone',()=>{flow.interact();now=10000;flow.setActive(false);now=80000;flow.setActive(true);now=90000;flow.interact();now=100000;expect(flow.freeze().activeDurationMs).toBe(20000);});
  it('counts only distinct successful configuration transitions',()=>{flow.interact();flow.previewSucceeded('A');flow.previewSucceeded('A');flow.previewSucceeded('B');flow.previewSucceeded('B');flow.previewSucceeded('A');expect(flow.freeze().adjustments).toBe(2);});
  it('freezes metadata once across retries and later changes',()=>{flow.interact();now=2000;const first=flow.freeze();now=9000;flow.interact();flow.previewSucceeded('B');expect(flow.freeze()).toEqual(first);expect(first.activeDurationMs).toBe(2000);});
  it('starts a new identity after a completed flow is reset',()=>{flow.interact();const first=flow.freeze();flow.reset();now=20000;flow.interact();const next=flow.freeze();expect(next.flowId).not.toBe(first.flowId);expect(next.activeDurationMs).toBe(0);expect(next.adjustments).toBe(0);});
});
