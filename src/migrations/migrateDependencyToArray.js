/**
 * Migration: Convert dependency field from String to Array<String>
 * 
 * Rules:
 * - If dependency is already an Array → Keep it unchanged
 * - If dependency is a String → Convert to Array: "IT" → ["IT"]
 * - If dependency is null/undefined → Convert to []
 * - Migration is idempotent: can be run multiple times safely
 * - Never deletes documents
 * - Never overwrites valid array data
 */

import mongoose from 'mongoose';
import Task from '../models/Task.js';

async function migrateDependencyToArray() {
  try {
    console.log('🔄 Starting dependency migration (String → Array)...');

    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dps';
      await mongoose.connect(MONGODB_URI);
      console.log('✅ Connected to MongoDB');
    }

    // Get all tasks
    const tasks = await Task.find({});
    console.log(`📊 Found ${tasks.length} tasks to process`);

    let convertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const task of tasks) {
      try {
        const dependency = task.dependency;

        // Skip if already an array
        if (Array.isArray(dependency)) {
          skippedCount++;
          console.log(`⏭️  Skipped (already array): "${task.title}"`);
          continue;
        }

        // Convert string to array
        if (typeof dependency === 'string' && dependency.trim() !== '') {
          task.dependency = [dependency];
          await task.save();
          convertedCount++;
          console.log(`✅ Converted: "${task.title}" - "${dependency}" → [${dependency}]`);
        } 
        // Convert null/undefined/empty string to empty array
        else {
          task.dependency = [];
          await task.save();
          convertedCount++;
          console.log(`✅ Converted: "${task.title}" - null/empty → []`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing task "${task.title}":`, error.message);
      }
    }

    console.log('\n📋 Migration Summary:');
    console.log(`✅ Converted: ${convertedCount}`);
    console.log(`⏭️  Skipped (already array): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${tasks.length}`);
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close connection if we opened it
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDependencyToArray();
}

export default migrateDependencyToArray;
