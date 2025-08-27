import { executeSyncPattern } from "@controllers/capabilities-controller/executors/execute-sync-pattern";
import { CapabilityPattern } from "@shared/types";
import { exhaustiveSwitch } from "@shared/utils/exhaustive-switch";

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
