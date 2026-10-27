import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    participantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
    ticketCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    registeredAt: { type: Date, default: Date.now },
    cancelledAt: { type: Date, default: null },
    checkedInAt: { type: Date, default: null },
    teamName: { type: String, default: '', trim: true },
    squadSize: { type: Number, default: 1 },
    playerNotes: { type: String, default: '', trim: true },
    isCaptain: { type: Boolean, default: false },
    captainRegistrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', default: null },
    roleInTeam: { type: String, enum: ['solo', 'captain', 'player'], default: 'solo' },
  },
  { timestamps: true }
);

// One registration record per participant per event (also serves eventId lookups).
registrationSchema.index({ eventId: 1, participantId: 1 }, { unique: true });

export default mongoose.model('Registration', registrationSchema);
