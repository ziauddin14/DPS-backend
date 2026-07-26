import mongoose from 'mongoose';

const FollowUpSchema = new mongoose.Schema(
  {
    personName: {
      type: String,
      required: [true, 'Person name is required'],
      trim: true,
      minlength: [2, 'Person name must be at least 2 characters long'],
      maxlength: [100, 'Person name cannot exceed 100 characters'],
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, 'Company cannot exceed 100 characters'],
    },
    phoneNumber: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number cannot exceed 20 characters'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      minlength: [3, 'Subject must be at least 3 characters long'],
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    relatedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
    },
    relatedProject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
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
        values: ['Pending', 'Contacted', 'Waiting Reply', 'Completed', 'Cancelled'],
        message: '{VALUE} is not a valid status',
      },
      default: 'Pending',
    },
    nextFollowupDate: {
      type: Date,
      required: [true, 'Next follow-up date is required'],
    },
    lastContactDate: {
      type: Date,
    },
    department: {
      type: String,
      trim: true,
      maxlength: [50, 'Department cannot exceed 50 characters'],
    },
    notes: [
      {
        message: {
          type: String,
          required: true,
          trim: true,
          maxlength: [1000, 'Note message cannot exceed 1000 characters'],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        createdBy: {
          type: String,
          trim: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Prevent model overwrite during development hot reloads
const FollowUp = mongoose.models.FollowUp || mongoose.model('FollowUp', FollowUpSchema);

export default FollowUp;
export { FollowUp };
