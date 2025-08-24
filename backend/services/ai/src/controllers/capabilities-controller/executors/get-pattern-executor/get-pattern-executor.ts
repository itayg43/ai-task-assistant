import { executeSyncPattern } from "@controllers/capabilities-controller/executors/execute-sync-pattern";
import { exhaustiveSwitch } from "@shared/utils/exhaustive-switch";
import { CapabilityPattern } from "@types";

export const getPatternExecutor = (pattern: CapabilityPattern) => {
  return exhaustiveSwitch(pattern, {
    sync: () => {
      return executeSyncPattern;
    },
    async: () => {
      throw new Error(`Unimplemented pattern: ${pattern}`);
    },
  });
};
