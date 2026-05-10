import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './DocumentFlattener.types';

type DocumentFlattenerModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class DocumentFlattenerModule extends NativeModule<DocumentFlattenerModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(DocumentFlattenerModule, 'DocumentFlattenerModule');
