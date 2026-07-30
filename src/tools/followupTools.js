/**
 * Follow-up Tools - Re-exports follow-up handlers from Tool Executor
 * 
 * This file provides backward compatibility for code that imports follow-up tools separately.
 * The actual implementations are in toolExecutor.js HANDLERS object.
 */

import { HANDLERS } from '../services/toolExecutor.js';

export const createFollowUp = HANDLERS.createFollowUp;
export const updateFollowUp = HANDLERS.updateFollowUp;
export const deleteFollowUp = HANDLERS.deleteFollowUp;
export const getFollowUp = HANDLERS.getFollowUp;
export const getFollowUps = HANDLERS.getFollowUps;
