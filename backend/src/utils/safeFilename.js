// Strips characters that could break out of a Content-Disposition header
// value (quotes, control chars) when a user-entered name (e.g. full_name)
// is interpolated into a filename.
function safeFilename(name) {
  return String(name)
    .replace(/[\r\n"]/g, '')
    .replace(/\s+/g, '_');
}

module.exports = { safeFilename };
