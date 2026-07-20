import mongoose from 'mongoose';

const WorkLogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters long'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    category: {
      type: String,
      enum: {
        values: ['Email', 'WhatsApp', 'Phone Call', 'Meeting', 'Documentation', 'Research', 'Development', 'Testing', 'Planning', 'Learning', 'Office Work', 'Deployment', 'Bug Fix', 'Support', 'Other'],
        message: '{VALUE} is not a valid category',
      },
      default: 'Other',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    activityDate: {
      type: Date,
      required: [true, 'Activity date is required'],
      default: Date.now,
    },
    startTime: {
      type: String,
      trim: true,
    },
    endTime: {
      type: String,
      trim: true,
    },
    durationMinutes: {
      type: Number,
      min: [0, 'Duration cannot be negative'],
    },
    relatedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
    },
    relatedFollowup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FollowUp',
    },
    department: {
      type: String,
      trim: true,
      maxlength: [50, 'Department cannot exceed 50 characters'],
    },
    createdBy: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model overwrite during development hot reloads
const WorkLog = mongoose.models.WorkLog || mongoose.model('WorkLog', WorkLogSchema);

export default WorkLog;
export { WorkLog };
