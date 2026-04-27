// Canonical project statuses used by the Dashboard dropdown and the
// project-header quick-change dropdown. Keep this list in one place so
// both surfaces show the same options.

export const STATUS_OPTIONS = [
  "Need to make RFQ",
  "Waiting for quote",
  "Need to make proposal",
  "Proposal sent",
];

export function isKnownStatus(s) {
  return STATUS_OPTIONS.includes(s);
}
