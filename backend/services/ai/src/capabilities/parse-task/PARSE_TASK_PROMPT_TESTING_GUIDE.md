# Comprehensive Prompt Testing Guide

## AI Task Assistant - Parse Task Capability

---

## Table of Contents

1. [LLM-as-Judge Testing](#llm-as-judge-testing)
2. [Consistency Testing](#consistency-testing)
3. [Edge Case Testing](#edge-case-testing)
4. [Real World Validation](#real-world-validation)
5. [Performance Testing](#performance-testing)
6. [Implementation Strategy](#implementation-strategy)
7. [Cost Management](#cost-management)

---

## LLM-as-Judge Testing

### Overview

Use AI to evaluate the quality of AI-generated responses, creating a self-validating system.

### Implementation

#### Basic Quality Evaluator

```typescript
// test/quality/llm-judge.ts
import { openai } from "@clients/openai";

interface QualityEvaluation {
  score: number; // 1-10
  reasoning: string;
  issues: string[];
  suggestions: string[];
}

export async function evaluateTaskQuality(
  input: string,
  parsedResult: any
): Promise<QualityEvaluation> {
  const evaluationPrompt = `
You are an expert task management consultant. Evaluate the quality of this parsed task:

**Input:** "${input}"

**Parsed Result:** ${JSON.stringify(parsedResult, null, 2)}

**Evaluation Criteria:**
- Accuracy: Does the parsed result match the input intent?
- Completeness: Are all required fields properly filled?
- Priority Logic: Is the priority score and level appropriate?
- Category Assignment: Is the category correctly inferred?
- Date Parsing: Are dates correctly interpreted?
- Subtask Generation: Are subtasks logical and helpful?

**Scoring:**
- 9-10: Excellent - Perfect parsing, logical priority, helpful subtasks
- 7-8: Good - Minor issues, mostly accurate
- 5-6: Acceptable - Some issues but functional
- 3-4: Poor - Significant problems
- 1-2: Unacceptable - Major failures

Return only valid JSON:
{
  "score": number,
  "reasoning": "string",
  "issues": ["string"],
  "suggestions": ["string"]
}
`;

  const response = await openai.responses.create({
    model: "gpt-4o-mini", // Use cheaper model for testing
    instructions: evaluationPrompt,
    input: "",
    temperature: 0,
  });

  try {
    return JSON.parse(response.output_text);
  } catch (error) {
    throw new Error(
      `Failed to parse evaluation response: ${response.output_text}`
    );
  }
}
```

#### Batch Quality Testing

```typescript
// test/quality/batch-evaluator.ts
export async function runBatchQualityTests(
  testCases: Array<{ input: string; expectedScore: number }>
): Promise<QualityTestResult[]> {
  const results: QualityTestResult[] = [];

  // Process in batches to manage costs
  const batchSize = 5;
  for (let i = 0; i < testCases.length; i += batchSize) {
    const batch = testCases.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (testCase) => {
        const parsedResult = await parseTaskHandler(testCase.input);
        const evaluation = await evaluateTaskQuality(
          testCase.input,
          parsedResult
        );

        return {
          input: testCase.input,
          expectedScore: testCase.expectedScore,
          actualScore: evaluation.score,
          passed: evaluation.score >= testCase.expectedScore,
          evaluation,
        };
      })
    );

    results.push(...batchResults);

    // Add delay between batches to avoid rate limits
    if (i + batchSize < testCases.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
```

#### Quality Test Suite

```typescript
// test/quality/quality-suite.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { runBatchQualityTests } from "./batch-evaluator";

describe("LLM Quality Tests", () => {
  const criticalTestCases = [
    {
      input: "Pay electricity bill tomorrow",
      expectedScore: 8,
      description: "Critical financial task with deadline",
    },
    {
      input: "Submit Q2 report by Friday",
      expectedScore: 8,
      description: "High priority work task",
    },
    {
      input: "Maybe call mom when you have time",
      expectedScore: 6,
      description: "Vague personal task",
    },
    {
      input: "Book dentist appointment",
      expectedScore: 7,
      description: "Health task without deadline",
    },
    {
      input: "Schedule team sync every Monday",
      expectedScore: 8,
      description: "Recurring work task",
    },
  ];

  let qualityResults: QualityTestResult[];

  beforeAll(async () => {
    // Only run if explicitly enabled
    if (process.env.RUN_QUALITY_TESTS !== "true") {
      console.log("Skipping expensive LLM tests");
      return;
    }

    qualityResults = await runBatchQualityTests(criticalTestCases);
  });

  it("should maintain high quality for critical scenarios", () => {
    if (!qualityResults) return;

    const failedTests = qualityResults.filter((result) => !result.passed);

    if (failedTests.length > 0) {
      console.log("Quality test failures:", failedTests);
    }

    expect(failedTests.length).toBe(0);
  });

  it("should achieve minimum quality threshold", () => {
    if (!qualityResults) return;

    const averageScore =
      qualityResults.reduce((sum, result) => sum + result.actualScore, 0) /
      qualityResults.length;

    expect(averageScore).toBeGreaterThanOrEqual(7.0);
  });
});
```

---

## Consistency Testing

### Overview

Ensure the AI produces consistent outputs for similar inputs and maintains stable behavior over time.

### Implementation

#### Consistency Validator

```typescript
// test/consistency/consistency-validator.ts
export async function testConsistency(
  baseInput: string,
  variations: string[],
  maxScoreDifference: number = 2
): Promise<ConsistencyResult> {
  const results = await Promise.all(
    variations.map(async (variation) => {
      const result = await parseTaskHandler(variation);
      return { variation, result };
    })
  );

  // Compare priority scores for consistency
  const priorityScores = results.map((r) => r.result.priorityScore);
  const scoreRange = Math.max(...priorityScores) - Math.min(...priorityScores);

  // Compare priority levels
  const priorityLevels = results.map((r) => r.result.priorityLevel);
  const levelConsistency = new Set(priorityLevels).size === 1;

  // Compare categories
  const categories = results.map((r) => r.result.category);
  const categoryConsistency = new Set(categories).size === 1;

  return {
    passed:
      scoreRange <= maxScoreDifference &&
      levelConsistency &&
      categoryConsistency,
    scoreRange,
    levelConsistency,
    categoryConsistency,
    results,
  };
}
```

#### Consistency Test Cases

```typescript
// test/consistency/consistency-suite.test.ts
describe("Consistency Tests", () => {
  it("should maintain consistent priority for deadline variations", async () => {
    const baseInput = "Submit report";
    const variations = [
      "Submit report by tomorrow",
      "Submit report by next day",
      "Submit report by 24 hours from now",
    ];

    const result = await testConsistency(baseInput, variations, 3);
    expect(result.passed).toBe(true);
  });

  it("should maintain consistent category for work-related tasks", async () => {
    const baseInput = "Complete project";
    const variations = [
      "Finish project",
      "Wrap up project",
      "Complete the project work",
    ];

    const result = await testConsistency(baseInput, variations, 2);
    expect(result.categoryConsistency).toBe(true);
    expect(result.results.every((r) => r.result.category === "work")).toBe(
      true
    );
  });
});
```

---

## Edge Case Testing

### Overview

Test boundary conditions, unusual inputs, and error scenarios to ensure robust handling.

### Implementation

#### Edge Case Generator

```typescript
// test/edge-cases/edge-case-generator.ts
export const edgeCases = {
  // Extremely long inputs
  longInputs: [
    "a".repeat(255), // Max allowed length
    "This is a very long task description that contains many words and should still be processed correctly even though it's quite verbose and detailed and includes various punctuation marks and different types of content that might challenge the AI's ability to parse and understand the core task requirements while maintaining accuracy and relevance in the output".repeat(
      2
    ),
  ],

  // Special characters and formatting
  specialCharacters: [
    "Task with emojis 🚀📅💼",
    "Task with quotes: 'single' and \"double\"",
    "Task with numbers: 123, 456, 789",
    "Task with symbols: @#$%^&*()",
    "Task with newlines\nand tabs\t",
  ],

  // Ambiguous inputs
  ambiguousInputs: [
    "Do something",
    "Maybe this",
    "If possible",
    "When convenient",
    "Urgent but not really",
  ],

  // Mixed languages
  mixedLanguages: [
    "Submit report mañana",
    "Call client demain",
    "Task with 中文 characters",
  ],

  // Extreme priorities
  extremePriorities: [
    "ASAP URGENT CRITICAL EMERGENCY",
    "Whenever you feel like it",
    "Not important at all",
  ],
};
```

#### Edge Case Test Suite

```typescript
// test/edge-cases/edge-case-suite.test.ts
describe("Edge Case Tests", () => {
  it("should handle maximum length input", async () => {
    const maxLengthInput = "a".repeat(255);
    const result = await parseTaskHandler(maxLengthInput);

    expect(result.title).toBeDefined();
    expect(result.priorityLevel).toBeDefined();
    expect(result.category).toBeDefined();
  });

  it("should handle special characters gracefully", async () => {
    const specialInput = "Task with emojis 🚀📅💼 and symbols @#$%";
    const result = await parseTaskHandler(specialInput);

    expect(result.title).toContain("Task with emojis");
    expect(result.priorityLevel).toBeDefined();
  });

  it("should provide reasonable defaults for ambiguous inputs", async () => {
    const ambiguousInput = "Do something";
    const result = await parseTaskHandler(ambiguousInput);

    expect(result.priorityLevel).toBe("low");
    expect(result.priorityScore).toBeLessThan(40);
    expect(result.category).toBeDefined();
  });

  it("should handle mixed language inputs", async () => {
    const mixedInput = "Submit report mañana";
    const result = await parseTaskHandler(mixedInput);

    expect(result.title).toContain("Submit report");
    expect(result.dueDate).toBeDefined(); // Should parse "mañana"
  });
});
```

---

## Real World Validation

### Overview

Test with authentic, user-generated inputs to ensure the system works in production scenarios.

### Implementation

#### Real World Test Harness

```typescript
// test/real-world/real-world-validator.ts
export interface RealWorldTestCase {
  input: string;
  expectedBehavior: {
    priorityRange?: [number, number];
    category?: string;
    hasDeadline?: boolean;
    hasSubtasks?: boolean;
  };
  userContext?: string;
}

export const realWorldTestCases: RealWorldTestCase[] = [
  {
    input: "Pay rent on the 1st",
    expectedBehavior: {
      priorityRange: [80, 100],
      category: "finance",
      hasDeadline: true,
      hasSubtasks: true,
    },
    userContext: "Financial deadline with consequences",
  },
  {
    input: "Call mom back",
    expectedBehavior: {
      priorityRange: [50, 70],
      category: "personal",
      hasDeadline: false,
      hasSubtasks: false,
    },
    userContext: "Personal relationship task",
  },
  {
    input: "Fix the bug in production",
    expectedBehavior: {
      priorityRange: [85, 100],
      category: "work",
      hasDeadline: true,
      hasSubtasks: true,
    },
    userContext: "Critical work issue",
  },
  {
    input: "Buy groceries",
    expectedBehavior: {
      priorityRange: [30, 60],
      category: "errand",
      hasDeadline: false,
      hasSubtasks: true,
    },
    userContext: "Routine errand",
  },
];

export async function validateRealWorldBehavior(
  testCase: RealWorldTestCase
): Promise<ValidationResult> {
  const result = await parseTaskHandler(testCase.input);
  const { expectedBehavior } = testCase;

  const validation = {
    priorityInRange: true,
    categoryMatch: true,
    deadlineMatch: true,
    subtasksMatch: true,
  };

  // Validate priority range
  if (expectedBehavior.priorityRange) {
    const [min, max] = expectedBehavior.priorityRange;
    validation.priorityInRange =
      result.priorityScore >= min && result.priorityScore <= max;
  }

  // Validate category
  if (expectedBehavior.category) {
    validation.categoryMatch = result.category === expectedBehavior.category;
  }

  // Validate deadline presence
  if (expectedBehavior.hasDeadline !== undefined) {
    validation.deadlineMatch =
      (result.dueDate !== null) === expectedBehavior.hasDeadline;
  }

  // Validate subtasks presence
  if (expectedBehavior.hasSubtasks !== undefined) {
    validation.subtasksMatch =
      (result.subtasks !== null) === expectedBehavior.hasSubtasks;
  }

  return {
    passed: Object.values(validation).every((v) => v),
    validation,
    result,
    testCase,
  };
}
```

#### Real World Test Suite

```typescript
// test/real-world/real-world-suite.test.ts
describe("Real World Validation", () => {
  it("should handle financial deadlines correctly", async () => {
    const testCase = realWorldTestCases.find((t) => t.input.includes("rent"));
    if (!testCase) throw new Error("Test case not found");

    const result = await validateRealWorldBehavior(testCase);
    expect(result.passed).toBe(true);
    expect(result.result.priorityLevel).toBe("critical");
    expect(result.result.category).toBe("finance");
  });

  it("should handle personal tasks appropriately", async () => {
    const testCase = realWorldTestCases.find((t) => t.input.includes("mom"));
    if (!testCase) throw new Error("Test case not found");

    const result = await validateRealWorldBehavior(testCase);
    expect(result.passed).toBe(true);
    expect(result.result.category).toBe("personal");
    expect(result.result.priorityScore).toBeGreaterThanOrEqual(50);
  });

  it("should handle work emergencies with high priority", async () => {
    const testCase = realWorldTestCases.find((t) => t.input.includes("bug"));
    if (!testCase) throw new Error("Test case not found");

    const result = await validateRealWorldBehavior(testCase);
    expect(result.passed).toBe(true);
    expect(result.result.priorityLevel).toBe("critical");
    expect(result.result.category).toBe("work");
  });
});
```

---

## Performance Testing

### Overview

Measure response times, token usage, and system performance under various load conditions.

### Implementation

#### Performance Metrics Collector

```typescript
// test/performance/performance-metrics.ts
export interface PerformanceMetrics {
  responseTime: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  memoryUsage?: number;
  cpuUsage?: number;
}

export async function measurePerformance(
  input: string,
  iterations: number = 1
): Promise<PerformanceMetrics[]> {
  const metrics: PerformanceMetrics[] = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    const result = await parseTaskHandler(input);

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    metrics.push({
      responseTime: endTime - startTime,
      tokenUsage: {
        prompt: result.usage?.prompt_tokens || 0,
        completion: result.usage?.completion_tokens || 0,
        total:
          (result.usage?.prompt_tokens || 0) +
          (result.usage?.completion_tokens || 0),
      },
      memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
    });

    // Small delay between iterations
    if (i < iterations - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return metrics;
}
```

#### Performance Test Suite

```typescript
// test/performance/performance-suite.test.ts
describe("Performance Tests", () => {
  it("should respond within acceptable time limits", async () => {
    const testInput = "Submit weekly report by Friday";
    const metrics = await measurePerformance(testInput, 3);

    const averageResponseTime =
      metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;

    // Should respond within 5 seconds
    expect(averageResponseTime).toBeLessThan(5000);
  });

  it("should maintain consistent performance across iterations", async () => {
    const testInput = "Call client tomorrow";
    const metrics = await measurePerformance(testInput, 5);

    const responseTimes = metrics.map((m) => m.responseTime);
    const maxDeviation =
      Math.max(...responseTimes) - Math.min(...responseTimes);

    // Performance should be consistent (within 2 seconds)
    expect(maxDeviation).toBeLessThan(2000);
  });

  it("should optimize token usage", async () => {
    const testInput = "Simple task";
    const metrics = await measurePerformance(testInput, 1);

    const tokenUsage = metrics[0].tokenUsage;

    // Should use reasonable token amounts
    expect(tokenUsage.prompt).toBeLessThan(1000);
    expect(tokenUsage.completion).toBeLessThan(500);
    expect(tokenUsage.total).toBeLessThan(1500);
  });
});
```

---

## Implementation Strategy

### Phase 1: Foundation (Week 1)

- Implement basic LLM-as-judge evaluator
- Set up consistency testing framework
- Create edge case test suite

### Phase 2: Validation (Week 2)

- Implement real world validation
- Add performance testing
- Set up automated test runs

### Phase 3: Optimization (Week 3)

- Refine prompts based on test results
- Optimize for cost and performance
- Document best practices

### Phase 4: Production (Week 4)

- Integrate with CI/CD pipeline
- Set up monitoring and alerting
- Establish quality gates

---

## Cost Management

### Budget Allocation

- **Development Testing**: $5-10/month (gpt-4o-mini)
- **Quality Assurance**: $20-50/month (gpt-4)
- **Production Monitoring**: $10-30/month (gpt-4o-mini)

### Cost Optimization Strategies

1. **Use cheaper models** for routine testing
2. **Batch evaluations** to reduce API calls
3. **Cache results** to avoid re-testing
4. **Selective testing** for critical scenarios only
5. **Monitor usage** and set alerts

### Test Execution Strategy

```typescript
// package.json scripts
{
  "scripts": {
    "test": "vitest", // Free, fast tests
    "test:quality": "vitest test/quality --run", // Expensive, occasional
    "test:performance": "vitest test/performance --run", // Free, performance
    "test:all": "npm run test && npm run test:performance" // Regular CI
  }
}
```

---

## Conclusion

This comprehensive testing strategy provides:

✅ **Quality Assurance** through LLM-as-judge evaluation
✅ **Reliability** through consistency testing  
✅ **Robustness** through edge case validation
✅ **Real-world Validation** through authentic test cases
✅ **Performance Monitoring** through metrics collection
✅ **Cost Control** through strategic test execution

Start with the foundation tests and gradually add more sophisticated validation as your system matures. Remember: **good testing is an investment in quality, not just a cost center**.

---

_Generated for AI Task Assistant - Parse Task Capability_
_Date: ${new Date().toISOString()}_
