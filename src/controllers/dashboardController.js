import { Task } from '../models/Task.js';
import { Goal } from '../models/Goal.js';
import { Event } from '../models/Event.js';
import { Project } from '../models/Project.js';
import { Knowledge } from '../models/Knowledge.js';
import { FollowUp } from '../models/FollowUp.js';
import WorkLog from '../models/WorkLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';

// ─── Date boundary helpers ────────────────────────────────────────────────────

/**
 * Returns a UTC-midnight Date for `daysAgo` days before today (local).
 * @param {number} daysAgo
 * @returns {Date}
 */
function localMidnight(daysAgo = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/**
 * Format a Date as YYYY-MM-DD in local time.
 * @param {Date} date
 * @returns {string}
 */
function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── WorkLog helpers ──────────────────────────────────────────────────────────

/**
 * Build category breakdown from WorkLogs in the last 7 days.
 * Returns [{category, hours}] sorted by hours desc.
 */
async function buildCategoryBreakdown() {
  const since = localMidnight(6); // 7 days window: today - 6 days ago inclusive

  const rows = await WorkLog.aggregate([
    { $match: { activityDate: { $gte: since } } },
    {
      $group: {
        _id: '$category',
        totalMinutes: { $sum: '$durationMinutes' },
      },
    },
    { $sort: { totalMinutes: -1 } },
    {
      $project: {
        _id: 0,
        category: '$_id',
        hours: {
          $round: [{ $divide: ['$totalMinutes', 60] }, 2],
        },
      },
    },
  ]);

  return rows;
}

/**
 * Build a 28-day daily heatmap.
 * Every day in the range is present even if no worklogs exist.
 * Returns [{date, count, minutes}] ordered oldest → today.
 */
async function buildDailyHeatmap() {
  const since = localMidnight(27); // 28 days inclusive (today − 27)
  const today = localMidnight(0);

  const rows = await WorkLog.aggregate([
    { $match: { activityDate: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$activityDate', timezone: 'UTC' },
        },
        count: { $sum: 1 },
        minutes: { $sum: '$durationMinutes' },
      },
    },
  ]);

  // Index the aggregated results by date string
  const byDate = {};
  for (const row of rows) {
    byDate[row._id] = { count: row.count, minutes: row.minutes };
  }

  // Fill every date in the window
  const heatmap = [];
  for (let i = 27; i >= 0; i--) {
    const d = localMidnight(i);
    const key = toYMD(d);
    heatmap.push({
      date: key,
      count: byDate[key]?.count ?? 0,
      minutes: byDate[key]?.minutes ?? 0,
    });
  }

  return heatmap;
}

/**
 * Calculate the current consecutive-day streak ending today.
 * A day counts if at least one WorkLog entry exists.
 * @returns {number}
 */
async function buildStreak() {
  // Fetch distinct active dates for the last 365 days to cap the query
  const since = localMidnight(364);

  const rows = await WorkLog.aggregate([
    { $match: { activityDate: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$activityDate', timezone: 'UTC' },
        },
      },
    },
  ]);

  const activeDates = new Set(rows.map((r) => r._id));

  let streak = 0;
  let daysBack = 0;

  while (true) {
    const key = toYMD(localMidnight(daysBack));
    if (activeDates.has(key)) {
      streak++;
      daysBack++;
    } else {
      break;
    }
  }

  return streak;
}

// ─── Goal progress helper ─────────────────────────────────────────────────────

/**
 * Build weekly / monthly / yearly goal progress from Goal.type.
 * Weekly  → type 'Weekly'
 * Monthly → type 'Monthly'
 * Yearly  → type '1 Year'
 */
async function buildGoalProgress() {
  const rows = await Goal.aggregate([
    {
      $match: { type: { $in: ['Weekly', 'Monthly', '1 Year'] } },
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
        },
      },
    },
  ]);

  const map = {};
  for (const row of rows) {
    map[row._id] = { total: row.total, completed: row.completed };
  }

  const empty = { completed: 0, total: 0 };

  return {
    weekly: map['Weekly'] || empty,
    monthly: map['Monthly'] || empty,
    yearly: map['1 Year'] || empty,
  };
}

// ─── Today timeline helper ────────────────────────────────────────────────────

/**
 * Merge today's Events (meetings/events/birthdays/reminders) and
 * due Follow-ups into a single sorted timeline.
 * todayEvents are already fetched in the main query; passed in to avoid re-query.
 * @param {Array} todayEvents
 * @param {Date}  startOfToday
 * @param {Date}  endOfToday
 * @returns {Promise<Array>}
 */
