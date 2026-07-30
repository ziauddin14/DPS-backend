/**
 * Project Tools - Re-exports project handlers from Tool Executor
 * 
 * This file provides backward compatibility for code that imports project tools separately.
 * The actual implementations are in toolExecutor.js HANDLERS object.
 */

import { HANDLERS } from '../services/toolExecutor.js';

export const createProject = HANDLERS.createProject;
export const updateProject = HANDLERS.updateProject;
export const deleteProject = HANDLERS.deleteProject;
export const getProject = HANDLERS.getProject;
export const getProjects = HANDLERS.getProjects;
