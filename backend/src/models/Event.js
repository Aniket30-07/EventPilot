import mongoose from 'mongoose';

export const EVENT_CATEGORIES = [
  'hackathon',
  'conference',
  'workshop',
  'webinar',
  'sports',
  'festival',
];

export const CATEGORY_LABELS = {
  hackathon: 'Hackathons / Competitions',
  conference: 'Conferences / Seminars',
  workshop: 'Workshops / Bootcamps',
  webinar: 'Webinars / Online Events',
  sports: 'Sports / Tournaments',
  festival: 'Festivals / Cultural Events',
};

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: EVENT_CATEGORIES,
        message: `Category must be one of: ${EVENT_CATEGORIES.join(', ')}`,
      },
    },
    startAt: {
      type: Date,
      required: [true, 'Start date and time are required'],
    },
    endAt: {
      type: Date,
      required: [true, 'End date and time are required'],
      validate: {
        validator: function (value) {
          return this.startAt ? value > this.startAt : true;
        },
        message: 'End date/time must be strictly after the start date/time',
      },
    },
    mode: {
      type: String,
      required: [true, 'Event mode is required'],
      enum: {
        values: ['in-person', 'online'],
        message: 'Mode must be either in-person or online',
      },
      default: 'in-person',
    },
    venue: {
      type: String,
      trim: true,
      default: '',
    },
    onlineLink: {
      type: String,
      trim: true,
      default: '',
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Capacity must be a positive integer',
      },
    },
    registrationDeadline: {
      type: Date,
      required: [true, 'Registration deadline is required'],
      validate: {
        validator: function (value) {
          return this.startAt ? value <= this.startAt : true;
        },
        message: 'Registration deadline cannot be after the event start time',
      },
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Event must have an organizer'],
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled', 'completed'],
      default: 'draft',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for public discovery queries
eventSchema.index({ status: 1, category: 1, startAt: 1 });
eventSchema.index({ title: 'text', description: 'text' });

const Event = mongoose.model('Event', eventSchema);

export default Event;
