import { requireNativeView } from 'expo';
import * as React from 'react';

import { DocumentFlattenerViewProps } from './DocumentFlattener.types';

const NativeView: React.ComponentType<DocumentFlattenerViewProps> =
  requireNativeView('DocumentFlattener');

export default function DocumentFlattenerView(props: DocumentFlattenerViewProps) {
  return <NativeView {...props} />;
}
