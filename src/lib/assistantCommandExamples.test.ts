import { describe, expect, it } from 'vitest'
import {
  ASSISTANT_COMMAND_EXAMPLES,
  ASSISTANT_COMMAND_INTENTS,
  selectAssistantCommandExamples,
} from './assistantCommandExamples'

describe('assistant command examples', () => {
  it('contains exactly 100 utterances across all requested intent families', () => {
    expect(ASSISTANT_COMMAND_EXAMPLES).toHaveLength(100)
    expect(new Set(ASSISTANT_COMMAND_EXAMPLES.map((example) => example.utterance)).size).toBe(100)
    expect(new Set(ASSISTANT_COMMAND_EXAMPLES.map((example) => example.intent))).toEqual(
      new Set(ASSISTANT_COMMAND_INTENTS),
    )

    for (const intent of ASSISTANT_COMMAND_INTENTS) {
      expect(
        ASSISTANT_COMMAND_EXAMPLES.filter((example) => example.intent === intent),
      ).toHaveLength(10)
    }
  })

  it('selects deterministic, intent-specific examples with a maximum of four', () => {
    for (const intent of ASSISTANT_COMMAND_INTENTS) {
      const first = selectAssistantCommandExamples(intent)
      expect(selectAssistantCommandExamples(intent)).toEqual(first)
      expect(first).toHaveLength(4)
      expect(first.every((example) => example.intent === intent)).toBe(true)
      expect(selectAssistantCommandExamples(intent, 20)).toEqual(first)
      expect(selectAssistantCommandExamples(intent, 2)).toEqual(first.slice(0, 2))
      expect(selectAssistantCommandExamples(intent, 0)).toEqual([])
    }
  })
})