async function buildTodayTimeline(todayEvents, startOfToday, endOfToday) {
  // Fetch today's follow-ups (only fields needed for the timeline)
  const todayFollowupDocs = await FollowUp.find({
    nextFollowupDate: { $gte: startOfToday, $lte: endOfToday },
    status: { $ne: 'Completed' },
  })
    .select('personName subject nextFollowupDate priority status')
    .lean();

  const timeline = [];

  // Map events
  for (const ev of todayEvents) {
    const isBirthday = ev.type === 'Birthday';
    timeline.push({
      type: isBirthday ? 'birthday' : 'event',
      title: ev.title,
      time: ev.time || null,
      eventType: ev.type,
      location: ev.location || null,
      reminder: ev.reminder || false,
      startDate: ev.startDate,
      _id: ev._id,
    });
  }

  // Map follow-ups
  for (const fu of todayFollowupDocs) {
    timeline.push({
      type: 'followup',
      title: fu.subject,
      time: null,
      personName: fu.personName,
      priority: fu.priority,
      status: fu.status,
      nextFollowupDate: fu.nextFollowupDate,
      _id: fu._id,
    });
  }

  // Sort: entries with a time string first (ascending), then null-time entries
  timeline.sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });

  return timeline;
}

// ─── Controller ───────────────────────────────────────────────────────────────

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

  // ── Phase 1: Run all independent queries in parallel ────────────────────────
  const [
    // ── Existing queries (unchanged) ──
    totalTasks,
    pendingTasks,
    inProgressTasks,
    completedTasks,
    totalGoals,
    completedGoals,
    activeGoals,
    inProgressGoals,
    totalProjects,
    completedProjects,
    inProgressProjects,
    activeProjectsDocs,
    totalKnowledge,
    recentNotes,
    todayEvents,
    upcomingEvents,
    todayFollowupsCount,

    // ── New parallel queries ──
    categoryBreakdown,
    dailyHeatmap,
    streak,
    goalProgress,
  ] = await Promise.all([
    // Tasks stats
    Task.countDocuments({}),
    Task.countDocuments({ status: 'Pending' }),
    Task.countDocuments({ status: 'In Progress' }),
    Task.countDocuments({ status: 'Completed' }),

    // Goals stats
    Goal.countDocuments({}),
    Goal.countDocuments({ status: 'Completed' }),
    Goal.countDocuments({ status: { $ne: 'Completed' } }),
    Goal.countDocuments({ status: 'In Progress' }),

    // Projects stats
    Project.countDocuments({}),
    Project.countDocuments({ status: 'Completed' }),
    Project.countDocuments({ status: 'In Progress' }),
    // Phase 6: activeProjects now selects the progress field explicitly
    Project.find({ status: { $ne: 'Completed' } })
      .select('title status priority category progress startDate deadline client technologies')
      .sort({ updatedAt: -1 })
      .limit(3)
      .lean(),

    // Knowledge stats
    // Phase 7: select type explicitly so it is always returned
    Knowledge.countDocuments({}),
    Knowledge.find({})
      .select('title type category content source favorite color icon createdAt')
      .sort({ createdAt: -1 })
      .limit(4)
      .lean(),

    // Calendar events
    Event.find({ startDate: { $gte: startOfToday, $lte: endOfToday } })
      .sort({ startDate: 1 })
      .lean(),
    Event.find({ startDate: { $gt: endOfToday } })
      .sort({ startDate: 1 })
      .limit(5)
      .lean(),

    // Follow-ups stats (count only – timeline query runs separately below)
    FollowUp.countDocuments({
      nextFollowupDate: { $gte: startOfToday, $lte: endOfToday },
      status: { $ne: 'Completed' },
    }),

    // New WorkLog analytics
    buildCategoryBreakdown(),
    buildDailyHeatmap(),
    buildStreak(),

    // New Goal progress breakdown
    buildGoalProgress(),
  ]);

  // ── Phase 2: Today timeline (depends on todayEvents result) ─────────────────
  const todayTimeline = await buildTodayTimeline(todayEvents, startOfToday, endOfToday);

  // ── Compose response (all existing keys preserved) ───────────────────────────
  const dashboardData = {
    // ── Existing keys ──────────────────────────────────────────────────────────
    tasks: {
      total: totalTasks,
      pending: pendingTasks,
      inProgress: inProgressTasks,
      completed: completedTasks,
    },
    goals: {
      total: totalGoals,
      completed: completedGoals,
      active: activeGoals,
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
      // Phase 6: progress field now guaranteed in each document
      activeProjects: activeProjectsDocs,
    },
    knowledge: {
      total: totalKnowledge,
      // Phase 7: type field now explicitly selected in every item
      recentNotes,
    },
    followups: {
      todayFollowups: todayFollowupsCount,
    },

    // ── New keys (Phase 1–7 extensions) ────────────────────────────────────────
    workLogs: {
      categoryBreakdown,
      dailyHeatmap,
      streak,
    },
    goalProgress,
    todayTimeline,
  };

  return sendSuccess(res, 'Dashboard data retrieved successfully', dashboardData, 200);
});
