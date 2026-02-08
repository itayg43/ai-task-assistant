export const waitForBackgroundTasks = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));
