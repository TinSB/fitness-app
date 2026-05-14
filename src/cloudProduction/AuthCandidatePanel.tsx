export type AuthCandidatePanelState =
  | 'disabled'
  | 'provider_candidate'
  | 'provider_not_configured'
  | 'session_unavailable'
  | 'user_unavailable'
  | 'unsupported'
  | 'authenticated-candidate'
  | 'unauthenticated';

export type AuthCandidatePanelProps = {
  visible?: boolean;
  state: AuthCandidatePanelState;
  providerCandidate?: 'supabase-auth-candidate' | 'clerk-candidate' | null;
  lastSessionStatus?: string;
  lastLinkingStatus?: string;
  lastEmergencyStatus?: string;
  controlsEnabled?: boolean;
  testOnlyCandidate?: boolean;
};

const STATE_LABELS: Record<AuthCandidatePanelState, string> = {
  disabled: 'Disabled',
  provider_candidate: 'Provider candidate',
  provider_not_configured: 'Provider not configured',
  session_unavailable: 'Session unavailable',
  user_unavailable: 'User unavailable',
  unsupported: 'Unsupported',
  'authenticated-candidate': 'Authenticated candidate',
  unauthenticated: 'Unauthenticated',
};

export const authCandidateStateLabel = (state: AuthCandidatePanelState) => STATE_LABELS[state];

export const AuthCandidatePanel = ({
  visible = false,
  state,
  providerCandidate = null,
  lastSessionStatus = 'not checked',
  lastLinkingStatus = 'not attempted',
  lastEmergencyStatus = 'available',
  controlsEnabled = false,
  testOnlyCandidate = false,
}: AuthCandidatePanelProps) => {
  if (!visible) return null;

  const controlsDisabled = !controlsEnabled || state === 'disabled' || state === 'provider_not_configured';

  return (
    <section aria-label="Auth candidate safety panel" data-auth-candidate-panel="candidate-only">
      <h2>Auth candidate safety check</h2>
      <dl>
        <div>
          <dt>Auth candidate state</dt>
          <dd>{authCandidateStateLabel(state)}</dd>
        </div>
        <div>
          <dt>Provider candidate</dt>
          <dd>{providerCandidate ?? 'not configured'}</dd>
        </div>
        <div>
          <dt>Last session status</dt>
          <dd>{lastSessionStatus}</dd>
        </div>
        <div>
          <dt>Last linking status</dt>
          <dd>{lastLinkingStatus}</dd>
        </div>
        <div>
          <dt>Emergency local status</dt>
          <dd>{lastEmergencyStatus}</dd>
        </div>
      </dl>
      <p>This candidate panel is not cloud sync and not multi-device sync.</p>
      <p>localStorage remains available for normal local app use.</p>
      <p>Login candidate will not automatically upload local training data.</p>
      <p>Logout candidate will not delete emergency backup.</p>
      <p>Backend-primary remains explicit opt-in and reversible.</p>
      {testOnlyCandidate ? (
        <p data-test-only-candidate="true">Fake provider state is candidate/test-only.</p>
      ) : null}
      <div>
        <button type="button" disabled={controlsDisabled} aria-disabled={controlsDisabled}>
          Start candidate
        </button>
        <button type="button" disabled={controlsDisabled} aria-disabled={controlsDisabled}>
          End candidate
        </button>
      </div>
      {controlsDisabled ? (
        <p data-controls-disabled="true">Provider is not configured for a real flow; controls are disabled.</p>
      ) : (
        <p data-controls-disabled="false">Controls require a separate guard before any candidate flow.</p>
      )}
    </section>
  );
};
