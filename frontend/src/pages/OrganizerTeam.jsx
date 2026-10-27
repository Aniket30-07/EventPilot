import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';

export const OrganizerTeam = () => {
  const [organizers, setOrganizers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isPrimaryOrganizer, setIsPrimaryOrganizer] = useState(false);
  const [leadEmail, setLeadEmail] = useState('organiser1@gmail.com');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [busyActionId, setBusyActionId] = useState(null);
  const [addBusy, setAddBusy] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  const loadTeam = useCallback(async () => {
    try {
      const res = await api('/team');
      setOrganizers(res.organizers || []);
      setCurrentUserId(res.currentUserId);
      setIsPrimaryOrganizer(Boolean(res.isPrimaryOrganizer));
      if (res.leadOrganizerEmail) setLeadEmail(res.leadOrganizerEmail);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleCreateOrganizer = async (e) => {
    e.preventDefault();
    setAddBusy(true);
    setFeedback(null);
    try {
      const res = await api('/team', {
        method: 'POST',
        body: form,
      });
      setFeedback({ type: 'success', message: res.message || 'Organizer added successfully!' });
      setForm({ name: '', email: '', password: '' });
      setShowAddModal(false);
      await loadTeam();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAddBusy(false);
    }
  };

  const handleToggleStatus = async (org) => {
    const actionName = org.status === 'suspended' ? 'resume access for' : 'pause access for';
    if (!window.confirm(`Are you sure you want to ${actionName} ${org.name} (${org.email})?`)) {
      return;
    }

    setBusyActionId(org._id);
    setFeedback(null);
    try {
      const res = await api(`/team/${org._id}/status`, { method: 'PATCH' });
      setFeedback({ type: 'success', message: res.message });
      await loadTeam();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDeleteOrganizer = async (org) => {
    if (!window.confirm(`Are you sure you want to terminate and remove organizer access for ${org.name} (${org.email})? This action cannot be undone.`)) {
      return;
    }

    setBusyActionId(org._id);
    setFeedback(null);
    try {
      const res = await api(`/team/${org._id}`, { method: 'DELETE' });
      setFeedback({ type: 'success', message: res.message });
      await loadTeam();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBusyActionId(null);
    }
  };

  if (loading) return <p className="state">Loading organizer team…</p>;

  const activeCount = organizers.filter((o) => o.status !== 'suspended').length;
  const suspendedCount = organizers.filter((o) => o.status === 'suspended').length;

  return (
    <div className="narrow-wide">
      <div className="row spread">
        <div>
          <Link to="/organizer" className="muted" style={{ fontSize: '.85rem', display: 'inline-block', marginBottom: '.35rem' }}>← Back to Events</Link>
          <h1 style={{ margin: 0 }}>👥 Organizer Team Management</h1>
          <p className="muted" style={{ marginTop: '.25rem', fontSize: '.9rem' }}>
            Provision team members with organizer rights, manage roles, and toggle access permissions.
          </p>
        </div>
        {isPrimaryOrganizer ? (
          <button className="btn" onClick={() => setShowAddModal(true)}>
            ＋ Add Co-Organizer
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <span className="pill" style={{ background: 'rgba(255,255,255,.08)' }}>
              🔒 Managed by Lead: {leadEmail}
            </span>
          </div>
        )}
      </div>

      {!isPrimaryOrganizer && (
        <div className="alert info" style={{ marginTop: '.85rem' }}>
          🛡️ <strong>Read-Only Access:</strong> Only the primary lead organizer (<code>{leadEmail}</code>) is authorized to invite new co-organizers, pause active credentials, or terminate organizer accounts.
        </div>
      )}

      {feedback && <div className={`alert ${feedback.type}`}>{feedback.message}</div>}
      {error && <div className="alert error">{error}</div>}

      {/* Team Summary Cards */}
      <div className="grid small" style={{ marginTop: '.5rem' }}>
        <div className="stat">
          <span className="label">Total Organizers</span>
          <strong style={{ fontSize: '1.4rem' }}>{organizers.length}</strong>
        </div>
        <div className="stat">
          <span className="label">Active Access</span>
          <strong style={{ fontSize: '1.4rem', color: 'var(--ok)' }}>{activeCount}</strong>
        </div>
        <div className="stat">
          <span className="label">Paused / Suspended</span>
          <strong style={{ fontSize: '1.4rem', color: suspendedCount > 0 ? 'var(--danger)' : 'var(--muted)' }}>
            {suspendedCount}
          </strong>
        </div>
      </div>

      {/* Organizers Table */}
      <div className="card" style={{ marginTop: '.5rem', padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table style={{ margin: 0, border: 'none', borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Organizer</th>
                <th>Email</th>
                <th>Status</th>
                <th>Added Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {organizers.map((org) => {
                const isMe = String(org._id) === String(currentUserId);
                const isSuspended = org.status === 'suspended';

                return (
                  <tr key={org._id} style={{ opacity: isSuspended ? 0.65 : 1 }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem' }}>
                        <span className="nav-avatar" style={{ width: '32px', height: '32px', fontSize: '.85rem' }}>
                          {org.name?.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <strong>{org.name}</strong>
                          {org.isLead && (
                            <span className="pill" style={{ marginLeft: '.5rem', fontSize: '.68rem', background: 'rgba(245,158,11,.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)' }}>
                              Lead Organizer 👑
                            </span>
                          )}
                          {!org.isLead && isMe && (
                            <span className="pill" style={{ marginLeft: '.5rem', fontSize: '.65rem', background: 'rgba(255,255,255,.1)' }}>
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: '.85rem', color: 'var(--text)' }}>{org.email}</code>
                    </td>
                    <td>
                      <span className={`status-pill ${isSuspended ? 'suspended' : 'active'}`}>
                        {isSuspended ? '● Suspended' : '● Active'}
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: '.82rem' }}>
                      {fmtDate(org.createdAt)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!isPrimaryOrganizer ? (
                        <span className="muted" style={{ fontSize: '.8rem' }}>View only</span>
                      ) : isMe ? (
                        <span className="muted" style={{ fontSize: '.8rem', fontStyle: 'italic' }}>Primary Account</span>
                      ) : (
                        <div style={{ display: 'inline-flex', gap: '.4rem', justifyContent: 'flex-end' }}>
                          <button
                            className={`btn sm ${isSuspended ? 'success' : 'ghost'}`}
                            disabled={busyActionId === org._id}
                            onClick={() => handleToggleStatus(org)}
                            title={isSuspended ? 'Resume access' : 'Pause dashboard access'}
                          >
                            {isSuspended ? '▶ Resume' : '⏸ Pause'}
                          </button>
                          <button
                            className="btn sm danger"
                            disabled={busyActionId === org._id}
                            onClick={() => handleDeleteOrganizer(org)}
                            title="Revoke and delete account"
                          >
                            ✕ Terminate
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Organizer Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="row spread">
              <h2 style={{ margin: 0 }}>➕ Add New Organizer</h2>
              <button className="btn ghost sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <p className="muted" style={{ fontSize: '.88rem', margin: 0 }}>
              Create an organizer account. They will be able to log in immediately with these credentials and manage all events and evaluations.
            </p>

            <form className="form" onSubmit={handleCreateOrganizer} style={{ marginTop: '.5rem' }}>
              <label>Full Name *
                <input
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>

              <label>Organizer Email Address *
                <input
                  type="email"
                  required
                  placeholder="e.g. sarah.organiser@gmail.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>

              <label>Initial Password * (minimum 6 characters)
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>

              <div style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.25)', borderRadius: '8px', padding: '.75rem', fontSize: '.83rem', color: '#c7d2fe' }}>
                💡 <strong>Admin Tip:</strong> Share this initial password securely with the co-organizer. They can sign in immediately through the standard login page.
              </div>

              <div className="row" style={{ marginTop: '.5rem' }}>
                <button className="btn" disabled={addBusy}>
                  {addBusy ? 'Creating Account…' : 'Create Organizer Account'}
                </button>
                <button className="btn ghost" type="button" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
