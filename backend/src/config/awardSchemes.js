// Categories that use named awards instead of a plain 1st-10th rank.
// Matched by exact category name (categories have no "type" column — same
// name-based approach as rankingsListPdf.js's isTeamCategory()).
//
// Each award is either:
//   - "solo"  (group: false) — exactly one student holds this award; tagging
//     a new student replaces whoever held it before, same as the existing
//     numeric ranking's upsert behavior.
//   - "group" (group: true)  — any number of students can hold this award
//     together (e.g. a whole broadcast crew as "Champion"); tagging adds a
//     student rather than replacing anyone.
const AWARD_SCHEMES = {
  'Radio Broadcasting': [
    { label: 'Best News Anchor', group: false },
    { label: 'Better News Anchor', group: false },
    { label: 'Good News Anchor', group: false },
    { label: 'Best Technical Application', group: false },
    { label: 'Better Technical Application', group: false },
    { label: 'Good Technical Application', group: false },
    { label: 'Best Reporter', group: false },
    { label: 'Better Reporter', group: false },
    { label: 'Good Reporter', group: false },
    { label: 'Best Infomercial', group: false },
    { label: 'Better Infomercial', group: false },
    { label: 'Good Infomercial', group: false },
    { label: 'Champion', group: true },
    { label: '1st Runner-up', group: true },
    { label: '2nd Runner-up', group: true },
  ],
  Scriptwriting: [
    { label: 'Champion', group: true },
    { label: 'Better Radio Script', group: true },
    { label: 'Good Radio Script', group: true },
  ],
};

function getAwardScheme(categoryName) {
  return AWARD_SCHEMES[categoryName] || null;
}

function findAward(categoryName, awardLabel) {
  const scheme = getAwardScheme(categoryName);
  return scheme ? scheme.find((a) => a.label === awardLabel) || null : null;
}

module.exports = { AWARD_SCHEMES, getAwardScheme, findAward };
