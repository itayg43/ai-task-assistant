export const getCurrentTime = () => {
  return Date.now();
};

export const getElapsedTime = (timestamp: number) => {
  return getCurrentTime() - timestamp;
};
