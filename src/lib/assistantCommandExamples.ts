export type AssistantCommandIntent =
  | 'emphasis'
  | 'find'
  | 'create'
  | 'revise'
  | 'framework'
  | 'analyze'
  | 'actions'
  | 'organize'
  | 'sources'
  | 'canvas'

export const ASSISTANT_COMMAND_INTENTS: readonly AssistantCommandIntent[] = [
  'emphasis',
  'find',
  'create',
  'revise',
  'framework',
  'analyze',
  'actions',
  'organize',
  'sources',
  'canvas',
]

export type AssistantCommandExample = {
  intent: AssistantCommandIntent
  utterance: string
}

export const ASSISTANT_COMMAND_EXAMPLES: readonly AssistantCommandExample[] = [
  { intent: 'emphasis', utterance: 'Highlight the three strongest ideas on this board.' },
  {
    intent: 'emphasis',
    utterance: 'Make the key recommendation stand out from the supporting notes.',
  },
  { intent: 'emphasis', utterance: 'Call out the most urgent risk in the launch plan.' },
  {
    intent: 'emphasis',
    utterance: 'Emphasize the audience insight that should guide the campaign.',
  },
  { intent: 'emphasis', utterance: 'Which note deserves the most attention before the review?' },
  { intent: 'emphasis', utterance: 'Make the decision point easy to spot among these ideas.' },
  {
    intent: 'emphasis',
    utterance: 'Surface the critical assumption that could change the recommendation.',
  },
  {
    intent: 'emphasis',
    utterance: 'Highlight the strongest evidence behind our preferred direction.',
  },
  { intent: 'emphasis', utterance: 'Bring the main takeaway to the front of this plan.' },
  { intent: 'emphasis', utterance: 'Distinguish must-haves from nice-to-haves in these notes.' },

  { intent: 'find', utterance: 'Find every note that mentions customer retention.' },
  { intent: 'find', utterance: 'Locate where we recorded the launch date.' },
  { intent: 'find', utterance: 'Show me the ideas related to first-time buyers.' },
  { intent: 'find', utterance: 'Find the note with the latest budget estimate.' },
  { intent: 'find', utterance: 'Which notes mention the mobile onboarding flow?' },
  { intent: 'find', utterance: 'Locate our interview findings about pricing.' },
  { intent: 'find', utterance: 'Find any open questions about distribution.' },
  { intent: 'find', utterance: 'Search these notes for partner feedback.' },
  { intent: 'find', utterance: "Where did we capture the competitor's new offer?" },
  { intent: 'find', utterance: 'Find ideas that mention accessibility requirements.' },

  { intent: 'create', utterance: 'Create a note with three campaign concepts for students.' },
  { intent: 'create', utterance: 'Draft an action card for validating the pricing assumption.' },
  { intent: 'create', utterance: 'Turn this goal into a concise project brief.' },
  { intent: 'create', utterance: 'Add a note listing potential launch experiments.' },
  { intent: 'create', utterance: 'Create an action plan for testing the onboarding flow.' },
  { intent: 'create', utterance: 'Draft a card with the main customer problem and its evidence.' },
  { intent: 'create', utterance: 'Make a note for the proposed positioning statement.' },
  { intent: 'create', utterance: 'Create a checklist for preparing the stakeholder review.' },
  { intent: 'create', utterance: "Add a card that summarizes the team's next steps." },
  { intent: 'create', utterance: 'Draft a set of interview questions for new users.' },

  {
    intent: 'revise',
    utterance: 'Rewrite the "Audience research" note for a nontechnical reader.',
  },
  { intent: 'revise', utterance: 'Tighten the "Launch goals" note without dropping its metrics.' },
  { intent: 'revise', utterance: 'Update the "Pricing hypotheses" card with a clearer structure.' },
  { intent: 'revise', utterance: 'Make the "Partner feedback" note more concise.' },
  { intent: 'revise', utterance: 'Expand the rationale in the "Campaign direction" note.' },
  { intent: 'revise', utterance: 'Rephrase the "Onboarding risks" note in neutral language.' },
  {
    intent: 'revise',
    utterance: 'Correct the "Q3 rollout" note using the latest selected source.',
  },
  { intent: 'revise', utterance: 'Turn the "Research summary" note into three crisp bullets.' },
  { intent: 'revise', utterance: 'Improve the title and opening of "Retention ideas".' },
  {
    intent: 'revise',
    utterance: 'Revise the "Success measures" note to separate leading and lagging indicators.',
  },

  { intent: 'framework', utterance: 'Build a SWOT for the proposed campus launch.' },
  { intent: 'framework', utterance: 'Organize this strategy using a customer journey framework.' },
  {
    intent: 'framework',
    utterance: 'Recommend a framework for deciding between these three concepts.',
  },
  { intent: 'framework', utterance: 'Fill the empty sections of the existing marketing plan.' },
  { intent: 'framework', utterance: 'Expand the "Target Audience" section in the STP framework.' },
  {
    intent: 'framework',
    utterance: 'Design a reusable framework for evaluating partnership opportunities.',
  },
  { intent: 'framework', utterance: 'Create a prioritization matrix for these product ideas.' },
  {
    intent: 'framework',
    utterance: 'Compare the selected frameworks and choose the best fit for this goal.',
  },
  { intent: 'framework', utterance: 'Add a lean canvas for the subscription proposal.' },
  { intent: 'framework', utterance: 'Use a decision tree to map the support escalation options.' },

  { intent: 'analyze', utterance: 'Compare these concepts against the same success criteria.' },
  { intent: 'analyze', utterance: 'Identify themes that recur across the interview notes.' },
  { intent: 'analyze', utterance: 'Analyze the trade-offs between speed, cost, and reach.' },
  {
    intent: 'analyze',
    utterance: 'Summarize the strongest evidence for and against this proposal.',
  },
  { intent: 'analyze', utterance: 'Find gaps between our stated goals and current ideas.' },
  {
    intent: 'analyze',
    utterance: 'Assess the risks in the launch plan and explain their likely impact.',
  },
  {
    intent: 'analyze',
    utterance: 'Separate facts, assumptions, and open questions in these notes.',
  },
  {
    intent: 'analyze',
    utterance: 'What patterns distinguish feedback from new and returning customers?',
  },
  { intent: 'analyze', utterance: 'Rank the options by expected impact and confidence.' },
  { intent: 'analyze', utterance: 'Explain how the selected evidence changes the recommendation.' },

  { intent: 'actions', utterance: 'Move "Research findings" to the left of "Campaign options".' },
  { intent: 'actions', utterance: 'Place "Budget assumptions" below "Launch plan".' },
  { intent: 'actions', utterance: 'Delete the unlocked "Duplicate brainstorm" note.' },
  {
    intent: 'actions',
    utterance: 'Remove "Outdated pricing" and "Old launch dates" from the board.',
  },
  {
    intent: 'actions',
    utterance: 'Create an action card for following up on customer interviews.',
  },
  { intent: 'actions', utterance: 'Add a reminder card to confirm legal review before launch.' },
  { intent: 'actions', utterance: 'Move "Risks" above "Milestones".' },
  { intent: 'actions', utterance: 'Delete the unlocked note titled "Scratch ideas".' },
  { intent: 'actions', utterance: 'Turn the agreed follow-up into an action item.' },
  { intent: 'actions', utterance: 'Record "Test the prototype" as the next action.' },

  { intent: 'organize', utterance: 'Group these notes by customer problem.' },
  { intent: 'organize', utterance: 'Sort the ideas into short-term and long-term opportunities.' },
  { intent: 'organize', utterance: 'Cluster the interview findings by theme.' },
  { intent: 'organize', utterance: 'Separate product requirements from marketing ideas.' },
  {
    intent: 'organize',
    utterance: 'Arrange these concepts into an explore, test, and launch sequence.',
  },
  { intent: 'organize', utterance: 'Group the risks by likelihood and impact.' },
  { intent: 'organize', utterance: 'Put related notes about onboarding together.' },
  { intent: 'organize', utterance: 'Organize these insights by customer segment.' },
  { intent: 'organize', utterance: 'Split these ideas into proven, assumed, and unanswered.' },
  { intent: 'organize', utterance: 'Create clear categories for the notes on this board.' },

  {
    intent: 'sources',
    utterance: 'Use the selected interview notes as evidence for the recommendation.',
  },
  { intent: 'sources', utterance: 'Base the market summary only on the attached report.' },
  { intent: 'sources', utterance: 'Cite the source notes that support each claim.' },
  { intent: 'sources', utterance: 'Compare the customer quotes with the survey results.' },
  { intent: 'sources', utterance: 'Use the imported PDF to fill the "Market Context" section.' },
  { intent: 'sources', utterance: 'Keep unsupported details labeled as assumptions.' },
  { intent: 'sources', utterance: 'Pull the key figures from the selected spreadsheet notes.' },
  { intent: 'sources', utterance: 'Ground this draft in the attached competitor analysis.' },
  { intent: 'sources', utterance: 'Which selected sources support the pricing recommendation?' },
  {
    intent: 'sources',
    utterance: 'Use the latest workshop notes and show where each point came from.',
  },

  { intent: 'canvas', utterance: 'Lock these campaign notes before the review.' },
  { intent: 'canvas', utterance: 'Unlock the launch plan note so I can edit it.' },
  { intent: 'canvas', utterance: 'Collapse the long notes to make this board easier to scan.' },
  { intent: 'canvas', utterance: 'Expand the campaign note so I can read all of it.' },
  { intent: 'canvas', utterance: 'Change the color of the recommendation note to yellow.' },
  { intent: 'canvas', utterance: 'Mark the completed follow-up notes as done.' },
  { intent: 'canvas', utterance: 'Set a due date of 2026-11-01 on the launch task.' },
  { intent: 'canvas', utterance: 'Arrange the selected notes in a row.' },
  { intent: 'canvas', utterance: 'Put these notes in reading order from left to right.' },
  { intent: 'canvas', utterance: 'Space these notes evenly in a grid.' },
]

const MAX_EXAMPLES_PER_INTENT = 4
const EXAMPLE_INDICES: Partial<Record<AssistantCommandIntent, number[]>> = {
  emphasis: [0, 1, 2, 7],
  actions: [0, 2, 4, 5],
  organize: [0, 1, 4, 9],
  canvas: [0, 2, 4, 6],
}

/** Select a stable, bounded subset for prompt examples or evaluation fixtures. */
export function selectAssistantCommandExamples(
  intent: AssistantCommandIntent,
  limit?: number,
): AssistantCommandExample[] {
  const requestedLimit = limit ?? MAX_EXAMPLES_PER_INTENT
  const count = Number.isFinite(requestedLimit)
    ? Math.max(0, Math.min(MAX_EXAMPLES_PER_INTENT, Math.floor(requestedLimit)))
    : MAX_EXAMPLES_PER_INTENT

  const matching = ASSISTANT_COMMAND_EXAMPLES.filter((example) => example.intent === intent)
  const selected =
    EXAMPLE_INDICES[intent]
      ?.map((index) => matching[index])
      .filter((example): example is AssistantCommandExample => !!example) ?? matching
  return selected.slice(0, count)
}
