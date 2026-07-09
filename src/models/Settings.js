import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      default: 'Administrator',
      trim: true,
    },
    designation: {
      type: String,
      default: 'Digital Personal Secretary User',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    company: {
      type: String,
      default: '',
      trim: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    language: {
      type: String,
      default: 'English',
    },
    theme: {
      type: String,
      enum: {
        values: ['Light', 'Dark', 'System'],
        message: '{VALUE} is not a valid theme option',
      },
      default: 'Light',
    },
    dateFormat: {
      type: String,
      default: 'YYYY-MM-DD',
    },
    timeFormat: {
      type: String,
      default: '12-hour',
    },
    workingHoursStart: {
      type: String,
      default: '09:00',
    },
    workingHoursEnd: {
      type: String,
      default: '17:00',
    },
    defaultPriority: {
      type: String,
      enum: {
        values: ['High', 'Medium', 'Low'],
        message: '{VALUE} is not a valid default priority option',
      },
      default: 'Medium',
    },
    dashboardGreeting: {
      type: Boolean,
      default: true,
    },
    dailyReminder: {
      type: Boolean,
      default: true,
    },
    emailNotifications: {
      type: Boolean,
      default: false,
    },
    desktopNotifications: {
      type: Boolean,
      default: true,
    },
    autoBackup: {
      type: Boolean,
      default: false,
    },
    about: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model overwrite during development hot reloads
const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

export default Settings;
export { Settings };
