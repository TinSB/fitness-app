import React from 'react';
import { ProgressView, type ProgressViewProps } from './ProgressView';

export function RecordView(props: ProgressViewProps) {
  return <ProgressView {...props} initialSection={props.initialSection || 'calendar'} />;
}
