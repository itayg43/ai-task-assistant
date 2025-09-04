export const getCurrentTime = () => {
  return Date.now();
};

export const getCurrentDate = () => {
  return new Date();
};

export const getDateISO = () => {
  return getCurrentDate().toISOString();
};
