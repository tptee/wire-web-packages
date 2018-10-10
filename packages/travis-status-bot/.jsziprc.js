module.exports = {
  entries: [
    '.ebextensions/',
    'package.json',
    'dist/',
  ],
  force: true,
  ignoreEntries: [
    '.DS_Store',
    '*.d.ts',
  ],
  mode: 'add',
  outputEntry: `dist/travis-status-bot.zip`,
};
