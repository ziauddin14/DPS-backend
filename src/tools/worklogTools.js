/**
 * WorkLog Tools - Re-exports worklog handlers from Tool Executor
 * 
 * This file provides backward compatibility for code that imports worklog tools separately.
 * The actual implementations are in toolExecutor.js HANDLERS object.
 */

import { HANDLERS } from '../services/toolExecutor.js';

export const createWorkLog = HANDLERS.createWorkLog;
export const updateWorkLog = HANDLERS.updateWorkLog;
export const deleteWorkLog = HANDLERS.deleteWorkLog;
export const getWorkLog = HANDLERS.getWorkLog;
export const getWorkLogs = HANDLERS.getWorkLogs;
