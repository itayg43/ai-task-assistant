export const getCurrentTime = () => {
  return Date.now();
};

export const getElapsedTime = (timestamp: number) => {
  return getCurrentTime() - timestamp;
};

export const getCurrentDate = () => {
  return new Date();
};

export const getDateISO = () => {
  return getCurrentDate().toISOString();
};
