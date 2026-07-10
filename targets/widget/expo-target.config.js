/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'DiviWidget',
  // 16.2 so the Live Activity APIs (ActivityConfiguration / ActivityViewContext,
  // 16.1+, and ActivityContent updates, 16.2+) are available unguarded.
  deploymentTarget: '16.2',
};
