import mongoose from 'mongoose';

const teamInviteSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true },
    teamName: { type: String, required: true, trim: true },
    captainId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    captainName: { type: String, required: true },
    invitedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    invitedEmail: { type: String, required: true, lowercase: true, trim: true },
    invitedName: { type: String, default: '' },
    role: { type: String, default: 'player' },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', index: true },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One invite per user per event
teamInviteSchema.index({ eventId: 1, invitedUserId: 1 }, { unique: true });

export default mongoose.model('TeamInvite', teamInviteSchema);
