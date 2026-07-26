import mongoose from 'mongoose';

const MessageSubSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: {
        values: ['user', 'assistant', 'system'],
        message: '{VALUE} is not a valid role',
      },
      required: [true, 'Message role is required'],
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
    },
    metadata: {
      model: { type: String, default: null },
      tokens: { type: Number, default: 0 },
      responseTime: { type: Number, default: 0 },
      isMock: { type: Boolean, default: false },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const ConversationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'New Conversation',
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    messages: {
      type: [MessageSubSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model overwrite during development hot reloads
const Conversation =
  mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);

export default Conversation;
export { Conversation };
