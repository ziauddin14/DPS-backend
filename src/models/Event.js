import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: {
        values: ['Meeting', 'Event', 'Birthday', 'Reminder'],
        message: '{VALUE} is not a valid event type',
      },
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
    },
    time: {
      type: String,
    },
    location: {
      type: String,
      default: '',
    },
    reminder: {
      type: Boolean,
      default: false,
    },
    reminderTime: {
      type: String,
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
const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);

export default Event;
export { Event };
