/**
 * Task Tools - Re-exports task handlers from Tool Executor
 * 
 * This file provides backward compatibility for code that imports task tools separately.
 * The actual implementations are in toolExecutor.js HANDLERS object.
 */

import { HANDLERS } from '../services/toolExecutor.js';

export const createTask = HANDLERS.createTask;
export const updateTask = HANDLERS.updateTask;
export const deleteTask = HANDLERS.deleteTask;
export const getTask = HANDLERS.getTask;
export const getTasks = HANDLERS.getTasks;
export const completeTask = HANDLERS.completeTask;
