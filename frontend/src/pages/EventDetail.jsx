import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { categoryLabel, fmtDate } from '../lib/format';
import { EventCountdown } from '../components/EventCountdown';

const isRealUrl = (str) => {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim().toLowerCase();
  return s !== 'n/a' && s !== 'na' && s !== 'none' && s !== '-' && s !== 'nil' && s !== '';
};

const formatUrlHref = (str) => {
  if (!str) return '';
  const s = str.trim();
  if (/^https?:\/\//i.test(s)) return s;
  return `http://${s}`;
};

const calculateStandingsFromMatches = (matches, sportType) => {
  const table = {};
  const getEntry = (name) => {
    if (!table[name]) {
      table[name] = { teamName: name, played: 0, won: 0, drawn: 0, lost: 0, points: 0, extra: '+0' };
    }
    return table[name];
  };

  for (const m of (matches || [])) {
    if (m.status !== 'completed' || !m.teamA || !m.teamB) continue;
    const teamA = getEntry(m.teamA);
    const teamB = getEntry(m.teamB);
    teamA.played += 1;
    teamB.played += 1;

    const winner = (m.winner || '').trim();
    if (winner === m.teamA) {
      teamA.won += 1;
      teamB.lost += 1;
      teamA.points += (sportType === 'cricket' ? 2 : sportType === 'chess' ? 1 : 3);
    } else if (winner === m.teamB) {
      teamB.won += 1;
      teamA.lost += 1;
      teamB.points += (sportType === 'cricket' ? 2 : sportType === 'chess' ? 1 : 3);
    } else {
      teamA.drawn += 1;
      teamB.drawn += 1;
      teamA.points += (sportType === 'chess' ? 0.5 : 1);
      teamB.points += (sportType === 'chess' ? 0.5 : 1);
    }
  }

  return Object.values(table).sort((a, b) => b.points - a.points);
};

const FORMAT_NAMES = {
  knockout_4: '4-Team Knockout (2 Semis ➔ 1 Grand Final)',
  knockout_2: '2-Team Championship Match (1v1 Final)',
  knockout_8: '8-Team Knockout (4 QFs ➔ 2 Semis ➔ Final)',
  round_robin: 'Round-Robin League (Points Table)',
  custom: 'Custom Tournament Format',
};

const generateBracketFixtures = (format, existingTeams = []) => {
  const t = (idx, fallback) => (existingTeams[idx] || '').trim() || fallback;

  if (format === 'knockout_2') {
    return [
      { round: 'Grand Championship Final', teamA: t(0, 'Team 1'), teamB: t(1, 'Team 2'), scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Championship Match' },
    ];
  }

  if (format === 'knockout_8') {
    return [
      { round: 'Quarter-Final 1', teamA: t(0, 'Team 1'), teamB: t(1, 'Team 2'), scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Quarter-Final 1' },
      { round: 'Quarter-Final 2', teamA: t(2, 'Team 3'), teamB: t(3, 'Team 4'), scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Quarter-Final 2' },
      { round: 'Quarter-Final 3', teamA: t(4, 'Team 5'), teamB: t(5, 'Team 6'), scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Quarter-Final 3' },
      { round: 'Quarter-Final 4', teamA: t(6, 'Team 7'), teamB: t(7, 'Team 8'), scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Quarter-Final 4' },
      { round: 'Semi-Final 1', teamA: 'Winner QF1', teamB: 'Winner QF2', scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Semi-Final 1' },
      { round: 'Semi-Final 2', teamA: 'Winner QF3', teamB: 'Winner QF4', scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Semi-Final 2' },
      { round: 'Grand Championship Final', teamA: 'Winner SF1', teamB: 'Winner SF2', scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Grand Championship Final' },
    ];
  }

  // Default: knockout_4
  return [
    { round: 'Semi-Final 1', teamA: t(0, 'Team 1'), teamB: t(1, 'Team 2'), scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Semi-Final 1' },
    { round: 'Semi-Final 2', teamA: t(2, 'Team 3'), teamB: t(3, 'Team 4'), scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Semi-Final 2' },
    { round: 'Grand Championship Final', teamA: 'Winner SF1', teamB: 'Winner SF2', scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Grand Championship Final' },
  ];
};

const isValidUrlInput = (str) => {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  if (['n/a', 'na', 'none', '-', 'nil'].includes(s.toLowerCase())) return false;
  try {
    const urlToCheck = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(urlToCheck);
    return ['http:', 'https:'].includes(u.protocol) && (u.hostname.includes('.') || u.hostname === 'localhost');
  } catch {
    return false;
  }
};

export const EventDetail = () => {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [resultsPublished, setResultsPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Hackathon Participant Submission State
  const [editingSub, setEditingSub] = useState(false);
  const [subFieldErrors, setSubFieldErrors] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  const [subForm, setSubForm] = useState({
    projectName: '',
    tagline: '',
    githubUrl: '',
    deployedUrl: '',
    demoVideoUrl: '',
    description: '',
  });

  // Conference/Webinar Recap Modal State
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [recapForm, setRecapForm] = useState({
    summary: '',
    keyTakeawaysText: '',
    recordingUrl: '',
    slidesUrl: '',
  });

  // Sports Modal State
  const [showSportsModal, setShowSportsModal] = useState(false);
  const [matchesList, setMatchesList] = useState([]);
  const [standingsList, setStandingsList] = useState([]);
  const [sportTypeState, setSportTypeState] = useState('football');
  const [tournamentFormatState, setTournamentFormatState] = useState('knockout_4');
  const [maxTeamsState, setMaxTeamsState] = useState(4);
  const [sportsRegForm, setSportsRegForm] = useState({
    teamName: '',
    squadSize: 11,
    playerNotes: '',
  });

  // Sports Team Squad & Invite State
  const [squadData, setSquadData] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api(`/events/${eventId}`);
      setData(res);
      setError('');

      // Populate submission form if participant already submitted
      if (res.mySubmission) {
        setSubForm({
          projectName: res.mySubmission.projectName || '',
          tagline: res.mySubmission.tagline || '',
          githubUrl: res.mySubmission.githubUrl || '',
          deployedUrl: res.mySubmission.deployedUrl || '',
          demoVideoUrl: res.mySubmission.demoVideoUrl || '',
          description: res.mySubmission.description || '',
        });
      }

      // Populate recap modal form
      if (res.event?.recap) {
        setRecapForm({
          summary: res.event.recap.summary || '',
          keyTakeawaysText: (res.event.recap.keyTakeaways || []).join('\n'),
          recordingUrl: res.event.recap.recordingUrl || '',
          slidesUrl: res.event.recap.slidesUrl || '',
        });
      }

      // Populate sports modal state
      if (res.event?.sportsData) {
        setMatchesList(res.event.sportsData.matches || []);
        setStandingsList(res.event.sportsData.standings || []);
        if (res.event.sportsData.sportType) {
          setSportTypeState(res.event.sportsData.sportType);
        }
        if (res.event.sportsData.tournamentFormat) {
          setTournamentFormatState(res.event.sportsData.tournamentFormat);
        }
        setMaxTeamsState(res.event.sportsData.maxTeams || res.event.capacity || 4);
      }

      // If Sports event & participant is registered, fetch squad roster
      if (res.event?.category === 'sports' && res.myRegistration?.status === 'confirmed') {
        try {
          const sqRes = await api(`/events/${eventId}/squad`);
          setSquadData(sqRes);
        } catch {
          // ignore squad load error
        }
      } else {
        setSquadData(null);
      }

      // If Hackathon, fetch Leaderboard
      if (res.event?.category === 'hackathon') {
        try {
          const lbRes = await api(`/events/${eventId}/leaderboard`);
          setLeaderboard(lbRes.leaderboard || []);
          setResultsPublished(Boolean(lbRes.resultsPublished));
        } catch {
          // ignore leaderboard load error
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, user?._id]);

  const run = async (fn, successMsg) => {
    setBusy(true);
    setFeedback(null);
    try {
      await fn();
      setFeedback({ type: 'success', message: successMsg });
      await load();
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleProjectSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);
    const errors = {};

    if (!subForm.projectName || subForm.projectName.trim().length < 2) {
      errors.projectName = 'Project title is required (minimum 2 characters).';
    }

    if (!subForm.githubUrl || !isValidUrlInput(subForm.githubUrl)) {
      errors.githubUrl = 'Please provide a valid GitHub repository URL (e.g., https://github.com/username/project).';
    }

    if (!subForm.deployedUrl || !isValidUrlInput(subForm.deployedUrl)) {
      errors.deployedUrl = 'Live deployed URL is required (e.g., https://myapp.vercel.app or http://localhost:5173).';
    }

    if (subForm.demoVideoUrl && !['n/a', 'na', 'none', '-', 'nil', ''].includes(subForm.demoVideoUrl.trim().toLowerCase())) {
      if (!isValidUrlInput(subForm.demoVideoUrl)) {
        errors.demoVideoUrl = 'Please provide a valid demo video URL or enter N/A.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setSubFieldErrors(errors);
      return;
    }

    setSubFieldErrors({});
    setBusy(true);
    try {
      await api(`/events/${eventId}/submissions`, {
        method: 'POST',
        body: subForm,
      });
      setFeedback({ type: 'success', message: 'Project submitted successfully!' });
      setEditingSub(false);
      await load();
    } catch (err) {
      const msg = err.message || 'Submission failed';
      const nextErrors = {};
      if (/github/i.test(msg)) nextErrors.githubUrl = msg;
      else if (/deploy/i.test(msg)) nextErrors.deployedUrl = msg;
      else if (/project name|title/i.test(msg)) nextErrors.projectName = msg;
      else if (/video/i.test(msg)) nextErrors.demoVideoUrl = msg;
      if (Object.keys(nextErrors).length > 0) setSubFieldErrors(nextErrors);
      setFeedback({ type: 'error', message: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRecap = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const keyTakeaways = recapForm.keyTakeawaysText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      await api(`/events/${eventId}/recap`, {
        method: 'PATCH',
        body: {
          summary: recapForm.summary,
          keyTakeaways,
          recordingUrl: recapForm.recordingUrl,
          slidesUrl: recapForm.slidesUrl,
        },
      });
      setShowRecapModal(false);
      setFeedback({ type: 'success', message: 'Event recap updated!' });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSports = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await api(`/events/${eventId}/sports`, {
        method: 'PATCH',
        body: {
          sportType: sportTypeState,
          tournamentFormat: tournamentFormatState,
          maxTeams: Number(maxTeamsState),
          matches: matchesList,
          standings: standingsList,
        },
      });
      setShowSportsModal(false);
      setFeedback({ type: 'success', message: 'Match schedule & standings updated!' });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="state">Loading event…</p>;
  if (error || !data) {
    return (
      <div className="card center">
        <h2>Event unavailable</h2>
        <p className="muted">{error || 'This event could not be found.'}</p>
        <Link to="/events" className="btn">Back to events</Link>
      </div>
    );
  }

  const { event, isOwner, myRegistration, mySubmission } = data;
  const now = currentTime;
  const startAt = new Date(event.startAt);
  const endAt = new Date(event.endAt);
  const isUpcoming = now < startAt;
  const isLive = now >= startAt && now <= endAt;
  const isConcluded = now > endAt || event.status === 'completed';
  const deadlinePassed = now > new Date(event.registrationDeadline);
  const ended = isConcluded;
  const full = event.remainingSeats === 0;
  const isParticipant = user?.role === 'participant';

  // Hackathon 15-minute submission buffer & grace period
  const SUBMISSION_BUFFER_MS = 15 * 60 * 1000;
  const submissionDeadline = new Date(endAt.getTime() + SUBMISSION_BUFFER_MS);
  const isSubmissionClosed = now > submissionDeadline;
  const msRemainingToSubmit = submissionDeadline.getTime() - now.getTime();
  const minutesRemainingToSubmit = Math.max(0, Math.ceil(msRemainingToSubmit / (60 * 1000)));
  const showUrgentWarning = event.category === 'hackathon' && !isSubmissionClosed && now >= startAt && minutesRemainingToSubmit <= 15;

  const register = (customBody) => run(() => api(`/events/${eventId}/register`, {
    method: 'POST',
    body: customBody || {},
  }), 'You are registered! Your ticket is below.');

  const cancelReg = () => {
    if (!window.confirm('Cancel your registration? You will not be able to register again for this event.')) return;
    run(() => api(`/registrations/${myRegistration._id}/cancel`, { method: 'POST' }), 'Registration cancelled.');
  };
  const publish = () => run(() => api(`/events/${eventId}/publish`, { method: 'POST' }), 'Event published.');
  const cancelEvent = () => {
    if (!window.confirm('Cancel this event? It will be removed from public discovery.')) return;
    run(() => api(`/events/${eventId}/cancel`, { method: 'POST' }), 'Event cancelled.');
  };

  const handleInvitePlayer = async (emailToInvite) => {
    const targetEmail = (emailToInvite || inviteEmail).trim();
    if (!targetEmail) return;
    setInviting(true);
    setFeedback(null);
    try {
      const res = await api(`/events/${eventId}/invites`, {
        method: 'POST',
        body: { email: targetEmail },
      });
      setFeedback({ type: 'success', message: res.message || `Invitation sent to ${targetEmail}!` });
      setInviteEmail('');
      const sqRes = await api(`/events/${eventId}/squad`);
      setSquadData(sqRes);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setInviting(false);
    }
  };

  const handleInviteAllCricketSquad = async () => {
    setInviting(true);
    setFeedback(null);
    try {
      let sentCount = 0;
      for (let i = 1; i <= 11; i++) {
        try {
          await api(`/events/${eventId}/invites`, {
            method: 'POST',
            body: { email: `player${i}@gmail.com` },
          });
          sentCount++;
        } catch {
          // ignore duplicate
        }
      }
      setFeedback({ type: 'success', message: `Invitations sent to cricket squad players (player1@ .. player11@)!` });
      const sqRes = await api(`/events/${eventId}/squad`);
      setSquadData(sqRes);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setInviting(false);
    }
  };

  const isHackathon = event.category === 'hackathon';
  const isConferenceOrWebinar = ['conference', 'webinar', 'workshop'].includes(event.category);
  const isSports = event.category === 'sports';
  const currentSportType = event.sportsData?.sportType || 'football';

  let registerBox;
  if (event.status !== 'published') {
    registerBox = <p className="muted">This event is {event.status} and not open for registration.</p>;
  } else if (!user) {
    registerBox = (
      <button className="btn" onClick={() => navigate('/login', { state: { from: `/events/${eventId}` } })}>
        Sign in to register
      </button>
    );
  } else if (user?.role === 'organizer') {
    registerBox = (
      <div style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.3)', borderRadius: '10px', padding: '1rem .9rem', textAlign: 'center' }}>
        <span style={{ fontSize: '1.4rem', display: 'block', marginBottom: '.3rem' }}>🛡️</span>
        <strong style={{ display: 'block', fontSize: '.92rem', color: '#c7d2fe', marginBottom: '.3rem' }}>
          Organizer Admin View
        </strong>
        <p className="muted" style={{ fontSize: '.8rem', margin: '0 0 .75rem', lineHeight: '1.4' }}>
          You are signed in as an Event Organizer. Organizers cannot register or participate in events.
        </p>
        {isOwner ? (
          <Link to={`/organizer/events/${eventId}/edit`} className="btn sm">
            Manage Event Settings ⚙️
          </Link>
        ) : (
          <Link to="/organizer" className="btn sm ghost">
            Organizer Portal ↗
          </Link>
        )}
      </div>
    );
  } else if (!isParticipant) {
    registerBox = null;
  } else if (myRegistration?.status === 'confirmed') {
    registerBox = (
      <div className="ticket">
        <div>
          <span className="pill ok">Registered</span>
          <div className="ticket-code">{myRegistration.ticketCode}</div>
          {myRegistration.teamName && (
            <div style={{ fontSize: '.88rem', marginTop: '.25rem' }}>
              <strong>Registered As:</strong> {myRegistration.teamName} {myRegistration.squadSize > 1 ? `(${myRegistration.squadSize} squad members)` : ''}
            </div>
          )}
          {myRegistration.checkedInAt && <span className="muted">Checked in {fmtDate(myRegistration.checkedInAt)}</span>}
        </div>
        {!myRegistration.checkedInAt && !ended && (
          <button className="btn danger sm" onClick={cancelReg} disabled={busy}>
            {busy ? 'Cancelling…' : 'Cancel registration'}
          </button>
        )}
      </div>
    );
  } else if (myRegistration?.status === 'cancelled') {
    registerBox = <p className="muted">You cancelled your registration. Re-registering is not allowed.</p>;
  } else if (ended) {
    registerBox = <p className="muted">This event has ended.</p>;
  } else if (deadlinePassed) {
    registerBox = <p className="muted">Registration closed on {fmtDate(event.registrationDeadline)}.</p>;
  } else if (full) {
    registerBox = (
      <p className="danger-text">
        {isSports
          ? `Tournament Full: All ${event.capacity} ${currentSportType === 'chess' ? 'competitor' : 'team'} slots have been filled.`
          : 'This event is full.'}
      </p>
    );
  } else if (isSports) {
    const isCricket = currentSportType === 'cricket';
    const isChess = currentSportType === 'chess';

    registerBox = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          register(sportsRegForm);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '1.05rem' }}>
            {isCricket ? '🏏 Register Cricket Squad / Team'
              : isChess ? '♟️ Register 1v1 Chess Competitor'
              : '⚽ Register Football Team / Club'}
          </strong>
          <span className="pill">
            {isCricket ? '11 Playing XI + Squad of 15' : isChess ? '1v1 Individual Tournament' : '11v11 Squad'}
          </span>
          <span className="pill ok" style={{ fontSize: '.78rem' }}>
            {event.remainingSeats} of {event.capacity} {isChess ? 'player' : 'team'} slots remaining
          </span>
        </div>

        {isChess ? (
          <div className="two-col">
            <label>Player Name *
              <input
                required
                placeholder="Full Player Name"
                value={sportsRegForm.teamName || user?.name || ''}
                onChange={(e) => setSportsRegForm({ ...sportsRegForm, teamName: e.target.value })}
              />
            </label>
            <label>Rating / Ranking (Optional)
              <input
                placeholder="e.g. FIDE 1800, Lichess, or Unrated"
                value={sportsRegForm.playerNotes}
                onChange={(e) => setSportsRegForm({ ...sportsRegForm, playerNotes: e.target.value })}
              />
            </label>
          </div>
        ) : (
          <div className="two-col">
            <label>{isCricket ? 'Cricket Team / Club Name *' : 'Club / Team Name *'}
              <input
                required
                placeholder={isCricket ? 'e.g. Royal Strikers CC' : 'e.g. Thunderbolts FC'}
                value={sportsRegForm.teamName}
                onChange={(e) => setSportsRegForm({ ...sportsRegForm, teamName: e.target.value })}
              />
            </label>
            <label>{isCricket ? 'Squad Size (XI + Reserves)' : 'Squad Size (11–18 Players)'}
              <input
                type="number"
                min={11}
                max={25}
                value={sportsRegForm.squadSize || (isCricket ? 15 : 11)}
                onChange={(e) => setSportsRegForm({ ...sportsRegForm, squadSize: Number(e.target.value) })}
              />
            </label>
          </div>
        )}

        <button className="btn" disabled={busy} style={{ alignSelf: 'flex-start', marginTop: '.25rem' }}>
          {busy ? 'Registering…' : 'Confirm Registration & Get Ticket 🎟️'}
        </button>
      </form>
    );
  } else {
    registerBox = <button className="btn" onClick={() => register()} disabled={busy}>{busy ? 'Registering…' : 'Register for this event'}</button>;
  }

  return (
    <div className="narrow-wide">
      <Link to="/events" className="muted">← All events</Link>
      
      {/* Main Event Card */}
      <div className="card">
        <div className="row spread">
          <span className="pill">{categoryLabel(event.category)}</span>
          {event.status !== 'published' && <span className={`pill ${event.status}`}>{event.status}</span>}
        </div>
        <h1>{event.title}</h1>
        <p className="preline">{event.description}</p>

        {/* Live Countdown Clock */}
        <EventCountdown startAt={event.startAt} endAt={event.endAt} />

        <div className="grid small" style={{ marginTop: '1rem' }}>
          <div className="stat"><span className="label">Starts</span>{fmtDate(event.startAt)}</div>
          <div className="stat"><span className="label">Ends</span>{fmtDate(event.endAt)}</div>
          <div className="stat">
            <span className="label">Location</span>
            {event.mode === 'online' ? '🌐 Virtual Event (Online)' : (event.venue || 'TBA')}
          </div>
          <div className="stat">
            <span className="label">
              {isSports ? (currentSportType === 'chess' ? 'Competitors' : 'Teams') : 'Capacity'}
            </span>
            {isSports ? (
              <span>
                <strong>{event.confirmedCount}</strong> / {event.capacity} {currentSportType === 'chess' ? 'players' : 'teams'}
                <span style={{ display: 'block', fontSize: '.75rem', color: event.remainingSeats === 0 ? 'var(--danger)' : 'var(--ok)' }}>
                  {event.remainingSeats === 0 ? '● Tournament Full' : `${event.remainingSeats} slots remaining`}
                </span>
              </span>
            ) : (
              `${event.confirmedCount} / ${event.capacity} taken`
            )}
          </div>
          <div className="stat"><span className="label">Register by</span>{fmtDate(event.registrationDeadline)}</div>
          <div className="stat"><span className="label">Organizer</span>{event.organizerId?.name}</div>
        </div>
      </div>

      {feedback && <div className={`alert ${feedback.type}`}>{feedback.message}</div>}

      {/* Participant Registration Card */}
      {!isOwner && registerBox && <div className="card">{registerBox}</div>}

      {/* ==================== TEAM SQUAD & ROSTER (SPORTS) ==================== */}
      {squadData?.isMember && (
        <div className="feature-card" style={{ marginTop: '1.25rem' }}>
          <div className="feature-header">
            <div>
              <h3>🏏 {squadData.teamName} Squad Roster</h3>
              <p className="feature-desc">
                Official Playing XI team members and squad invitations for this tournament.
              </p>
            </div>
            <span className="pill ok" style={{ fontSize: '.85rem', fontWeight: 700 }}>
              {squadData.confirmedPlayers?.length || 1} / 11 Confirmed Squad
            </span>
          </div>

          {/* Squad Members Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '.65rem', marginBottom: '1.25rem' }}>
            {/* Captain Card */}
            <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.35)', borderRadius: '8px', padding: '.75rem .9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ color: '#fff' }}>{squadData.captain?.name}</strong>
                <span className="pill" style={{ background: '#f59e0b', color: '#000', fontWeight: 800 }}>CAPTAIN 👑</span>
              </div>
              <span style={{ fontSize: '.8rem', color: 'var(--muted)', display: 'block', marginTop: '.2rem' }}>
                {squadData.captain?.email}
              </span>
              <span className="ticket-code-badge" style={{ marginTop: '.35rem', display: 'inline-block' }}>
                {squadData.captain?.ticketCode}
              </span>
            </div>

            {/* Confirmed Squad Players */}
            {(squadData.confirmedPlayers || [])
              .filter((p) => !p.isCaptain)
              .map((p, idx) => (
                <div key={idx} style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.3)', borderRadius: '8px', padding: '.75rem .9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong style={{ color: '#fff' }}>{p.name}</strong>
                    <span className="pill ok" style={{ fontSize: '.72rem' }}>Player ✓</span>
                  </div>
                  <span style={{ fontSize: '.8rem', color: 'var(--muted)', display: 'block', marginTop: '.2rem' }}>
                    {p.email}
                  </span>
                  <span className="ticket-code-badge" style={{ marginTop: '.35rem', display: 'inline-block' }}>
                    {p.ticketCode}
                  </span>
                </div>
              ))}

            {/* Pending Invites */}
            {(squadData.invites || [])
              .filter((inv) => inv.status === 'pending')
              .map((inv, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,.03)', border: '1px dashed rgba(255,255,255,.2)', borderRadius: '8px', padding: '.75rem .9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{inv.name || inv.email}</span>
                    <span className="pill" style={{ fontSize: '.72rem', background: 'rgba(245,158,11,.15)', color: '#f59e0b' }}>⏳ Pending</span>
                  </div>
                  <span style={{ fontSize: '.8rem', color: 'var(--muted)', display: 'block', marginTop: '.2rem' }}>
                    Request sent to player's dashboard
                  </span>
                </div>
              ))}
          </div>

          {/* Captain Invite Box */}
          {squadData.isCaptain && (
            <div style={{ background: 'rgba(0,0,0,.25)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem' }}>
              <h4 style={{ margin: '0 0 .5rem', fontSize: '.95rem' }}>Send Squad Invitation to Players</h4>
              <p className="muted" style={{ fontSize: '.82rem', marginBottom: '.75rem' }}>
                Enter a registered participant's email. A notification will appear on their dashboard with <strong>[Accept]</strong> and <strong>[Decline]</strong> buttons to join your team.
              </p>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.65rem' }}>
                <input
                  style={{ flex: 1, minWidth: '220px' }}
                  type="email"
                  placeholder="e.g. player1@gmail.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={inviting || !inviteEmail.trim()}
                  onClick={() => handleInvitePlayer()}
                >
                  {inviting ? 'Sending…' : '＋ Send Request'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={inviting}
                  title="Automatically send requests to player1@gmail.com through player11@gmail.com"
                  onClick={handleInviteAllCricketSquad}
                >
                  ⚡ Invite 11 Squad Players (player1@ .. player11@)
                </button>
              </div>

              {/* Quick Suggestion Chips */}
              {squadData.suggestedUsers?.length > 0 && (
                <div style={{ marginTop: '.65rem' }}>
                  <span style={{ fontSize: '.78rem', color: 'var(--muted)', display: 'block', marginBottom: '.35rem' }}>
                    Quick Add Existing Players:
                  </span>
                  <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
                    {squadData.suggestedUsers.slice(0, 11).map((su) => (
                      <button
                        key={su._id}
                        type="button"
                        className="pill"
                        style={{ cursor: 'pointer', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}
                        onClick={() => handleInvitePlayer(su.email)}
                        disabled={inviting}
                      >
                        ＋ {su.name} ({su.email})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== HACKATHON SECTION ==================== */}
      {isHackathon && (
        <>
          {/* 1. Official Leaderboard */}
          <div className="feature-card">
            <div className="feature-header">
              <div>
                <h3>🏆 Hackathon Leaderboard</h3>
                <p className="feature-desc">
                  {resultsPublished
                    ? 'Official rankings and project evaluations released by the organizers.'
                    : isUpcoming
                    ? `Hackathon starts on ${fmtDate(event.startAt)}. Project submissions and the leaderboard will unlock at kickoff.`
                    : isLive
                    ? 'Hackathon is live! Teams are building and submitting their projects.'
                    : 'Hacking has concluded. Organizer evaluation is currently underway; results will be posted soon!'}
                </p>
              </div>
              {resultsPublished && (
                <span className="pill ok">Official Results Published</span>
              )}
            </div>

            {resultsPublished && leaderboard.length > 0 ? (
              <div className="leaderboard-table-wrap">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>Rank</th>
                      <th>Project & Submitter</th>
                      <th>Links</th>
                      <th style={{ textAlign: 'right' }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((item) => (
                      <tr key={item.submissionId}>
                        <td>
                          <span className={`rank-badge ${item.rank <= 3 ? `rank-${item.rank}` : 'rank-other'}`}>
                            {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                          </span>
                        </td>
                        <td>
                          <div className="project-title">{item.projectName}</div>
                          {item.tagline && <div className="project-tagline">{item.tagline}</div>}
                          <div className="project-meta">
                            <span>By <strong>{item.submitterName}</strong></span>
                            <span className="ticket-code-badge">{item.ticketCode}</span>
                          </div>
                          {item.feedback && (
                            <div style={{ marginTop: '.35rem', fontSize: '.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                              “{item.feedback}”
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="links-group">
                            <a href={formatUrlHref(item.githubUrl)} target="_blank" rel="noopener noreferrer" className="link-pill github">
                              GitHub ↗
                            </a>
                            {isRealUrl(item.deployedUrl) && (
                              <a href={formatUrlHref(item.deployedUrl)} target="_blank" rel="noopener noreferrer" className="link-pill">
                                Live App ↗
                              </a>
                            )}
                            {isRealUrl(item.demoVideoUrl) && (
                              <a href={formatUrlHref(item.demoVideoUrl)} target="_blank" rel="noopener noreferrer" className="link-pill">
                                Video ↗
                              </a>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="score-badge">{item.score} / 100</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : resultsPublished && leaderboard.length === 0 ? (
              <p className="muted" style={{ padding: '1rem', textAlign: 'center' }}>No scored projects on the leaderboard yet.</p>
            ) : isUpcoming ? (
              <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,.02)', borderRadius: '10px', textAlign: 'center' }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '.35rem' }}>🚀</span>
                <p className="muted" style={{ margin: 0 }}>
                  The hackathon officially starts on <strong>{fmtDate(event.startAt)}</strong>. Project submissions and the live leaderboard will unlock at kickoff!
                </p>
              </div>
            ) : (
              <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,.02)', borderRadius: '10px', textAlign: 'center' }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '.35rem' }}>⏳</span>
                <p className="muted" style={{ margin: 0 }}>
                  {isLive ? 'Hackathon is in progress! Submit your project below before the deadline.' : 'Submissions closed. Organizer evaluations in progress — check back soon for final standings!'}
                </p>
              </div>
            )}
          </div>

          {/* 2. Participant Project Submission Form / Status */}
          {isParticipant && myRegistration?.status === 'confirmed' && (
            <div className="feature-card">
              <div className="feature-header">
                <div>
                  <h3>💻 Your Project Submission</h3>
                  <p className="feature-desc">
                    Submit your GitHub repo, deployed demo link, and project details for hackathon evaluation.
                  </p>
                </div>
                {mySubmission && !editingSub && !isSubmissionClosed && (
                  <button className="btn ghost sm" onClick={() => setEditingSub(true)}>
                    Edit Submission ✎
                  </button>
                )}
                {mySubmission && isSubmissionClosed && (
                  <span className="pill" style={{ background: 'rgba(239,68,68,.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,.3)' }}>
                    🔒 Edits Locked
                  </span>
                )}
              </div>

              {showUrgentWarning && (
                <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,.15), rgba(239,68,68,.15))', border: '1px solid rgba(245,158,11,.45)', borderRadius: '10px', padding: '.85rem 1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                  <div>
                    <strong style={{ color: '#fbbf24', fontSize: '.95rem', display: 'block' }}>
                      Urgent: Only {minutesRemainingToSubmit} minute{minutesRemainingToSubmit === 1 ? '' : 's'} remaining to submit or edit!
                    </strong>
                    <span style={{ color: 'var(--muted)', fontSize: '.83rem' }}>
                      The hackathon deadline has passed and the 15-minute submission grace period is active. Submissions and edits will be permanently locked once this timer reaches zero.
                    </span>
                  </div>
                </div>
              )}

              {isUpcoming && !mySubmission ? (
                <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,.02)', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '.35rem' }}>🔒</span>
                  <h4 style={{ margin: '0 0 .35rem' }}>Project Submissions Unlock at Kickoff</h4>
                  <p className="muted" style={{ margin: 0, fontSize: '.9rem' }}>
                    You are registered! The project submission portal will open when the hackathon officially starts ({fmtDate(event.startAt)}).
                  </p>
                </div>
              ) : isSubmissionClosed && !mySubmission ? (
                <div style={{ padding: '1.5rem', background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.2)', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '.35rem' }}>🔒</span>
                  <h4 style={{ margin: '0 0 .35rem', color: '#f87171' }}>Project Submissions are Closed</h4>
                  <p className="muted" style={{ margin: 0, fontSize: '.9rem' }}>
                    The hackathon deadline and the 15-minute submission grace period have concluded. New project submissions and edits are no longer accepted.
                  </p>
                </div>
              ) : mySubmission && !editingSub ? (
                <div className="submitted-card">
                  <div className="submitted-header">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '1.15rem' }}>{mySubmission.projectName}</h4>
                        <span className="ticket-code-badge">{mySubmission.ticketCode}</span>
                        <span className={`pill ${mySubmission.score !== null ? 'ok' : 'draft'}`}>
                          {mySubmission.score !== null ? 'Evaluated' : 'Submitted'}
                        </span>
                      </div>
                      {mySubmission.tagline && <p style={{ color: 'var(--muted)', fontSize: '.88rem', marginTop: '.25rem' }}>{mySubmission.tagline}</p>}
                    </div>

                    {resultsPublished && mySubmission.score !== null && (
                      <span className="score-badge">{mySubmission.score} / 100</span>
                    )}
                  </div>

                  {mySubmission.description && (
                    <p style={{ fontSize: '.88rem', margin: 0, color: 'var(--text)' }}>
                      {mySubmission.description}
                    </p>
                  )}

                  <div className="links-group">
                    <a href={formatUrlHref(mySubmission.githubUrl)} target="_blank" rel="noopener noreferrer" className="link-pill github">
                      GitHub Repository ↗
                    </a>
                    {isRealUrl(mySubmission.deployedUrl) && (
                      <a href={formatUrlHref(mySubmission.deployedUrl)} target="_blank" rel="noopener noreferrer" className="link-pill">
                        Live Deployed App ↗
                      </a>
                    )}
                    {isRealUrl(mySubmission.demoVideoUrl) && (
                      <a href={formatUrlHref(mySubmission.demoVideoUrl)} target="_blank" rel="noopener noreferrer" className="link-pill">
                        Video Walkthrough ↗
                      </a>
                    )}
                  </div>

                  {resultsPublished && mySubmission.feedback && (
                    <div className="evaluation-feedback-box">
                      <strong>Judge Feedback:</strong> {mySubmission.feedback}
                    </div>
                  )}
                </div>
              ) : (
                <form className="form" onSubmit={handleProjectSubmit}>
                  <div className="row spread" style={{ background: 'rgba(255,255,255,.03)', padding: '.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Submitting as: <strong>{user?.name}</strong></span>
                    <span className="ticket-code-badge">Ticket: {myRegistration.ticketCode}</span>
                  </div>

                  <label>Project Title *
                    <input
                      required
                      placeholder="e.g. EventPilot AI"
                      value={subForm.projectName}
                      style={subFieldErrors.projectName ? { borderColor: '#ef4444', boxShadow: '0 0 0 1px #ef4444' } : {}}
                      onChange={(e) => {
                        setSubForm({ ...subForm, projectName: e.target.value });
                        if (subFieldErrors.projectName) setSubFieldErrors({ ...subFieldErrors, projectName: null });
                      }}
                    />
                    {subFieldErrors.projectName && (
                      <span style={{ color: '#ef4444', fontSize: '.8rem', marginTop: '.25rem', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                        ⚠️ {subFieldErrors.projectName}
                      </span>
                    )}
                  </label>

                  <label>Short Tagline
                    <input
                      placeholder="e.g. Next-generation event discovery and ticketing platform"
                      value={subForm.tagline}
                      onChange={(e) => setSubForm({ ...subForm, tagline: e.target.value })}
                    />
                  </label>

                  <div className="two-col">
                    <label>GitHub Repository URL *
                      <input
                        type="text"
                        required
                        placeholder="https://github.com/username/project"
                        value={subForm.githubUrl}
                        style={subFieldErrors.githubUrl ? { borderColor: '#ef4444', boxShadow: '0 0 0 1px #ef4444' } : {}}
                        onChange={(e) => {
                          setSubForm({ ...subForm, githubUrl: e.target.value });
                          if (subFieldErrors.githubUrl) setSubFieldErrors({ ...subFieldErrors, githubUrl: null });
                        }}
                      />
                      {subFieldErrors.githubUrl && (
                        <span style={{ color: '#ef4444', fontSize: '.8rem', marginTop: '.25rem', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                          ⚠️ {subFieldErrors.githubUrl}
                        </span>
                      )}
                    </label>

                    <label>Live Deployed URL *
                      <input
                        type="text"
                        required
                        placeholder="e.g. https://myapp.vercel.app or http://localhost:5173"
                        value={subForm.deployedUrl}
                        style={subFieldErrors.deployedUrl ? { borderColor: '#ef4444', boxShadow: '0 0 0 1px #ef4444' } : {}}
                        onChange={(e) => {
                          setSubForm({ ...subForm, deployedUrl: e.target.value });
                          if (subFieldErrors.deployedUrl) setSubFieldErrors({ ...subFieldErrors, deployedUrl: null });
                        }}
                      />
                      {subFieldErrors.deployedUrl && (
                        <span style={{ color: '#ef4444', fontSize: '.8rem', marginTop: '.25rem', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                          ⚠️ {subFieldErrors.deployedUrl}
                        </span>
                      )}
                    </label>
                  </div>

                  <label>Demo Video URL (optional)
                    <input
                      type="text"
                      placeholder="e.g. https://youtube.com/watch?v=... or enter N/A"
                      value={subForm.demoVideoUrl}
                      style={subFieldErrors.demoVideoUrl ? { borderColor: '#ef4444', boxShadow: '0 0 0 1px #ef4444' } : {}}
                      onChange={(e) => {
                        setSubForm({ ...subForm, demoVideoUrl: e.target.value });
                        if (subFieldErrors.demoVideoUrl) setSubFieldErrors({ ...subFieldErrors, demoVideoUrl: null });
                      }}
                    />
                    {subFieldErrors.demoVideoUrl ? (
                      <span style={{ color: '#ef4444', fontSize: '.8rem', marginTop: '.25rem', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                        ⚠️ {subFieldErrors.demoVideoUrl}
                      </span>
                    ) : (
                      <span style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: '.2rem' }}>
                        Optional: if you do not have a video link, enter <code>N/A</code> or leave blank.
                      </span>
                    )}
                  </label>

                  <label>Project Description
                    <textarea
                      rows={3}
                      placeholder="Explain what your project does, tech stack used, and how it works..."
                      value={subForm.description}
                      onChange={(e) => setSubForm({ ...subForm, description: e.target.value })}
                    />
                  </label>

                  <div className="row">
                    <button className="btn" disabled={busy}>
                      {busy ? 'Saving…' : mySubmission ? 'Update Submission 🚀' : 'Submit Project 🚀'}
                    </button>
                    {mySubmission && (
                      <button className="btn ghost" type="button" onClick={() => setEditingSub(false)}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}
        </>
      )}

      {/* ==================== CONFERENCE & WEBINAR RECAP ==================== */}
      {isConferenceOrWebinar && (
        <div className="recap-container">
          <div className="feature-header">
            <div>
              <h3>🎓 Event Summary & Key Takeaways</h3>
              <p className="feature-desc">
                {isConcluded
                  ? 'Official recap, key takeaways, and session recordings provided by the organizer.'
                  : isLive
                  ? 'Session is live! The executive summary and recording links will be posted after conclusion.'
                  : `Session scheduled for ${fmtDate(event.startAt)}. Executive summary and recording links will be published once the session ends.`}
              </p>
            </div>
            {isOwner && (
              <button className="btn sm ghost" onClick={() => setShowRecapModal(true)}>
                {isConcluded ? '✎ Edit Recap & Resources' : '✎ Pre-load Slides / Draft Recap'}
              </button>
            )}
          </div>

          {/* If the event is concluded, show recap if filled, else prompt */}
          {isConcluded ? (
            event.recap?.summary || (event.recap?.keyTakeaways && event.recap.keyTakeaways.length > 0) || event.recap?.recordingUrl || event.recap?.slidesUrl ? (
              <>
                {event.recap?.summary && (
                  <p className="preline" style={{ fontSize: '.92rem', color: 'var(--text)' }}>
                    {event.recap.summary}
                  </p>
                )}

                {event.recap?.keyTakeaways && event.recap.keyTakeaways.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '.95rem', margin: '0 0 .4rem' }}>Key Takeaways & Insights</h4>
                    <ul className="takeaways-list">
                      {event.recap.keyTakeaways.map((point, idx) => (
                        <li key={idx}>
                          <span className="takeaway-icon">✓</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="recap-buttons">
                  {event.recap?.recordingUrl && (
                    <a href={event.recap.recordingUrl} target="_blank" rel="noopener noreferrer" className="btn sm">
                      📺 Watch Session Recording ↗
                    </a>
                  )}
                  {event.recap?.slidesUrl && (
                    <a href={event.recap.slidesUrl} target="_blank" rel="noopener noreferrer" className="btn ghost sm">
                      📑 Presentation Slide Deck ↗
                    </a>
                  )}
                </div>
              </>
            ) : isOwner ? (
              <div style={{ padding: '1.25rem', background: 'rgba(52, 152, 219, 0.08)', border: '1px dashed rgba(52, 152, 219, 0.3)', borderRadius: '10px', textAlign: 'center' }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '.35rem' }}>📝</span>
                <p style={{ margin: '0 0 .35rem', fontWeight: 600 }}>This session has concluded!</p>
                <p className="muted" style={{ margin: '0 0 .75rem', fontSize: '.88rem' }}>
                  Attendees are waiting for the recap. Please provide the executive summary, key takeaways, and session recording.
                </p>
                <button className="btn sm" onClick={() => setShowRecapModal(true)}>
                  Publish Event Summary & Recording 🚀
                </button>
              </div>
            ) : (
              <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,.02)', borderRadius: '10px', textAlign: 'center' }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '.35rem' }}>⏳</span>
                <p className="muted" style={{ margin: 0 }}>
                  This session has concluded. The organizer is finalizing the key takeaways and recording link. Please check back shortly!
                </p>
              </div>
            )
          ) : (
            /* Upcoming or Live: Do not show false pre-event summary */
            <div>
              {event.recap?.slidesUrl && (
                <div style={{ marginBottom: '.75rem' }}>
                  <a href={event.recap.slidesUrl} target="_blank" rel="noopener noreferrer" className="btn ghost sm">
                    📑 Preparation / Presentation Slide Deck ↗
                  </a>
                </div>
              )}
              {isOwner ? (
                <div style={{ padding: '1rem', background: 'rgba(255,160,0,.08)', border: '1px solid rgba(255,160,0,.2)', borderRadius: '8px' }}>
                  <p style={{ margin: 0, fontSize: '.88rem', color: '#f39c12' }}>
                    📢 <strong>Organizer Notice:</strong> This session has not completed yet. You can draft key takeaways and slides ahead of time. The official recap will become public once the event concludes ({fmtDate(event.endAt)}).
                  </p>
                </div>
              ) : (
                <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,.02)', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '.35rem' }}>🎙️</span>
                  <p className="muted" style={{ margin: 0 }}>
                    {isLive
                      ? 'The webinar is happening right now! Summary notes and recording will be posted here as soon as the session wraps up.'
                      : `The session starts on ${fmtDate(event.startAt)}. Executive summary, key takeaways, and recordings will be made available right after the session ends.`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== SPORTS FIXTURES & STANDINGS ==================== */}
      {isSports && (() => {
        const currentTournamentFormat = event.sportsData?.tournamentFormat || 'knockout_4';
        const finalMatch = (event.sportsData?.matches || []).find((m) =>
          m.round?.toLowerCase().includes('final') && !m.round?.toLowerCase().includes('semi') && !m.round?.toLowerCase().includes('quarter')
        );
        const championTeam = finalMatch && finalMatch.status === 'completed' && finalMatch.winner ? finalMatch.winner : null;

        return (
          <div className="feature-card">
            <div className="feature-header">
              <div>
                <h3>
                  {currentSportType === 'cricket' ? '🏏 Cricket Tournament Fixtures & Points Table' :
                   currentSportType === 'chess' ? '♟️ Chess Championship Fixtures & Standings' :
                   currentSportType === 'football' ? '⚽ Football Championship Fixtures & Standings' :
                   '🏆 Tournament Fixtures & Live Scores'}
                </h3>
                <p className="feature-desc">
                  {isUpcoming
                    ? `Tournament starts on ${fmtDate(event.startAt)}. Match fixtures and schedules are listed below.`
                    : 'Real-time match results, scores, and tournament standings table.'}
                </p>
              </div>
              {isOwner && (
                <button className="btn sm ghost" onClick={() => setShowSportsModal(true)}>
                  ✎ Update Matches & Standings
                </button>
              )}
            </div>

            {/* Tournament Format & Capacity Pill */}
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', margin: '.6rem 0 1rem' }}>
              <span className="pill" style={{ background: 'rgba(99,102,241,.15)', color: '#818cf8', fontWeight: 600 }}>
                {FORMAT_NAMES[currentTournamentFormat] || 'Knockout Tournament'}
              </span>
              <span className="pill" style={{ background: 'rgba(16,185,129,.15)', color: '#10b981', fontWeight: 600 }}>
                Slots: {event.confirmedCount} / {event.capacity} {currentSportType === 'chess' ? 'competitors' : 'teams'} registered
              </span>
              {event.remainingSeats > 0 ? (
                <span className="pill" style={{ background: 'rgba(255,255,255,.06)' }}>
                  {event.remainingSeats} slots remaining
                </span>
              ) : (
                <span className="pill danger">
                  Tournament Full
                </span>
              )}
            </div>

            {/* Champion Banner */}
            {championTeam && (
              <div style={{ background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.18), rgba(255, 107, 74, 0.12))', border: '1px solid rgba(255, 215, 0, 0.5)', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', boxShadow: '0 4px 20px rgba(255, 215, 0, 0.15)' }}>
                <div>
                  <span style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.08em', color: '#f1c40f', fontWeight: 800 }}>🏆 TOURNAMENT CHAMPION</span>
                  <h2 style={{ margin: '.2rem 0 0', color: '#fff', fontSize: '1.45rem' }}>{championTeam} 🥇</h2>
                </div>
                <span className="pill ok" style={{ fontSize: '.85rem', fontWeight: 700 }}>Winner Crowned</span>
              </div>
            )}

            {/* Matches List */}
            {event.sportsData?.matches && event.sportsData.matches.length > 0 ? (
              <div>
                <h4 style={{ fontSize: '.95rem', marginBottom: '.65rem' }}>Match Schedule & Bracket Fixtures</h4>
                <div className="sports-matches-grid">
                  {event.sportsData.matches.map((m, idx) => (
                    <div key={idx} className="match-card">
                      <div className="match-header">
                        <span>{m.round} {m.matchDate ? `• ${m.matchDate}` : ''}</span>
                        <span className={`pill ${m.status === 'live' ? 'danger' : m.status === 'completed' ? 'ok' : ''}`}>
                          {m.status === 'live' ? '🔴 LIVE' : m.status === 'completed' ? 'Completed' : 'Scheduled'}
                        </span>
                      </div>

                      {m.status === 'scheduled' ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.45rem 0', fontWeight: 600 }}>
                          <span style={{ fontSize: '.95rem' }}>{m.teamA}</span>
                          <span className="pill" style={{ fontSize: '.75rem', padding: '.15rem .5rem', background: 'rgba(255,255,255,.08)' }}>VS</span>
                          <span style={{ fontSize: '.95rem' }}>{m.teamB}</span>
                        </div>
                      ) : (
                        <div className="match-teams">
                          <div className={`team-row ${m.winner === m.teamA ? 'winner' : ''}`}>
                            <span>{m.teamA} {m.winner === m.teamA && '👑'}</span>
                            <span className="match-score">{m.scoreA}</span>
                          </div>
                          <div className={`team-row ${m.winner === m.teamB ? 'winner' : ''}`}>
                            <span>{m.teamB} {m.winner === m.teamB && '👑'}</span>
                            <span className="match-score">{m.scoreB}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted">No matches scheduled yet.</p>
            )}

            {/* Standings Table */}
            {event.sportsData?.standings && event.sportsData.standings.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ fontSize: '.95rem', marginBottom: '.65rem' }}>
                  {currentSportType === 'cricket' ? 'Points Table' : 'Tournament Standings'}
                </h4>
                <div className="leaderboard-table-wrap">
                  <table className="leaderboard-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>Pos</th>
                        <th>{currentSportType === 'chess' ? 'Player / Competitor' : currentSportType === 'cricket' ? 'Team / Squad' : 'Team / Club'}</th>
                        <th style={{ textAlign: 'center' }}>P</th>
                        <th style={{ textAlign: 'center' }}>W</th>
                        {(currentSportType === 'football' || currentSportType === 'chess') && (
                          <th style={{ textAlign: 'center' }}>D</th>
                        )}
                        <th style={{ textAlign: 'center' }}>L</th>
                        <th style={{ textAlign: 'right' }}>PTS</th>
                        {currentSportType === 'cricket' && (
                          <th style={{ textAlign: 'right' }}>NRR</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {event.sportsData.standings.map((s, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700 }}>#{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{s.teamName}</td>
                          <td style={{ textAlign: 'center' }}>{s.played}</td>
                          <td style={{ textAlign: 'center', color: 'var(--ok)' }}>{s.won}</td>
                          {(currentSportType === 'football' || currentSportType === 'chess') && (
                            <td style={{ textAlign: 'center', color: 'var(--muted)' }}>{s.drawn || 0}</td>
                          )}
                          <td style={{ textAlign: 'center', color: 'var(--danger)' }}>{s.lost}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>{s.points}</td>
                          {currentSportType === 'cricket' && (
                            <td style={{ textAlign: 'right', fontSize: '.85rem', color: 'var(--muted)' }}>{s.extra || '+0.00'}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {isUpcoming && (
                  <p className="muted" style={{ fontSize: '.82rem', marginTop: '.5rem', textAlign: 'center' }}>
                    ⏳ Standings will update dynamically once the tournament begins and matches are completed.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ==================== ORGANIZER MANAGEMENT ACTIONS ==================== */}
      {isOwner && (
        <div className="card">
          <h3>Manage this event</h3>
          <div className="row">
            <Link className="btn" to={`/organizer/events/${event._id}/attendees`}>Attendees & check-in</Link>
            {isHackathon && (
              <Link className="btn ghost" to={`/organizer/events/${event._id}/submissions`}>
                🚀 Submissions & Evaluation
              </Link>
            )}
            {event.status !== 'cancelled' && <Link className="btn ghost" to={`/organizer/events/${event._id}/edit`}>Edit</Link>}
            {event.status === 'draft' && <button className="btn success" onClick={publish} disabled={busy}>Publish</button>}
            {event.status !== 'cancelled' && <button className="btn danger" onClick={cancelEvent} disabled={busy}>Cancel event</button>}
          </div>
        </div>
      )}

      {/* ==================== MODAL: CONFERENCE & WEBINAR RECAP ==================== */}
      {showRecapModal && (
        <div className="modal-overlay" onClick={() => setShowRecapModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="row spread">
              <h2>Edit Event Recap & Resources</h2>
              <button className="btn ghost sm" onClick={() => setShowRecapModal(false)}>✕</button>
            </div>
            <form className="form" onSubmit={handleSaveRecap}>
              <label>Executive Summary
                <textarea
                  rows={4}
                  placeholder="Summary of what was discussed, keynote highlights, or main themes..."
                  value={recapForm.summary}
                  onChange={(e) => setRecapForm({ ...recapForm, summary: e.target.value })}
                />
              </label>

              <label>Key Takeaways (one insight per line)
                <textarea
                  rows={4}
                  placeholder="AI is shifting to multi-agent architectures&#10;Latency optimization is key for production apps&#10;Security must be built in from day zero"
                  value={recapForm.keyTakeawaysText}
                  onChange={(e) => setRecapForm({ ...recapForm, keyTakeawaysText: e.target.value })}
                />
              </label>

              <label>Recording Video URL (YouTube, Vimeo, Zoom recording)
                <input
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={recapForm.recordingUrl}
                  onChange={(e) => setRecapForm({ ...recapForm, recordingUrl: e.target.value })}
                />
              </label>

              <label>Slide Deck URL (Google Slides, PDF, Canva)
                <input
                  type="url"
                  placeholder="https://docs.google.com/presentation/d/..."
                  value={recapForm.slidesUrl}
                  onChange={(e) => setRecapForm({ ...recapForm, slidesUrl: e.target.value })}
                />
              </label>

              <div className="row spread" style={{ marginTop: '.5rem' }}>
                <button className="btn ghost" type="button" onClick={() => setShowRecapModal(false)}>
                  Cancel
                </button>
                <button className="btn" disabled={busy}>
                  {busy ? 'Saving…' : 'Save & Publish Recap'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: SPORTS FIXTURES & STANDINGS ==================== */}
      {showSportsModal && (
        <div className="modal-overlay" onClick={() => setShowSportsModal(false)}>
          <div className="modal-box" style={{ maxWidth: '780px' }} onClick={(e) => e.stopPropagation()}>
            <div className="row spread">
              <h2>Manage Sports Fixtures & Standings</h2>
              <button className="btn ghost sm" onClick={() => setShowSportsModal(false)}>✕</button>
            </div>
            <form className="form" onSubmit={handleSaveSports}>
              {/* Sport Type & Bracket Format Selection */}
              <div style={{ background: 'rgba(255,255,255,.03)', padding: '.85rem 1rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
                <div className="two-col">
                  <label style={{ margin: 0, fontWeight: 600 }}>Sport Discipline
                    <select
                      style={{ marginTop: '.35rem' }}
                      value={sportTypeState}
                      onChange={(e) => setSportTypeState(e.target.value)}
                    >
                      <option value="football">⚽ Football (11v11, 3 pts Win, 1 pt Draw)</option>
                      <option value="cricket">🏏 Cricket (11 XI / 15 Squad, 2 pts Win)</option>
                      <option value="chess">♟️ Chess (1v1 Match, 1 pt Win, 0.5 pt Draw)</option>
                      <option value="general">🏆 General Sport (Tournament)</option>
                    </select>
                  </label>
                  <label style={{ margin: 0, fontWeight: 600 }}>Tournament Bracket Format
                    <select
                      style={{ marginTop: '.35rem' }}
                      value={tournamentFormatState}
                      onChange={(e) => {
                        const fmt = e.target.value;
                        setTournamentFormatState(fmt);
                        if (fmt === 'knockout_2') setMaxTeamsState(2);
                        else if (fmt === 'knockout_8') setMaxTeamsState(8);
                        else if (fmt === 'knockout_4') setMaxTeamsState(4);
                      }}
                    >
                      <option value="knockout_4">🏆 4-Team Knockout (2 Semis ➔ 1 Grand Final)</option>
                      <option value="knockout_2">🏆 2-Team Championship Match (1v1 Final)</option>
                      <option value="knockout_8">🏆 8-Team Knockout (4 QFs ➔ 2 Semis ➔ Final)</option>
                      <option value="round_robin">🏆 Round-Robin League (Points Table)</option>
                      <option value="custom">🏆 Custom Format</option>
                    </select>
                  </label>
                </div>

                <div className="two-col">
                  <label style={{ margin: 0, fontWeight: 600 }}>Max {sportTypeState === 'chess' ? 'Competitors' : 'Teams'} (Capacity)
                    <input
                      type="number"
                      min={2}
                      max={128}
                      style={{ marginTop: '.35rem' }}
                      value={maxTeamsState}
                      onChange={(e) => setMaxTeamsState(Number(e.target.value))}
                    />
                  </label>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn ghost sm"
                      style={{ width: '100%', height: '38px', borderColor: 'var(--accent)' }}
                      title="Generate official knockout matches based on tournament teams"
                      onClick={() => {
                        const teams = standingsList.map((s) => s.teamName).filter(Boolean);
                        const generated = generateBracketFixtures(tournamentFormatState, teams);
                        if (generated.length > 0) {
                          setMatchesList(generated);
                        } else {
                          alert('Selected format does not require automatic knockout bracket generation.');
                        }
                      }}
                    >
                      ⚡ Auto-Generate Bracket Fixtures
                    </button>
                  </div>
                </div>
              </div>

              {/* Matches editor */}
              <div>
                <div className="row spread" style={{ marginBottom: '.5rem', marginTop: '.5rem' }}>
                  <h4>Match Fixtures & Scores</h4>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() =>
                      setMatchesList([
                        ...matchesList,
                        { round: `Match ${matchesList.length + 1}`, teamA: '', teamB: '', scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: '' },
                      ])
                    }
                  >
                    ＋ Add Match Fixture
                  </button>
                </div>

                {matchesList.map((m, idx) => (
                  <div key={idx} style={{ background: 'rgba(0,0,0,.25)', border: '1px solid var(--border)', padding: '.75rem', borderRadius: '8px', marginBottom: '.6rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr auto', gap: '.5rem', alignItems: 'center' }}>
                      <input
                        placeholder="Stage (e.g. Semi-Final 1)"
                        value={m.round}
                        onChange={(e) => {
                          const updated = [...matchesList];
                          updated[idx].round = e.target.value;
                          setMatchesList(updated);
                        }}
                      />
                      <select
                        value={m.status}
                        onChange={(e) => {
                          const updated = [...matchesList];
                          updated[idx].status = e.target.value;
                          setMatchesList(updated);
                        }}
                      >
                        <option value="scheduled">Scheduled (Pre-match)</option>
                        <option value="live">🔴 Live (In Progress)</option>
                        <option value="completed">Completed (Final)</option>
                      </select>
                      <input
                        placeholder="Winner (team/player)"
                        value={m.winner}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = [...matchesList];
                          updated[idx].winner = val;

                          // Automatic Winner Progression to Grand Final
                          if (updated[idx].round === 'Semi-Final 1') {
                            const finalM = updated.find((match) => match.round === 'Grand Championship Final');
                            if (finalM) finalM.teamA = val || 'Winner SF1';
                          } else if (updated[idx].round === 'Semi-Final 2') {
                            const finalM = updated.find((match) => match.round === 'Grand Championship Final');
                            if (finalM) finalM.teamB = val || 'Winner SF2';
                          }
                          setMatchesList(updated);
                        }}
                      />
                      <button
                        type="button"
                        className="btn danger sm"
                        onClick={() => setMatchesList(matchesList.filter((_, i) => i !== idx))}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 20px 1fr 1.4fr', gap: '.4rem', alignItems: 'center', marginTop: '.5rem' }}>
                      <input
                        placeholder={sportTypeState === 'chess' ? 'Player A' : 'Team A'}
                        value={m.teamA}
                        onChange={(e) => {
                          const updated = [...matchesList];
                          updated[idx].teamA = e.target.value;
                          setMatchesList(updated);
                        }}
                      />
                      <input
                        type="text"
                        placeholder={sportTypeState === 'cricket' ? '185/4 (20.0)' : sportTypeState === 'chess' ? '1' : '0'}
                        value={m.scoreA}
                        onChange={(e) => {
                          const updated = [...matchesList];
                          updated[idx].scoreA = e.target.value;
                          setMatchesList(updated);
                        }}
                      />
                      <span style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '.8rem' }}>vs</span>
                      <input
                        type="text"
                        placeholder={sportTypeState === 'cricket' ? '182/9 (20.0)' : sportTypeState === 'chess' ? '0' : '0'}
                        value={m.scoreB}
                        onChange={(e) => {
                          const updated = [...matchesList];
                          updated[idx].scoreB = e.target.value;
                          setMatchesList(updated);
                        }}
                      />
                      <input
                        placeholder={sportTypeState === 'chess' ? 'Player B' : 'Team B'}
                        value={m.teamB}
                        onChange={(e) => {
                          const updated = [...matchesList];
                          updated[idx].teamB = e.target.value;
                          setMatchesList(updated);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Standings editor */}
              <div style={{ marginTop: '1.25rem' }}>
                <div className="row spread" style={{ marginBottom: '.5rem', flexWrap: 'wrap', gap: '.5rem' }}>
                  <div>
                    <h4 style={{ margin: 0 }}>Tournament Standings / Points Table</h4>
                    <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>
                      Rules: {sportTypeState === 'cricket' ? '2 pts Win, NRR tracked' : sportTypeState === 'chess' ? '1 pt Win, 0.5 pt Draw' : '3 pts Win, 1 pt Draw'}
                    </span>
                  </div>
                  <div className="row" style={{ gap: '.4rem' }}>
                    <button
                      type="button"
                      className="btn ghost sm"
                      title="Calculate points and standings automatically from completed matches above"
                      onClick={() => {
                        const calculated = calculateStandingsFromMatches(matchesList, sportTypeState);
                        if (calculated.length === 0) {
                          alert('No completed matches with a designated winner found to calculate from. Mark matches as "Completed" and set Winner first!');
                          return;
                        }
                        setStandingsList(calculated);
                      }}
                    >
                      ⚡ Auto-Calculate from Matches
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() =>
                        setStandingsList([
                          ...standingsList,
                          { teamName: '', played: 0, won: 0, drawn: 0, lost: 0, points: 0, extra: '+0.00' },
                        ])
                      }
                    >
                      ＋ Add Team
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 48px 48px 48px 48px 54px 65px auto', gap: '.4rem', alignItems: 'center', marginBottom: '.3rem', fontSize: '.72rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  <span>Team / Player</span>
                  <span style={{ textAlign: 'center' }}>P</span>
                  <span style={{ textAlign: 'center' }}>W</span>
                  <span style={{ textAlign: 'center' }}>D</span>
                  <span style={{ textAlign: 'center' }}>L</span>
                  <span style={{ textAlign: 'center' }}>PTS</span>
                  <span style={{ textAlign: 'center' }}>{sportTypeState === 'cricket' ? 'NRR' : 'Extra'}</span>
                  <span></span>
                </div>

                {standingsList.map((s, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.4fr 48px 48px 48px 48px 54px 65px auto', gap: '.4rem', alignItems: 'center', marginBottom: '.4rem' }}>
                    <input
                      placeholder="Team Name"
                      value={s.teamName}
                      onChange={(e) => {
                        const updated = [...standingsList];
                        updated[idx].teamName = e.target.value;
                        setStandingsList(updated);
                      }}
                    />
                    <input
                      type="number"
                      title="Played"
                      value={s.played}
                      onChange={(e) => {
                        const updated = [...standingsList];
                        updated[idx].played = Number(e.target.value);
                        setStandingsList(updated);
                      }}
                    />
                    <input
                      type="number"
                      title="Won"
                      value={s.won}
                      onChange={(e) => {
                        const updated = [...standingsList];
                        updated[idx].won = Number(e.target.value);
                        setStandingsList(updated);
                      }}
                    />
                    <input
                      type="number"
                      title="Drawn"
                      value={s.drawn || 0}
                      onChange={(e) => {
                        const updated = [...standingsList];
                        updated[idx].drawn = Number(e.target.value);
                        setStandingsList(updated);
                      }}
                    />
                    <input
                      type="number"
                      title="Lost"
                      value={s.lost}
                      onChange={(e) => {
                        const updated = [...standingsList];
                        updated[idx].lost = Number(e.target.value);
                        setStandingsList(updated);
                      }}
                    />
                    <input
                      type="number"
                      step={sportTypeState === 'chess' ? '0.5' : '1'}
                      title="Points"
                      value={s.points}
                      onChange={(e) => {
                        const updated = [...standingsList];
                        updated[idx].points = Number(e.target.value);
                        setStandingsList(updated);
                      }}
                    />
                    <input
                      placeholder={sportTypeState === 'cricket' ? 'NRR' : '-'}
                      value={s.extra || ''}
                      onChange={(e) => {
                        const updated = [...standingsList];
                        updated[idx].extra = e.target.value;
                        setStandingsList(updated);
                      }}
                    />
                    <button
                      type="button"
                      className="btn danger sm"
                      onClick={() => setStandingsList(standingsList.filter((_, i) => i !== idx))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="row spread" style={{ marginTop: '1.25rem' }}>
                <button className="btn ghost" type="button" onClick={() => setShowSportsModal(false)}>
                  Cancel
                </button>
                <button className="btn" disabled={busy}>
                  {busy ? 'Saving…' : 'Save Sports Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
