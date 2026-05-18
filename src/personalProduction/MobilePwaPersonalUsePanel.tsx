import {
  buildMobilePwaPersonalUseView,
  defaultMobilePwaPersonalUseStates,
  type MobilePwaPersonalUseState,
} from './mobilePwaPersonalUseCopy';

export type MobilePwaPersonalUsePanelProps = {
  visible?: boolean;
  states?: readonly MobilePwaPersonalUseState[];
};

export const MobilePwaPersonalUsePanel = ({
  visible = true,
  states = defaultMobilePwaPersonalUseStates,
}: MobilePwaPersonalUsePanelProps) => {
  if (!visible) return null;

  const view = buildMobilePwaPersonalUseView({ states: [...states] });

  return (
    <section aria-label="Mobile PWA personal use guidance panel" data-mobile-pwa-panel="presentational">
      <h2>{view.title}</h2>
      <p>{view.notice}</p>
      <ul>
        {view.guidance.map((item) => (
          <li key={item.label}>
            <strong>{item.label}</strong>
            <span>{item.summary}</span>
            <span>{item.safety}</span>
          </li>
        ))}
      </ul>
      <button type="button" disabled aria-disabled="true">
        本地优先手机使用
      </button>
    </section>
  );
};
