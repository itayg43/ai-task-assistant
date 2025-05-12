const signalHandler =
  (exitCode: number, message?: string) => (errorOrReason?: Error | unknown) => {
    if (message) {
      console.log(message);
    }

    if (errorOrReason) {
      console.error(errorOrReason);
    }

    process.exit(exitCode);
  };

export default signalHandler;
