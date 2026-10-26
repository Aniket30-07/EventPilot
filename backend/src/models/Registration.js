import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true,
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Participant ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed',
      index: true,
    },
    ticketCode: {
      type: String,
      required: [true, 'Ticket code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index enforcing one registration record per participant per event
registrationSchema.index({ eventId: 1, participantId: 1 }, { unique: true });

const Registration = mongoose.model('Registration', registrationSchema);

export default Registration;
