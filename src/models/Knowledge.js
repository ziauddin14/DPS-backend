import mongoose from 'mongoose';

const KnowledgeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters long'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    content: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: {
        values: ['Note', 'Book', 'Article', 'Idea', 'Learning', 'Reference'],
        message: '{VALUE} is not a valid knowledge type',
      },
    },
    category: {
      type: String,
      default: 'General',
    },
    tags: {
      type: [String],
      default: [],
    },
    source: {
      type: String,
      default: '',
    },
    favorite: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
      default: 'Blue',
    },
    icon: {
      type: String,
      default: 'FileText',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model overwrite during development hot reloads
const Knowledge =
  mongoose.models.Knowledge || mongoose.model('Knowledge', KnowledgeSchema);

export default Knowledge;
export { Knowledge };
