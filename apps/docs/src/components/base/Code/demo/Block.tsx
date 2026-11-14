import { _component } from '@zerodep-dev/vue-tsx-pro-tsx';
import { CodeBlock } from '@rune-engine/components';

const source = `import { createApp } from 'vue';
import { createUi, forestTheme } from '@rune-engine/components';
import App from './App';

createApp(App)
  .use(createUi({ theme: forestTheme }))
  .mount('#app');`;

export default _component(() => () => (
  <CodeBlock code={source} lang="ts" title="main.ts" lineNumbers highlightLines="2,6" />
));
