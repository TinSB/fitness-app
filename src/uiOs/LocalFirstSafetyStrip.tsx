import { SafetyStrip } from './surfaces/SafetyStrip';

export const LocalFirstSafetyStrip = () => (
  <div className="mx-auto w-full max-w-[1600px] px-4 pt-3 md:px-6 lg:px-8">
    <SafetyStrip includeSecondaryCopy />
  </div>
);
