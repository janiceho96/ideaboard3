import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { ASSISTANT_COMMAND_EXAMPLES } from './assistantCommandExamples'
import { classifyAssistantCommand } from './assistantCommandPlan'

const results = ASSISTANT_COMMAND_EXAMPLES.map((example, index) => ({ number: index + 1, ...example, actual: classifyAssistantCommand(example.utterance) }))
if (process.env.IDEABOARD_COMMAND_COVERAGE_REPORT) writeFileSync(process.env.IDEABOARD_COMMAND_COVERAGE_REPORT, JSON.stringify(results, null, 2))

describe('100 example commands reach a supported command family', () => {
  for (const result of results) it(`${result.number}: ${result.utterance}`, () => {
    expect(result.actual, `Expected ${result.intent}; must not fall into unrelated framework drafting`).not.toBeNull()
  })
})
