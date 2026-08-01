const RANK_LABELS = {
  1: '1st Place', 2: '2nd Place', 3: '3rd Place', 4: '4th Place', 5: '5th Place',
  6: '6th Place', 7: '7th Place', 8: '8th Place', 9: '9th Place', 10: '10th Place',
};

function rankLabel(rank) {
  return RANK_LABELS[rank] || `Rank ${rank}`;
}

// Categories like "Radio Broadcasting" are produced by a crew rather than a
// single writer/photographer, so the printed results list styles them as a
// "Team" category instead of a "Journalism" one. Purely name-based since the
// categories table has no explicit type column.
function isTeamCategory(name) {
  return /\b(team|broadcast|radio)\b/i.test(name || '');
}

function buildRankingsListDocDefinition({ categoryName, rows, eventName, dateRange, venue }) {
  const isTeam = isTeamCategory(categoryName);
  const accent = isTeam ? '#8a4b08' : '#1c3f94';

  const body = [
    [
      { text: 'Rank', style: 'th' },
      { text: isTeam ? 'Team Representative' : 'Student', style: 'th' },
      { text: 'Grade & Section', style: 'th' },
    ],
    ...rows.map((r) => [
      { text: rankLabel(r.rank) },
      { text: r.full_name },
      { text: `Grade ${r.grade} - ${r.section}` },
    ]),
  ];

  const metaLine = [dateRange, venue].filter(Boolean).join('   •   ');

  return {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 11 },
    content: [
      { text: eventName || 'School Press Conference', style: 'eyebrow' },
      { text: isTeam ? 'TEAM CATEGORY RESULTS' : 'JOURNALISM CATEGORY RESULTS', style: 'kicker', color: accent },
      { text: categoryName, style: 'title' },
      metaLine ? { text: metaLine, style: 'meta' } : null,
      {
        table: { headerRows: 1, widths: ['auto', '*', 'auto'], body },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? accent : rowIndex % 2 === 0 ? '#f5f5f7' : null),
          hLineColor: () => '#d9d9d9',
          vLineColor: () => '#d9d9d9',
        },
        margin: [0, 16, 0, 0],
      },
    ].filter(Boolean),
    styles: {
      eyebrow: { fontSize: 9, color: '#888', alignment: 'center' },
      kicker: { fontSize: 10, bold: true, alignment: 'center', margin: [0, 6, 0, 2] },
      title: { fontSize: 20, bold: true, alignment: 'center', margin: [0, 0, 0, 6] },
      meta: { fontSize: 9, color: '#666', alignment: 'center', margin: [0, 0, 0, 4] },
      th: { bold: true, color: 'white', fontSize: 10 },
    },
  };
}

module.exports = { isTeamCategory, buildRankingsListDocDefinition, rankLabel };
