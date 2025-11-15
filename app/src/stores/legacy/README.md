# Legacy Stores (Time-Stepping Architecture)

This folder contains the **original time-stepping simulation stores** preserved for:
- Demo purposes
- Backward compatibility
- Reference during migration
- Quick fallback if needed during development

## Files

### `simulationStore.ts` (3,251 lines)
Original monolithic store with time-stepping simulation:
- Progresses time in fixed intervals (100ms ticks)
- Checks all nodes every tick
- Works for demos but doesn't scale to production

### `scenarioStore.ts` (133 lines)
First split from simulationStore during Phase 6.1:
- Manages scenario data (nodes, edges)
- `loadScenario()`, `updateNodeConfigInStore()`, `getSaveReadyScenario()`

### `eventSourcingStore.ts`
Early event sourcing experiments

## Why Moved to Legacy?

The time-stepping approach has fundamental limitations:
1. ❌ **Not production-ready** - Can't handle real-time API streams efficiently
2. ❌ **Non-deterministic** - Timing-dependent, hard to reproduce bugs
3. ❌ **Can't replay** - Lost causality information
4. ❌ **No event sourcing** - Can't audit or prove what happened

## New Architecture (Event-Driven)

Location: `/lib/stores/` and related folders

The new event-driven architecture provides:
- ✅ **Event queue** - Process events as they arrive, no fixed time steps
- ✅ **Deterministic replay** - Same events + same diagram = same outputs
- ✅ **Event sourcing** - Immutable event log for audit/compliance
- ✅ **Production-ready** - Same code for simulation and real streams
- ✅ **Time-travel debugging** - Step forward/backward through event timeline

## When to Use Legacy

- Quick demos of existing functionality
- Testing during migration period
- Reference for understanding original behavior
- Fallback if new architecture has issues

## Migration Plan

Eventually, all components will migrate to the new event-driven stores.
This folder can be deleted once migration is complete and stable.

---

**Last Updated:** October 14, 2025  
**Status:** Preserved for reference, not actively maintained
