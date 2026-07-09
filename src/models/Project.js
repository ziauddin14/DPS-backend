import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters long'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['Planning', 'In Progress', 'Completed', 'On Hold'],
        message: '{VALUE} is not a valid project status',
      },
      default: 'Planning',
    },
    priority: {
      type: String,
      enum: {
        values: ['High', 'Medium', 'Low'],
        message: '{VALUE} is not a valid priority',
      },
      default: 'Medium',
    },
    category: {
      type: String,
      default: 'General',
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
    deadline: {
      type: Date,
    },
    client: {
      type: String,
      default: '',
    },
    technologies: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      default: '',
    },
    color: {
      type: String,
      default: 'Blue',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model overwrite during development hot reloads
const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);

export default Project;
export { Project };
