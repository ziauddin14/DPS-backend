import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema(
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
        values: ['Pending', 'In Progress', 'Completed'],
        message: '{VALUE} is not a valid status',
      },
      default: 'Pending',
    },
    category: {
      type: String,
      default: 'General',
    },
    department: {
      type: String,
      default: 'General',
    },
    dependency: {
      type: [String],
      default: [],
    },
    deadline: {
      type: Date,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    convertedTo: {
      type: String,
      enum: {
        values: ['Followup', 'Project'],
        message: '{VALUE} is not a valid conversion type',
      },
      default: null,
    },
    convertedReference: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model overwrite during development hot reloads
const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);

export default Task;
export { Task };
