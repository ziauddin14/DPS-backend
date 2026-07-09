import { Task } from '../models/Task.js';
import { Goal } from '../models/Goal.js';
import { Event } from '../models/Event.js';
import { Project } from '../models/Project.js';
import { Knowledge } from '../models/Knowledge.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * @desc    Get aggregated dashboard stats and recent data
 * @route   GET /api/v1/dashboard
 * @access  Public
 */
export const getDashboardData = asyncHandler(async (req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // Run aggregation queries in parallel for efficiency
  const [
    totalTasks,
    pendingTasks,
    completedTasks,
    totalGoals,
    completedGoals,
    inProgressGoals,
    totalProjects,
    completedProjects,
    inProgressProjects,
    activeProjects,
    totalKnowledge,
    recentNotes,
    todayEvents,
    upcomingEvents,
  ] = await Promise.all([
    // Tasks stats
    Task.countDocuments({}),
    Task.countDocuments({ status: { $ne: 'Completed' } }),
    Task.countDocuments({ status: 'Completed' }),

    // Goals stats
    Goal.countDocuments({}),
    Goal.countDocuments({ status: 'Completed' }),
    Goal.countDocuments({ status: 'In Progress' }),

    // Projects stats
    Project.countDocuments({}),
    Project.countDocuments({ status: 'Completed' }),
    Project.countDocuments({ status: 'In Progress' }),
    Project.find({ status: { $ne: 'Completed' } }).sort({ updatedAt: -1 }).limit(3),

    // Knowledge stats
    Knowledge.countDocuments({}),
    Knowledge.find({}).sort({ createdAt: -1 }).limit(4),

    // Calendar events
    Event.find({ startDate: { $gte: startOfToday, $lte: endOfToday } }).sort({ startDate: 1 }),
    Event.find({ startDate: { $gt: endOfToday } }).sort({ startDate: 1 }).limit(5),
  ]);

  const dashboardData = {
    tasks: {
      total: totalTasks,
      pending: pendingTasks,
      completed: completedTasks,
    },
    goals: {
      total: totalGoals,
      completed: completedGoals,
      inProgress: inProgressGoals,
    },
    calendar: {
      todayEvents,
      upcomingEvents,
    },
    projects: {
      total: totalProjects,
      completed: completedProjects,
      inProgress: inProgressProjects,
      activeProjects,
    },
    knowledge: {
      total: totalKnowledge,
      recentNotes,
    },
  };

  return sendSuccess(res, 'Dashboard data retrieved successfully', dashboardData, 200);
});
