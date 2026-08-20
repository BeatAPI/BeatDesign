const PROJECT_ACTIVITY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function formatProjectActivityDate(date: Date) {
  return PROJECT_ACTIVITY_DATE_FORMATTER.format(date);
}
