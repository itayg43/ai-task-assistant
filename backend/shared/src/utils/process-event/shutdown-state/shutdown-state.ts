import { SERVER_SHUTDOWN_STATE } from "../../../constants";

export function checkIfShutdownAlreadyInProgress(
  shutdownView: Uint8Array
): boolean {
  const expected = SERVER_SHUTDOWN_STATE.NOT_SHUTTING_DOWN;
  const replacement = SERVER_SHUTDOWN_STATE.SHUTTING_DOWN;

  return (
    Atomics.compareExchange(shutdownView, 0, expected, replacement) !== expected
  );
}
