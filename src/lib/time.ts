export function getIsoTimestr(): string {
  return new Date().toISOString();
}

export const getTimestamp = () => {
  return Date.parse(new Date().toUTCString()) / 1000;
};

export const getMillisecond = () => {
  return new Date().getTime();
};

export const getOneYearLaterTimestr = () => {
  const currentDate = new Date();
  const oneYearLater = new Date(currentDate);
  oneYearLater.setFullYear(currentDate.getFullYear() + 1);
  return oneYearLater.toISOString();
};
