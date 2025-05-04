// packages/shared/index.js
module.exports = {
  validateFilename: (name) => /^[\w\s.-]+$/.test(name),
  slugify: (text) => text.toLowerCase().replace(/\s+/g, '-')
};
