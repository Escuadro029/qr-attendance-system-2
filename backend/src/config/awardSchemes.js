// Categories that use named awards instead of a plain 1st-10th rank.
// Matched by exact category name (categories have no "type" column — same
// name-based approach as rankingsListPdf.js's isTeamCategory()).
//
// `group: true` means any number of students can hold that award together
// (tagging adds a student rather than replacing anyone). Every award here is
// currently a group award — a `group: false` "solo" mode still exists in the
// code (see categoryAwards.routes.js) for a single student who replaces
// whoever held the award before, in case a future award needs it.
const AWARD_SCHEMES = {
  'Radio Broadcasting': [
    { label: 'Best News Anchor', group: true },
    { label: 'Better News Anchor', group: true },
    { label: 'Good News Anchor', group: true },
    { label: 'Best Technical Application', group: true },
    { label: 'Better Technical Application', group: true },
    { label: 'Good Technical Application', group: true },
    { label: 'Best Reporter', group: true },
    { label: 'Better Reporter', group: true },
    { label: 'Good Reporter', group: true },
    { label: 'Best Infomercial', group: true },
    { label: 'Better Infomercial', group: true },
    { label: 'Good Infomercial', group: true },
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
