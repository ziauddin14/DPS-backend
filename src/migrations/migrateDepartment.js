/**
 * ONE-TIME Migration Script for Task Department Field
 *
 * This script is IDEMPOTENT - safe to run multiple times.
 * It will not overwrite existing department values.
 * It will not modify descriptions.
 *
 * Migration Rules:
 * - If task.department === 'ETD' OR task.department === 'NTD' → SKIP (already migrated)
 * - If description contains {ETD} (case insensitive) → department = 'ETD'
 * - If description contains {NTD} (case insensitive) → department = 'NTD'
 * - If neither → department = 'General'
 * - dependency field defaults to 'None' (no migration needed)
 *
 * Idempotency:
 * - First run: All tasks without ETD/NTD are processed
 * - Second run: All tasks are skipped (either have ETD/NTD or already match detected value)
 */

import mongoose from 'mongoose';
import Task from '../models/Task.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dps';

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    const totalTasks = await Task.countDocuments();
    console.log(`Total Tasks: ${totalTasks}\n`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    const tasks = await Task.find({});
    
    for (const task of tasks) {
      try {
        // Skip ONLY if department is ETD or NTD (already migrated with meaningful value)
        if (task.department === 'ETD' || task.department === 'NTD') {
          skipped++;
          console.log(`[SKIP] Task: "${task.title}" - Department already set: ${task.department}`);
          continue;
        }

        const description = task.description || '';
        let newDepartment = 'General';
        let detectedFrom = 'default';

        // Check for {ETD} or {NTD} in description (case insensitive)
        if (/{ETD}/i.test(description)) {
          newDepartment = 'ETD';
          detectedFrom = '{ETD} in description';
        } else if (/{NTD}/i.test(description)) {
          newDepartment = 'NTD';
          detectedFrom = '{NTD} in description';
        }

        // Only update if the detected department differs from current
        if (task.department !== newDepartment) {
          await Task.findByIdAndUpdate(task._id, {
            department: newDepartment,
            dependency: 'None'
          });

          migrated++;
          console.log(`[MIGRATE] Task: "${task.title}" - Department: ${newDepartment} (Detected from: ${detectedFrom})`);
        } else {
          skipped++;
          console.log(`[SKIP] Task: "${task.title}" - Department already set: ${task.department}`);
        }
      } catch (error) {
        failed++;
        console.error(`[FAIL] Task: "${task.title}" - Error: ${error.message}`);
      }
    }

    console.log('\n========================================');
    console.log('Migration Summary');
    console.log('========================================');
    console.log(`Total Tasks: ${totalTasks}`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrate();
