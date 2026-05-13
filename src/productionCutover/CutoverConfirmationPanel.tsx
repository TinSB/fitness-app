import type { SourceOfTruthRuntimeSwitchState } from './sourceOfTruthRuntimeSwitchGuard';

export type CutoverConfirmationPanelProps = {
  visible?: boolean;
  state: SourceOfTruthRuntimeSwitchState;
  lastBackendReadStatus?: string;
  lastBackendWriteStatus?: string;
  lastFallbackStatus?: string;
  confirmationRequired?: boolean;
};

const STATE_LABELS: Record<SourceOfTruthRuntimeSwitchState, string> = {
  'localStorage-primary': 'localStorage primary',
  'backend-read-candidate': 'Backend read candidate',
  'backend-primary-candidate': 'Backend primary candidate',
  'fallback-localStorage': 'Fallback localStorage',
  'emergency-localStorage': 'Emergency localStorage',
  disabled: 'Disabled',
};

export const cutoverStateLabel = (state: SourceOfTruthRuntimeSwitchState) => STATE_LABELS[state];

export const CutoverConfirmationPanel = ({
  visible = false,
  state,
  lastBackendReadStatus = 'not checked',
  lastBackendWriteStatus = 'not checked',
  lastFallbackStatus = 'not used',
  confirmationRequired = true,
}: CutoverConfirmationPanelProps) => {
  if (!visible) return null;

  return (
    <section aria-label="Backend-primary candidate confirmation" data-cutover-confirmation="candidate-only">
      <h2>Backend-primary candidate safety check</h2>
      <dl>
        <div>
          <dt>Current data source state</dt>
          <dd>{cutoverStateLabel(state)}</dd>
        </div>
        <div>
          <dt>Last backend read status</dt>
          <dd>{lastBackendReadStatus}</dd>
        </div>
        <div>
          <dt>Last backend write status</dt>
          <dd>{lastBackendWriteStatus}</dd>
        </div>
        <div>
          <dt>Last fallback status</dt>
          <dd>{lastFallbackStatus}</dd>
        </div>
      </dl>
      <p>This candidate mode is not cloud sync, not multi-device account sync, and not a SaaS backend.</p>
      <p>localStorage emergency backup remains preserved and can return the app to localStorage primary.</p>
      <p>Confirming here does not perform cutover without the separate runtime switch guard.</p>
      {confirmationRequired ? (
        <p data-confirmation-required="true">Explicit confirmation is required before backend-primary candidate mode can be attempted.</p>
      ) : (
        <p data-confirmation-required="false">Confirmation is currently not requested.</p>
      )}
    </section>
  );
};
