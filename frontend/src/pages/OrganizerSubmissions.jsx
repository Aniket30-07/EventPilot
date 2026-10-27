import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

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

export const OrganizerSubmissions = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [resultsPublished, setResultsPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [evaluatingId, setEvaluatingId] = useState(null);
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState({});
  const [busyAction, setBusyAction] = useState(false);

  const load = useCallback(async () => {
    try {
      const [evData, subsData] = await Promise.all([
        api(`/events/${eventId}`),
        api(`/events/${eventId}/submissions`),
      ]);
      setEvent(evData.event);
      setSubmissions(subsData.submissions || []);
      setResultsPublished(subsData.resultsPublished);

      // Prepopulate evaluation form state
      const initialScores = {};
      const initialComments = {};
      (subsData.submissions || []).forEach((s) => {
        initialScores[s._id] = s.score !== null ? s.score : '';
        initialComments[s._id] = s.feedback || '';
      });
      setScores(initialScores);
      setComments(initialComments);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveEvaluation = async (subId) => {
    setEvaluatingId(subId);
    setFeedback(null);
    try {
      const score = Number(scores[subId]);
      if (isNaN(score) || score < 0 || score > 100) {
        throw new Error('Please enter a valid score between 0 and 100.');
      }
      const res = await api(`/events/${eventId}/submissions/${subId}/evaluate`, {
        method: 'PATCH',
        body: { score, feedback: comments[subId] || '' },
      });
      setFeedback({ type: 'success', message: `Evaluation saved for "${res.submission.projectName}".` });
      await load();
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
    } finally {
      setEvaluatingId(null);
    }
  };

  const isHackathonLive = event && new Date() < new Date(event.endAt);

  const toggleResults = async () => {
    if (!resultsPublished && isHackathonLive) {
      const msg = '⚠️ The hackathon is currently LIVE! Official results cannot be published while participants are hacking. Please wait until the hackathon concludes.';
      setFeedback({ type: 'error', message: msg });
      window.alert(msg);
      return;
    }

    const actionStr = resultsPublished ? 'unpublish' : 'publish';
    if (!window.confirm(`Are you sure you want to ${actionStr} the results and leaderboard?`)) return;

    setBusyAction(true);
    setFeedback(null);
    try {
      const res = await api(`/events/${eventId}/publish-results`, { method: 'POST' });
      setResultsPublished(res.resultsPublished);
      setFeedback({ type: 'success', message: res.message });
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
    } finally {
      setBusyAction(false);
    }
  };

  if (loading) return <p className="state">Loading submissions…</p>;
  if (error || !event) {
    return (
      <div className="card center">
        <h2>Submissions unavailable</h2>
        <p className="muted">{error || 'Could not load submissions for this event.'}</p>
        <Link to="/organizer" className="btn">Back to your events</Link>
      </div>
    );
  }

  const evaluatedCount = submissions.filter((s) => s.score !== null).length;

  return (
    <div className="narrow-wide">
      <div className="row spread">
        <div>
          <Link to="/organizer" className="muted">← Organizer dashboard</Link>
          <h1 style={{ marginTop: '.4rem' }}>Hackathon Submissions & Evaluation</h1>
          <p className="muted">{event.title}</p>
        </div>
        <Link to={`/events/${eventId}`} className="btn ghost sm" target="_blank" rel="noopener noreferrer">
          View public page ↗
        </Link>
      </div>

      {isHackathonLive && (
        <div style={{ marginTop: '.75rem', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.35)', color: '#fbbf24', padding: '.85rem 1.1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '.65rem' }}>
          <span style={{ fontSize: '1.25rem' }}>⏳</span>
          <div style={{ fontSize: '.88rem' }}>
            <strong>The hackathon is currently LIVE!</strong> Participants are actively developing and submitting their projects. Official leaderboard results cannot be published while the hackathon is in progress.
          </div>
        </div>
      )}

      {feedback && <div className={`alert ${feedback.type}`}>{feedback.message}</div>}

      {/* Overview Stats & Publishing Banner */}
      <div className="feature-card">
        <div className="feature-header">
          <div>
            <h3>Submissions Overview</h3>
            <p className="feature-desc">
              Review participants’ code repos, deployed live apps, and assign scores. Once you finish evaluations, make the results out!
            </p>
          </div>
          <button
            className={`btn ${resultsPublished ? 'danger' : 'success'}`}
            onClick={toggleResults}
            disabled={busyAction || submissions.length === 0}
            title={!resultsPublished && isHackathonLive ? 'Cannot publish results while hackathon is live' : ''}
          >
            {busyAction ? 'Processing…' : resultsPublished ? '🔒 Unpublish Results' : '🚀 Make Results Out & Publish Leaderboard'}
          </button>
        </div>

        <div className="grid small" style={{ marginTop: '.5rem' }}>
          <div className="stat">
            <span className="label">Total Submissions</span>
            <div className="stat big">{submissions.length}</div>
          </div>
          <div className="stat">
            <span className="label">Evaluated</span>
            <div className="stat big">{evaluatedCount} / {submissions.length}</div>
          </div>
          <div className="stat">
            <span className="label">Results Status</span>
            <div style={{ marginTop: '.25rem' }}>
              <span className={`pill ${resultsPublished ? 'ok' : 'draft'}`}>
                {resultsPublished ? '🏆 Leaderboard Live' : 'Draft / Evaluating'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Submissions List */}
      {submissions.length === 0 ? (
        <div className="card center" style={{ padding: '3rem 1rem' }}>
          <h3>No submissions yet</h3>
          <p className="muted">Registered participants will appear here once they submit their project repository and demo links.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {submissions.map((sub, idx) => (
            <div key={sub._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="row spread">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: 'var(--accent)' }}>#{idx + 1}</span>
                    <h3 style={{ margin: 0 }}>{sub.projectName}</h3>
                    <span className="ticket-code-badge">{sub.ticketCode}</span>
                    <span className={`pill ${sub.score !== null ? 'ok' : 'draft'}`}>
                      {sub.score !== null ? `Score: ${sub.score}/100` : 'Pending Score'}
                    </span>
                  </div>
                  {sub.tagline && <p style={{ color: 'var(--muted)', fontSize: '.88rem', marginTop: '.25rem' }}>{sub.tagline}</p>}
                </div>
                <div style={{ textAlign: 'right', fontSize: '.82rem', color: 'var(--muted)' }}>
                  <div>By <strong>{sub.participantId?.name}</strong></div>
                  <div>{sub.participantId?.email}</div>
                </div>
              </div>

              {sub.description && (
                <p style={{ fontSize: '.88rem', background: 'rgba(0,0,0,.2)', padding: '.75rem', borderRadius: '8px', margin: 0 }}>
                  {sub.description}
                </p>
              )}

              {/* Links Group */}
              <div className="links-group">
                <a href={formatUrlHref(sub.githubUrl)} target="_blank" rel="noopener noreferrer" className="link-pill github">
                  💻 GitHub Repository ↗
                </a>
                {isRealUrl(sub.deployedUrl) && (
                  <a href={formatUrlHref(sub.deployedUrl)} target="_blank" rel="noopener noreferrer" className="link-pill">
                    🌐 Live Demo Site ↗
                  </a>
                )}
                {isRealUrl(sub.demoVideoUrl) && (
                  <a href={formatUrlHref(sub.demoVideoUrl)} target="_blank" rel="noopener noreferrer" className="link-pill">
                    🎥 Video Demo ↗
                  </a>
                )}
              </div>

              {/* Scoring & Feedback Form */}
              <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '.9rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '.75rem', alignItems: 'end' }}>
                  <label style={{ margin: 0 }}>Score (0-100)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="e.g. 92"
                      value={scores[sub._id] ?? ''}
                      onChange={(e) => setScores({ ...scores, [sub._id]: e.target.value })}
                    />
                  </label>
                  <label style={{ margin: 0 }}>Feedback / Judge Notes
                    <input
                      type="text"
                      placeholder="Great architecture and clean UI..."
                      value={comments[sub._id] ?? ''}
                      onChange={(e) => setComments({ ...comments, [sub._id]: e.target.value })}
                    />
                  </label>
                  <button
                    className="btn sm"
                    disabled={evaluatingId === sub._id || scores[sub._id] === ''}
                    onClick={() => saveEvaluation(sub._id)}
                  >
                    {evaluatingId === sub._id ? 'Saving…' : 'Save Score'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
