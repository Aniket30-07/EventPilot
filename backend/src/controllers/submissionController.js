import Submission from '../models/Submission.js';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';

const isOwner = (event, user) => Boolean(user && event.organizerId.equals(user._id));
const fail = (res, status, message) => res.status(status).json({ success: false, message });

const isNA = (str) => !str || ['n/a', 'na', 'none', '-', 'nil'].includes(str.trim().toLowerCase());

const normalizeUrlOrNA = (str) => {
  if (!str || !str.trim()) return '';
  const s = str.trim();
  if (isNA(s)) return 'N/A';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^localhost(:\d+)?/i.test(s)) return `http://${s}`;
  if (/^[\w-]+(\.[\w-]+)+/i.test(s)) return `https://${s}`;
  return s;
};

const validateUrl = (urlStr) => {
  if (!urlStr || urlStr === 'N/A') return true;
  try {
    const u = new URL(urlStr);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
};

// POST /api/events/:eventId/submissions (Participant submit or edit project)
export const submitProject = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event || event.status !== 'published') return fail(res, 404, 'Event not found or not published.');
    if (event.category !== 'hackathon') return fail(res, 400, 'Submissions are only allowed for hackathons.');

    const now = new Date();
    if (now < event.startAt) {
      return fail(res, 400, 'Submissions are locked. The hackathon has not started yet.');
    }

    // 15-minute grace period after event.endAt for final submissions and edits
    const SUBMISSION_GRACE_PERIOD_MS = 15 * 60 * 1000;
    const finalDeadline = new Date(event.endAt.getTime() + SUBMISSION_GRACE_PERIOD_MS);
    if (now > finalDeadline) {
      return fail(res, 400, 'Submissions and edits are closed. The hackathon and the 15-minute submission grace period have ended.');
    }

    const registration = await Registration.findOne({
      eventId: event._id,
      participantId: req.user._id,
      status: 'confirmed',
    });
    if (!registration) {
      return fail(res, 403, 'You must have a confirmed registration for this hackathon to submit a project.');
    }

    const captainRegId = registration.isCaptain ? registration._id : registration.captainRegistrationId;
    const isTeamHackathon = Boolean(registration.teamName && captainRegId);

    // Team qualification check:
    // If hackathon is configured as team-based, verify required members accepted before deadline
    if (isTeamHackathon && event.hackathonConfig?.teamMode === 'team') {
      const required = event.hackathonConfig?.requiredMembers || 4;
      const confirmedCount = await Registration.countDocuments({
        eventId: event._id,
        status: 'confirmed',
        $or: [{ _id: captainRegId }, { captainRegistrationId: captainRegId }],
      });

      if (now > new Date(event.registrationDeadline) && confirmedCount < required) {
        return fail(
          res,
          400,
          `Your team "${registration.teamName}" is disqualified (${confirmedCount}/${required} members confirmed). Teams must reach all ${required} required members before the registration deadline to compete.`
        );
      }
    }

    const { projectName, tagline, description, githubUrl, deployedUrl, demoVideoUrl } = req.body || {};

    if (!projectName || typeof projectName !== 'string' || projectName.trim().length < 2) {
      return fail(res, 400, 'Project name is required (minimum 2 characters).');
    }

    const cleanGithub = normalizeUrlOrNA(githubUrl);
    if (!cleanGithub || cleanGithub === 'N/A' || !validateUrl(cleanGithub)) {
      return fail(res, 400, 'A valid GitHub repository URL is required.');
    }

    const cleanDeployed = normalizeUrlOrNA(deployedUrl);
    if (!cleanDeployed || cleanDeployed === 'N/A' || !validateUrl(cleanDeployed)) {
      return fail(res, 400, 'A valid live deployed application URL is required (e.g. https://myapp.vercel.app).');
    }

    const cleanVideo = normalizeUrlOrNA(demoVideoUrl);
    if (cleanVideo && cleanVideo !== 'N/A' && !validateUrl(cleanVideo)) {
      return fail(res, 400, 'Please provide a valid URL for the demo video or enter N/A.');
    }

    const submissionData = {
      eventId: event._id,
      participantId: req.user._id,
      captainRegistrationId: captainRegId || null,
      teamName: registration.teamName || '',
      ticketCode: registration.ticketCode,
      projectName: projectName.trim(),
      tagline: (tagline || '').trim(),
      description: (description || '').trim(),
      githubUrl: cleanGithub,
      deployedUrl: cleanDeployed,
      demoVideoUrl: cleanVideo,
    };

    const filter = isTeamHackathon
      ? { eventId: event._id, captainRegistrationId: captainRegId }
      : { eventId: event._id, participantId: req.user._id };

    const submission = await Submission.findOneAndUpdate(
      filter,
      { $set: submissionData },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: isTeamHackathon ? `Project submitted successfully for team "${registration.teamName}"!` : 'Project submitted successfully!',
      submission,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/events/:eventId/submissions/mine (Participant gets team or own submission)
export const getMySubmission = async (req, res, next) => {
  try {
    const reg = await Registration.findOne({
      eventId: req.params.eventId,
      participantId: req.user._id,
      status: 'confirmed',
    });
    if (!reg) return res.status(200).json({ success: true, submission: null });

    const captainRegId = reg.isCaptain ? reg._id : reg.captainRegistrationId;
    let submission = null;
    if (captainRegId) {
      submission = await Submission.findOne({
        eventId: req.params.eventId,
        captainRegistrationId: captainRegId,
      });
    }
    if (!submission) {
      submission = await Submission.findOne({
        eventId: req.params.eventId,
        participantId: req.user._id,
      });
    }

    res.status(200).json({ success: true, submission });
  } catch (error) {
    next(error);
  }
};

// GET /api/events/:eventId/submissions (Organizer gets all submissions with team details)
export const getEventSubmissions = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return fail(res, 404, 'Event not found.');
    if (!isOwner(event, req.user)) return fail(res, 403, 'You do not own this event.');

    const submissions = await Submission.find({ eventId: event._id })
      .populate('participantId', 'name email')
      .sort({ score: -1, createdAt: 1 });

    const enriched = await Promise.all(
      submissions.map(async (s) => {
        let teamMembers = [];
        if (s.captainRegistrationId) {
          const members = await Registration.find({
            eventId: event._id,
            status: 'confirmed',
            $or: [{ _id: s.captainRegistrationId }, { captainRegistrationId: s.captainRegistrationId }],
          }).populate('participantId', 'name email');
          teamMembers = members.map((m) => ({
            name: m.participantId?.name,
            email: m.participantId?.email,
            isCaptain: m.isCaptain,
          }));
        }
        return {
          ...s.toObject(),
          teamMembers,
        };
      })
    );

    res.status(200).json({
      success: true,
      resultsPublished: Boolean(event.resultsPublished),
      submissions: enriched,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/events/:eventId/submissions/:submissionId/evaluate (Organizer evaluates)
export const evaluateSubmission = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return fail(res, 404, 'Event not found.');
    if (!isOwner(event, req.user)) return fail(res, 403, 'You do not own this event.');

    const { score, feedback } = req.body || {};
    const parsedScore = Number(score);

    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      return fail(res, 400, 'Score must be a number between 0 and 100.');
    }

    const submission = await Submission.findOneAndUpdate(
      { _id: req.params.submissionId, eventId: event._id },
      {
        $set: {
          score: Math.round(parsedScore * 10) / 10,
          feedback: (feedback || '').trim(),
          status: 'evaluated',
          evaluatedAt: new Date(),
        },
      },
      { new: true }
    ).populate('participantId', 'name email');

    if (!submission) return fail(res, 404, 'Submission not found.');

    res.status(200).json({
      success: true,
      message: 'Evaluation saved successfully!',
      submission,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/events/:eventId/publish-results (Organizer toggles results)
export const togglePublishResults = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return fail(res, 404, 'Event not found.');
    if (!isOwner(event, req.user)) return fail(res, 403, 'You do not own this event.');

    // If attempting to publish while hackathon is still live
    const now = new Date();
    if (!event.resultsPublished && now < new Date(event.endAt)) {
      return fail(
        res,
        400,
        'The hackathon is currently LIVE! Official results cannot be published while participants are hacking. Please wait until the hackathon concludes.'
      );
    }

    event.resultsPublished = !event.resultsPublished;
    await event.save();

    res.status(200).json({
      success: true,
      message: event.resultsPublished ? 'Results published! The leaderboard is now visible to participants.' : 'Results unpublished.',
      resultsPublished: event.resultsPublished,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/events/:eventId/leaderboard (Public / Participant leaderboard)
export const getLeaderboard = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return fail(res, 404, 'Event not found.');

    const owner = isOwner(event, req.user);
    if (!event.resultsPublished && !owner) {
      return res.status(200).json({
        success: true,
        resultsPublished: false,
        message: 'Evaluation is currently in progress. Results have not been released yet.',
        leaderboard: [],
      });
    }

    const submissions = await Submission.find({
      eventId: event._id,
      score: { $ne: null },
    })
      .populate('participantId', 'name')
      .sort({ score: -1, evaluatedAt: 1 });

    const enrichedLeaderboard = await Promise.all(
      submissions.map(async (s, index) => {
        let teamMembers = [];
        if (s.captainRegistrationId) {
          const members = await Registration.find({
            eventId: event._id,
            status: 'confirmed',
            $or: [{ _id: s.captainRegistrationId }, { captainRegistrationId: s.captainRegistrationId }],
          }).populate('participantId', 'name email');
          teamMembers = members.map((m) => ({
            name: m.participantId?.name,
            isCaptain: m.isCaptain,
          }));
        }
        return {
          rank: index + 1,
          submissionId: s._id,
          projectName: s.projectName,
          tagline: s.tagline,
          description: s.description,
          githubUrl: s.githubUrl,
          deployedUrl: s.deployedUrl,
          demoVideoUrl: s.demoVideoUrl,
          ticketCode: s.ticketCode,
          teamName: s.teamName,
          teamMembers,
          submitterName: s.participantId?.name || 'Anonymous',
          score: s.score,
          feedback: s.feedback,
        };
      })
    );

    res.status(200).json({
      success: true,
      resultsPublished: Boolean(event.resultsPublished),
      leaderboard: enrichedLeaderboard,
    });
  } catch (error) {
    next(error);
  }
};
