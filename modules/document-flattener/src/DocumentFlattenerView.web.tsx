import * as React from 'react';

import { DocumentFlattenerViewProps } from './DocumentFlattener.types';

export default function DocumentFlattenerView(props: DocumentFlattenerViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
