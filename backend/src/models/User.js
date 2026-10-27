import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
        'Please enter a valid email address',
      ],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    authTokenVersion: { type: Number, default: 0 },
    role: {
      type: String,
      enum: {
        values: ['participant', 'organizer'],
        message: 'Role must be either participant or organizer',
      },
      default: 'participant',
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'suspended'],
        message: 'Status must be active or suspended',
      },
      default: 'active',
    },
    emailVerified: { type: Boolean, default: true },
    emailVerificationTokenHash: { type: String, default: null, select: false },
    emailVerificationExpiresAt: { type: Date, default: null, select: false },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
  },
  {
    timestamps: true,
  }
);

// Method to verify candidate password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static helper to hash passwords
userSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

// Strip sensitive data from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  for (const field of [
    'passwordHash', '__v', 'authTokenVersion',
    'emailVerificationTokenHash', 'emailVerificationExpiresAt',
    'passwordResetTokenHash', 'passwordResetExpiresAt',
  ]) {
    delete obj[field];
  }
  return obj;
};

const User = mongoose.model('User', userSchema);

export default User;
