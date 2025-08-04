// Enforce exhaustive handling of union types in switch-like logic.
// - T: the union type of the value being switched on (must be string or number)
// - R: the return type of each handler function
// If any case is missing in the 'cases' object, TypeScript will error at compile time.
// Throws at runtime if an unhandled value is encountered (should never happen if types are correct).
export const exhaustiveSwitch = <T extends string | number, R>(
  value: T,
  cases: Record<T, () => R>
): R => {
  if (value in cases) {
    return cases[value]();
  }

  throw new Error(`Unhandled case: ${value}`);
};
