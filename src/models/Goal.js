import mongoose from 'mongoose';

const GoalSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters long'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: {
        values: ['Life', '5 Years', '1 Year', '90 Days', 'Monthly', 'Weekly', 'Daily'],
        message: '{VALUE} is not a valid goal type',
      },
    },
    priority: {
      type: String,
      enum: {
        values: ['High', 'Medium', 'Low'],
        message: '{VALUE} is not a valid priority',
      },
      default: 'Medium',
    },
    status: {
      type: String,
      enum: {
        values: ['Not Started', 'In Progress', 'Completed', 'On Hold'],
        message: '{VALUE} is not a valid status',
      },
      default: 'Not Started',
    },
    progress: {
      type: Number,
      default: 0,
      min: [0, 'Progress cannot be less than 0'],
      max: [100, 'Progress cannot exceed 100'],
    },
    startDate: {
      type: Date,
    },
    targetDate: {
      type: Date,
    },
    completedDate: {
      type: Date,
    },
    category: {
      type: String,
      default: 'General',
    },
    notes: {
      type: String,
      default: '',
    },
    color: {
      type: String,
      default: 'Blue',
    },
    icon: {
      type: String,
      default: 'Target',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model overwrite during development hot reloads
const Goal = mongoose.models.Goal || mongoose.model('Goal', GoalSchema);

export default Goal;
export { Goal };
