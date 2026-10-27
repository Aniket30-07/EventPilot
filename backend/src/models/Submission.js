import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    captainRegistrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      default: null,
      index: true,
    },
    teamName: {
      type: String,
      trim: true,
      default: '',
    },
    ticketCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    projectName: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters'],
      maxlength: [120, 'Project name cannot exceed 120 characters'],
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: [200, 'Tagline cannot exceed 200 characters'],
      default: '',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
      default: '',
    },
    githubUrl: {
      type: String,
      required: [true, 'GitHub repository URL is required'],
      trim: true,
    },
    deployedUrl: {
      type: String,
      trim: true,
      default: '',
    },
    demoVideoUrl: {
      type: String,
      trim: true,
      default: '',
    },
    score: {
      type: Number,
      min: [0, 'Score cannot be less than 0'],
      max: [100, 'Score cannot exceed 100'],
      default: null,
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: [1000, 'Feedback cannot exceed 1000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['submitted', 'evaluated'],
      default: 'submitted',
    },
    evaluatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// One submission per team or participant per hackathon
submissionSchema.index({ eventId: 1, captainRegistrationId: 1 }, { unique: true, sparse: true });
submissionSchema.index({ eventId: 1, participantId: 1 });

const Submission = mongoose.model('Submission', submissionSchema);

export default Submission;
