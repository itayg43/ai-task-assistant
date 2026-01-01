import { executeAsyncPattern } from "@controllers/capabilities-controller/executors/execute-async-pattern";
import { executeSyncPattern } from "@controllers/capabilities-controller/executors/execute-sync-pattern";
import { exhaustiveSwitch } from "@shared/utils/exhaustive-switch";
import { CapabilityPattern } from "@types";

export const getPatternExecutor = (pattern: CapabilityPattern) => {
  return exhaustiveSwitch(pattern, {
    sync: () => {
      return executeSyncPattern;
    },
    async: () => {
      return executeAsyncPattern;
    },
  });
};
