import { useState, useCallback } from 'react'
import type { BuiltinFrameworkType, CustomFrameworkTemplate, FrameworkArea, FrameworkType, FrameInstance } from '../types'
import { frameworkTypeFor, validateCustomFrameworkTemplate } from '../lib/customFrameworks'

/** Shared contract for the picker, editable overlays and Board Assistant.
 * IDs describe section meaning; storageKey remains the historical noteAreas key.
 * Bounds are percentages of the frame, matching the rendered writing region.
 */
export type FrameworkSection = FrameworkArea

export interface FrameworkDefinition {
  type: FrameworkType
  label: string
  group: string
  selectable: boolean
  selectionGuidance: string
  sourceRequirements: string
  defaultSize: { width: number; height: number }
  sections: readonly FrameworkSection[]
  legacySections: readonly FrameworkSection[]
}

const section = (
  id: string, storageKey: string, label: string, writingGuidance: string,
  left: number, top: number, width: number, height: number,
): FrameworkSection => ({ id, storageKey, label, writingGuidance, left, top, width, height })

export const FRAMEWORK_REGISTRY: Readonly<Record<BuiltinFrameworkType, FrameworkDefinition>> = {
  'blank': {
    type: 'blank', label: 'Blank', group: '', selectable: false,
    selectionGuidance: 'A neutral group container is not implemented. Creation currently converts blank to Eisenhower.',
    sourceRequirements: 'No assistant action is supported.',
    defaultSize: { width: 640, height: 540 },
    sections: [],
    legacySections: [],
  },
  'eisenhower': {
    type: 'eisenhower', label: 'Eisenhower Matrix', group: '', selectable: true,
    selectionGuidance: 'Prioritize work by urgency and importance.',
    sourceRequirements: 'Use supplied tasks; do not invent urgency, owners or due dates.',
    defaultSize: { width: 640, height: 540 },
    sections: [
      section('do-first', 'top-left', 'Do First', 'Important and urgent tasks requiring immediate attention.', 16, 13, 39, 39),
      section('schedule', 'top-right', 'Schedule', 'Important tasks that are not urgent; propose timing only when unspecified.', 57, 13, 39, 39),
      section('delegate', 'bottom-left', 'Delegate', 'Urgent tasks of lower importance; suggest delegation without inventing an owner.', 16, 55, 39, 39),
      section('eliminate', 'bottom-right', 'Eliminate', 'Low-importance, non-urgent tasks to reconsider; do not delete anything.', 57, 55, 39, 39),
    ],
    legacySections: [],
  },
  'ooda': {
    type: 'ooda', label: 'OODA Loop', group: '', selectable: true,
    selectionGuidance: 'Choose the next action in a changing or uncertain situation.',
    sourceRequirements: 'Separate observed facts, interpretations and proposed actions.',
    defaultSize: { width: 720, height: 220 },
    sections: [
      section('observe', 'observe', 'Observe', 'Record observations and missing evidence.', 2, 23, 22, 68),
      section('orient', 'orient', 'Orient', 'Interpret context and constraints; label assumptions.', 26, 23, 22, 68),
      section('decide', 'decide', 'Decide', 'Propose a choice with its rationale.', 51, 23, 22, 68),
      section('act', 'act', 'Act', 'Describe the next experiment or action and feedback to observe.', 76, 23, 22, 68),
    ],
    legacySections: [],
  },
  'ikigai': {
    type: 'ikigai', label: 'Ikigai', group: 'PERSONAL GROWTH', selectable: true,
    selectionGuidance: 'Explore purpose across interests, skills, needs and income.',
    sourceRequirements: 'Use supplied experiences; never invent interests or capabilities.',
    defaultSize: { width: 520, height: 520 },
    sections: [
      section('love', 'top', 'Love', 'Activities the user explicitly enjoys.', 36, 13, 28, 20),
      section('good-at', 'right', 'Good At', 'Skills supported by supplied experience.', 64, 39, 28, 20),
      section('world-needs', 'bottom', 'World Needs', 'Needs or problems the user wants to serve; label assumptions.', 36, 67, 28, 20),
      section('paid-for', 'left', 'Paid For', 'Potential income opportunities; distinguish possibilities from proven demand.', 8, 39, 28, 20),
      section('purpose', 'center', 'Ikigai', 'Synthesize overlaps as possible directions, not a definitive life purpose.', 36, 39, 28, 20),
    ],
    legacySections: [],
  },
  'wheel-of-life': {
    type: 'wheel-of-life', label: 'Wheel of Life', group: 'PERSONAL GROWTH', selectable: true,
    selectionGuidance: 'Reflect on balance across eight life areas.',
    sourceRequirements: 'Use supplied lived experience and ratings; never infer personal satisfaction or scores.',
    defaultSize: { width: 500, height: 520 },
    sections: [
      section('career', 'career', 'Career', 'Reflect on supplied work experiences and desired changes.', 42, 10, 56, 9),
      section('finance', 'finance', 'Finance', 'Reflect on supplied financial wellbeing; do not invent amounts or offer financial advice.', 42, 21, 56, 9),
      section('health', 'health', 'Health', 'Reflect on supplied wellbeing and habits; do not diagnose.', 42, 32, 56, 9),
      section('family', 'family', 'Family', 'Use only supplied family experiences and aspirations.', 42, 43, 56, 9),
      section('romance', 'romance', 'Romance', 'Use only supplied relationship experiences; leave unknowns open.', 42, 54, 56, 9),
      section('growth', 'growth', 'Growth', 'Describe supplied learning goals and personal development.', 42, 65, 56, 9),
      section('fun', 'fun', 'Fun', 'Describe supplied leisure, enjoyment and desired activities.', 42, 76, 56, 9),
      section('home', 'home', 'Home', 'Reflect on supplied living environment and desired changes.', 42, 87, 56, 9),
    ],
    legacySections: [
      // The old five positional overlays did not identify the eight diagram areas.
      // Keep their contents separate: mapping them to life categories would invent meaning.
      section('legacy-top', 'top', 'Earlier top note', 'Preserve this earlier note; its life category is unspecified. Do not generate new content here.', 36, 13, 28, 20),
      section('legacy-right', 'right', 'Earlier right note', 'Preserve this earlier note; its life category is unspecified. Do not generate new content here.', 64, 39, 28, 20),
      section('legacy-bottom', 'bottom', 'Earlier bottom note', 'Preserve this earlier note; its life category is unspecified. Do not generate new content here.', 36, 67, 28, 20),
      section('legacy-left', 'left', 'Earlier left note', 'Preserve this earlier note; its life category is unspecified. Do not generate new content here.', 8, 39, 28, 20),
      section('legacy-center', 'center', 'Earlier center note', 'Preserve this earlier note; its life category is unspecified. Do not generate new content here.', 36, 39, 28, 20),
    ],
  },
  'grow': {
    type: 'grow', label: 'GROW Model', group: 'PERSONAL GROWTH', selectable: true,
    selectionGuidance: 'Turn a goal into practical next steps through coaching.',
    sourceRequirements: 'Distinguish current facts from desired outcomes and proposed commitments.',
    defaultSize: { width: 640, height: 540 },
    sections: [
      section('goal', 'goal', 'Goal', 'Describe the desired outcome.', 3, 16, 44, 35),
      section('reality', 'reality', 'Reality', 'Describe current conditions and constraints.', 53, 16, 44, 35),
      section('options', 'options', 'Options', 'Propose feasible alternatives with tradeoffs.', 3, 57, 44, 35),
      section('will', 'will', 'Will', 'Propose concrete next steps; do not claim commitment without evidence.', 53, 57, 44, 35),
    ],
    legacySections: [],
  },
  'smart-goals': {
    type: 'smart-goals', label: 'SMART Goals', group: 'PERSONAL GROWTH', selectable: true,
    selectionGuidance: 'Make a goal precise and assessable.',
    sourceRequirements: 'Label invented targets or dates as proposals; preserve known metrics and constraints.',
    defaultSize: { width: 800, height: 220 },
    sections: [
      section('specific', 'specific', 'Specific', 'State a concrete outcome and scope.', 1, 28, 18, 63),
      section('measurable', 'measurable', 'Measurable', 'Define an observable success measure; label proposed targets.', 21, 28, 18, 63),
      section('achievable', 'achievable', 'Achievable', 'Assess available resources and constraints; mark unknown feasibility.', 41, 28, 18, 63),
      section('relevant', 'relevant', 'Relevant', 'Connect the outcome to the stated goal.', 61, 28, 18, 63),
      section('time-bound', 'time-bound', 'Time-bound', 'Use given deadlines or clearly propose a timeframe.', 81, 28, 18, 63),
    ],
    legacySections: [],
  },
  'start-stop-continue': {
    type: 'start-stop-continue', label: 'Start / Stop / Continue', group: 'PERSONAL GROWTH', selectable: true,
    selectionGuidance: 'Review habits or a project and decide what to change.',
    sourceRequirements: 'Base reflections on supplied experience; suggestions are proposals.',
    defaultSize: { width: 720, height: 400 },
    sections: [
      section('start', 'left', 'Start', 'Propose useful new practices.', 2, 23, 29, 70),
      section('stop', 'middle', 'Stop', 'Identify practices to discontinue with supporting reasons.', 35, 23, 29, 70),
      section('continue', 'right', 'Continue', 'Retain practices supported by positive evidence.', 69, 23, 29, 70),
    ],
    legacySections: [],
  },
  'personal-kanban': {
    type: 'personal-kanban', label: 'Personal Kanban', group: 'PERSONAL GROWTH', selectable: true,
    selectionGuidance: 'Track work through To Do, Doing and Done.',
    sourceRequirements: 'Use stated status only; proposed work belongs in To Do, never Done.',
    defaultSize: { width: 720, height: 400 },
    sections: [
      section('todo', 'left', 'To Do', 'List proposed or explicitly unstarted tasks.', 2, 23, 29, 70),
      section('doing', 'middle', 'Doing', 'List only work explicitly in progress.', 35, 23, 29, 70),
      section('done', 'right', 'Done', 'List only work explicitly completed.', 69, 23, 29, 70),
    ],
    legacySections: [],
  },
  'five-whys': {
    type: 'five-whys', label: '5 Whys', group: 'PERSONAL GROWTH', selectable: true,
    selectionGuidance: 'Investigate a problem and possible root causes.',
    sourceRequirements: 'Unsupported causal links remain hypotheses; do not fabricate evidence.',
    defaultSize: { width: 640, height: 380 },
    sections: [
      section('problem', 'problem', 'Problem', 'Describe the observed problem.', 5, 14, 90, 12),
      section('why-1', 'why1', 'Why 1', 'Ask the first cause question; mark unsupported answers as hypotheses.', 12, 29, 82, 9),
      section('why-2', 'why2', 'Why 2', 'Question the preceding cause; retain uncertainty.', 12, 40, 82, 9),
      section('why-3', 'why3', 'Why 3', 'Question the preceding cause; retain uncertainty.', 12, 51, 82, 9),
      section('why-4', 'why4', 'Why 4', 'Question the preceding cause; retain uncertainty.', 12, 62, 82, 9),
      section('why-5', 'why5', 'Why 5', 'Question the preceding cause; retain uncertainty.', 12, 73, 82, 9),
      section('root-cause', 'root', 'Root Cause', 'Summarize supported causes and evidence still needed.', 5, 86, 90, 10),
    ],
    legacySections: [],
  },
  'daily-reflection': {
    type: 'daily-reflection', label: 'Daily Reflection', group: 'PERSONAL GROWTH', selectable: true,
    selectionGuidance: 'Reflect on a day and prepare for the next.',
    sourceRequirements: 'Use supplied experiences; never invent feelings, gratitude or accomplishments.',
    defaultSize: { width: 640, height: 540 },
    sections: [
      section('grateful', 'grateful', 'Grateful For', 'Use stated sources of gratitude.', 4, 13, 92, 15),
      section('focus', 'focus', 'Today Focus', 'Describe stated priorities.', 4, 30, 92, 15),
      section('wins', 'wins', 'Wins', 'Record stated accomplishments.', 4, 47, 92, 15),
      section('lessons', 'lessons', 'Lessons', 'Draw tentative lessons from supplied experiences.', 4, 64, 92, 15),
      section('tomorrow', 'tomorrow', 'Tomorrow', 'Propose next steps without inventing commitments.', 4, 81, 92, 15),
    ],
    legacySections: [],
  },
  'okr': {
    type: 'okr', label: 'OKR', group: 'PERSONAL GROWTH', selectable: true,
    selectionGuidance: 'Connect an objective to measurable outcomes.',
    sourceRequirements: 'Distinguish proposed metrics and targets from agreed results; avoid claiming progress.',
    defaultSize: { width: 640, height: 440 },
    sections: [
      section('objective', 'objective', 'Objective', 'State the qualitative desired outcome.', 4, 16, 92, 24),
      section('key-result-1', 'kr1', 'Key Result 1', 'Propose a measurable outcome, not merely an activity.', 4, 48, 28, 42),
      section('key-result-2', 'kr2', 'Key Result 2', 'Add a distinct measurable outcome.', 36, 48, 28, 42),
      section('key-result-3', 'kr3', 'Key Result 3', 'Add a distinct measurable outcome.', 68, 48, 28, 42),
    ],
    legacySections: [],
  },
  'energy-audit': {
    type: 'energy-audit', label: 'Energy Audit', group: 'PERSONAL GROWTH', selectable: true,
    selectionGuidance: 'Understand activities by energy and stress.',
    sourceRequirements: 'Use supplied energy and stress descriptions; do not infer emotional states or diagnose.',
    defaultSize: { width: 640, height: 540 },
    sections: [
      section('flow', 'top-left', 'Flow', 'Activities described as high energy and low stress.', 16, 13, 39, 39),
      section('stress', 'top-right', 'Stress', 'Activities described as high energy and high stress.', 57, 13, 39, 39),
      section('rest', 'bottom-left', 'Rest', 'Activities described as low energy and low stress.', 16, 55, 39, 39),
      section('burnout', 'bottom-right', 'Burnout', 'Activities described as low energy and high stress; use this diagram category without diagnosis.', 57, 55, 39, 39),
    ],
    legacySections: [],
  },
  'eat-that-frog': {
    type: 'eat-that-frog', label: 'Eat That Frog', group: 'PERSONAL GROWTH', selectable: true,
    selectionGuidance: 'Choose the most important task before other work.',
    sourceRequirements: 'Use stated priorities and tasks; unknown priorities are suggestions.',
    defaultSize: { width: 580, height: 440 },
    sections: [
      section('most-important-task', 'frog1', 'Most Important Task', 'Propose the highest-value task with a reason.', 5, 15, 90, 12),
      section('task-2', 'task2', 'Task 2', 'Add a supporting task in priority order.', 5, 31, 90, 12),
      section('task-3', 'task3', 'Task 3', 'Add a supporting task in priority order.', 5, 47, 90, 12),
      section('task-4', 'task4', 'Task 4', 'Add a supporting task in priority order.', 5, 63, 90, 12),
      section('task-5', 'task5', 'Task 5', 'Add a supporting task in priority order.', 5, 79, 90, 12),
    ],
    legacySections: [],
  },
  'gtd': {
    type: 'gtd', label: 'GTD', group: 'PERSONAL GROWTH', selectable: true,
    selectionGuidance: 'Capture commitments and separate actions from projects.',
    sourceRequirements: 'Do not invent commitments, owners or dependency status.',
    defaultSize: { width: 840, height: 260 },
    sections: [
      section('inbox', 'inbox', 'Inbox', 'Capture unprocessed ideas and commitments.', 1, 29, 18, 62),
      section('next-actions', 'next', 'Next Actions', 'Describe concrete next physical actions.', 21, 29, 18, 62),
      section('projects', 'projects', 'Projects', 'Describe outcomes needing multiple actions.', 41, 29, 18, 62),
      section('waiting-for', 'waiting', 'Waiting For', 'Record only supplied dependencies or clearly proposed handoffs.', 61, 29, 18, 62),
      section('someday', 'someday', 'Someday', 'Record optional future possibilities.', 81, 29, 18, 62),
    ],
    legacySections: [],
  },
  'stp': {
    type: 'stp', label: 'STP Marketing', group: 'MARKETING', selectable: true,
    selectionGuidance: 'Define audience segments, choose targets and position an offer.',
    sourceRequirements: 'Use known audience evidence; label unverified segments and market claims.',
    defaultSize: { width: 720, height: 400 },
    sections: [
      section('segmentation', 'segment', 'Segmentation', 'Describe distinct audience groups and needs.', 3, 24, 29, 66),
      section('targeting', 'target', 'Targeting', 'Choose a segment and explain fit and constraints.', 35, 24, 29, 66),
      section('positioning', 'position', 'Positioning', 'Draft a distinctive promise for that target backed by the supplied offer.', 68, 24, 29, 66),
    ],
    legacySections: [],
  },
  'marketing-mix': {
    type: 'marketing-mix', label: '4P Marketing Mix', group: 'MARKETING', selectable: true,
    selectionGuidance: 'Plan an offer through product, price, place and promotion.',
    sourceRequirements: 'Preserve stated pricing and channel constraints; label proposed offer details.',
    defaultSize: { width: 720, height: 400 },
    sections: [
      section('product', 'product', 'Product', 'Describe the offer and customer benefit.', 4, 16, 42, 35),
      section('price', 'price', 'Price', 'Respect given prices and discount constraints; label proposed pricing.', 54, 16, 42, 35),
      section('place', 'place', 'Place', 'Describe distribution and access channels.', 4, 57, 42, 35),
      section('promotion', 'promotion', 'Promotion', 'Draft messages and tactics suited to the audience and channels.', 54, 57, 42, 35),
    ],
    legacySections: [],
  },
  'aida': {
    type: 'aida', label: 'AIDA Funnel', group: 'MARKETING', selectable: true,
    selectionGuidance: 'Draft messaging that moves from attention to action.',
    sourceRequirements: 'Use the actual offer; do not invent proof, scarcity or results.',
    defaultSize: { width: 560, height: 520 },
    sections: [
      section('attention', 'attention', 'Attention', 'Draft a specific hook relevant to the audience.', 15, 17, 70, 17),
      section('interest', 'interest', 'Interest', 'Explain the offer and its relevance.', 20, 37, 60, 17),
      section('desire', 'desire', 'Desire', 'Describe supported benefits without fabricated proof.', 25, 57, 50, 17),
      section('action', 'action', 'Action', 'Propose a clear feasible call to action.', 31, 77, 38, 15),
    ],
    legacySections: [],
  },
  'swot': {
    type: 'swot', label: 'SWOT Analysis', group: 'MARKETING', selectable: true,
    selectionGuidance: 'Assess internal strengths and weaknesses against external conditions.',
    sourceRequirements: 'Support claims with supplied evidence and label assumptions.',
    defaultSize: { width: 640, height: 540 },
    sections: [
      section('strengths', 'strengths', 'Strengths', 'Internal assets or capabilities.', 4, 16, 42, 35),
      section('weaknesses', 'weaknesses', 'Weaknesses', 'Internal limitations or gaps.', 54, 16, 42, 35),
      section('opportunities', 'opportunities', 'Opportunities', 'External conditions that may help.', 4, 57, 42, 35),
      section('threats', 'threats', 'Threats', 'External conditions that may harm.', 54, 57, 42, 35),
    ],
    legacySections: [],
  },
  'customer-journey': {
    type: 'customer-journey', label: 'Customer Journey', group: 'MARKETING', selectable: true,
    selectionGuidance: 'Plan the experience from discovery through repeat use.',
    sourceRequirements: 'Use supplied customer evidence; distinguish assumptions from observed behavior.',
    defaultSize: { width: 900, height: 360 },
    sections: [
      section('awareness', 'awareness', 'Awareness', 'Describe discovery channels and initial needs.', 1, 29, 18, 61),
      section('consideration', 'consideration', 'Consideration', 'Describe questions, comparisons and evaluation support.', 21, 29, 18, 61),
      section('purchase', 'purchase', 'Purchase', 'Describe conversion steps and friction.', 41, 29, 18, 61),
      section('onboarding', 'onboarding', 'Onboarding', 'Describe first-use support and activation.', 61, 29, 18, 61),
      section('retention', 'retention', 'Retention', 'Describe continued value, repeat use and feedback.', 81, 29, 18, 61),
    ],
    legacySections: [],
  },
  'first-principles': {
    type: 'first-principles', label: 'First Principles', group: 'THINKING', selectable: true,
    selectionGuidance: 'Challenge assumptions and rebuild a solution from facts.',
    sourceRequirements: 'Separate assumptions from verified facts; do not present speculation as truth.',
    defaultSize: { width: 700, height: 440 },
    sections: [
      section('assumptions', 'assumptions', 'Assumptions', 'List beliefs to challenge.', 4, 18, 42, 30),
      section('truths', 'truths', 'Known Truths', 'List facts supported by supplied evidence.', 54, 18, 42, 30),
      section('rebuild', 'rebuild', 'Rebuild', 'Propose a solution derived from supported fundamentals.', 4, 58, 92, 30),
    ],
    legacySections: [],
  },
  'six-thinking-hats': {
    type: 'six-thinking-hats', label: 'Six Thinking Hats', group: 'THINKING', selectable: true,
    selectionGuidance: 'Explore a decision from six distinct perspectives.',
    sourceRequirements: 'Facts require evidence; feelings require supplied experience; ideas are proposals.',
    defaultSize: { width: 780, height: 420 },
    sections: [
      section('facts', 'white', 'Facts', 'List evidence and information gaps.', 2, 28, 14, 58),
      section('feelings', 'red', 'Feelings', 'Use stated feelings or ask reflective questions.', 18, 28, 14, 58),
      section('risks', 'black', 'Risks', 'Describe concrete risks and limitations.', 34, 28, 14, 58),
      section('benefits', 'yellow', 'Benefits', 'Describe plausible benefits with caveats.', 50, 28, 14, 58),
      section('ideas', 'green', 'Ideas', 'Propose alternatives and creative possibilities.', 66, 28, 14, 58),
      section('process', 'blue', 'Process', 'Define the decision process and next steps.', 82, 28, 14, 58),
    ],
    legacySections: [],
  },
  'scamper': {
    type: 'scamper', label: 'SCAMPER', group: 'THINKING', selectable: true,
    selectionGuidance: 'Generate alternatives by modifying an existing idea.',
    sourceRequirements: 'Ground variations in the described idea; label each variation as proposed.',
    defaultSize: { width: 880, height: 360 },
    sections: [
      section('substitute', 'substitute', 'Substitute', 'Propose replacing a component.', 1, 30, 13, 60),
      section('combine', 'combine', 'Combine', 'Propose useful combinations.', 15, 30, 13, 60),
      section('adapt', 'adapt', 'Adapt', 'Adapt a useful pattern to the goal.', 29, 30, 13, 60),
      section('modify', 'modify', 'Modify', 'Change size, emphasis or properties.', 43, 30, 13, 60),
      section('put-to-use', 'put', 'Put to Use', 'Propose another use or audience.', 57, 30, 13, 60),
      section('eliminate', 'eliminate', 'Eliminate', 'Propose removing unnecessary parts.', 71, 30, 13, 60),
      section('reverse', 'reverse', 'Reverse', 'Reorder or reverse a process or assumption.', 85, 30, 13, 60),
    ],
    legacySections: [],
  },
  'pros-cons': {
    type: 'pros-cons', label: 'Pros / Cons', group: 'THINKING', selectable: true,
    selectionGuidance: 'Compare reasons for and against a specific option.',
    sourceRequirements: 'Keep both sides tied to the same option; label uncertain effects.',
    defaultSize: { width: 640, height: 400 },
    sections: [
      section('pros', 'pros', 'Pros', 'Describe potential advantages.', 4, 22, 42, 68),
      section('cons', 'cons', 'Cons', 'Describe potential disadvantages.', 54, 22, 42, 68),
    ],
    legacySections: [],
  },
  'impact-effort': {
    type: 'impact-effort', label: 'Impact / Effort Matrix', group: 'THINKING', selectable: true,
    selectionGuidance: 'Prioritize options by expected impact and effort.',
    sourceRequirements: 'Use supplied estimates or label inferred placement as proposed.',
    defaultSize: { width: 640, height: 540 },
    sections: [
      section('quick-wins', 'quick-wins', 'Quick Wins', 'High-impact, low-effort options.', 16, 13, 39, 39),
      section('major-projects', 'major-projects', 'Major Projects', 'High-impact, high-effort options.', 57, 13, 39, 39),
      section('fill-ins', 'fill-ins', 'Fill-ins', 'Low-impact, low-effort options.', 16, 55, 39, 39),
      section('time-sinks', 'time-sinks', 'Time Sinks', 'Low-impact, high-effort options to reconsider.', 57, 55, 39, 39),
    ],
    legacySections: [],
  },
}

export const VALID_TYPES = Object.keys(FRAMEWORK_REGISTRY) as BuiltinFrameworkType[]
export const DEFAULTS = Object.fromEntries(VALID_TYPES.map(type =>
  [type, FRAMEWORK_REGISTRY[type].defaultSize],
)) as Record<BuiltinFrameworkType, { width: number; height: number }>
export const FRAMEWORK_LABELS = Object.fromEntries(VALID_TYPES.map(type =>
  [type, FRAMEWORK_REGISTRY[type].label],
)) as Record<BuiltinFrameworkType, string>

export type FrameworkGroupEntry = { sep: string } | { key: BuiltinFrameworkType }
export const FRAMEWORK_GROUPS: FrameworkGroupEntry[] = []
let previousGroup = ''
for (const type of VALID_TYPES) {
  const definition = FRAMEWORK_REGISTRY[type]
  if (!definition.selectable) continue
  if (definition.group !== previousGroup && definition.group) {
    FRAMEWORK_GROUPS.push({ sep: definition.group })
  }
  FRAMEWORK_GROUPS.push({ key: type })
  previousGroup = definition.group
}

/** Blank is retained for stored boards, but is not an assistant creation action. */
export function getFrameworkDefinition(type: string, customFramework?: CustomFrameworkTemplate): FrameworkDefinition | undefined {
  if (Object.prototype.hasOwnProperty.call(FRAMEWORK_REGISTRY, type)) return FRAMEWORK_REGISTRY[type as BuiltinFrameworkType]
  const validCustom = validateCustomFrameworkTemplate(customFramework)
  if (!validCustom || frameworkTypeFor(validCustom) !== type) return undefined
  return {
    type: type as FrameworkType,
    label: validCustom.label,
    group: 'MY FRAMEWORKS',
    selectable: true,
    selectionGuidance: validCustom.purpose,
    sourceRequirements: 'Use supplied board material; label unsupported details as assumptions or questions.',
    defaultSize: validCustom.defaultSize,
    sections: validCustom.sections,
    legacySections: [],
  }
}

export function getFrameworkLabel(type: string, customFramework?: CustomFrameworkTemplate): string {
  return getFrameworkDefinition(type, customFramework)?.label ?? 'Framework'
}

/** Accept semantic IDs and historical noteAreas keys, scoped to the frame type. */
export function resolveFrameworkSection(type: string, sectionId: string, customFramework?: CustomFrameworkTemplate): FrameworkSection | undefined {
  const definition = getFrameworkDefinition(type, customFramework)
  return definition && [...definition.sections, ...definition.legacySections]
    .find(section => section.id === sectionId || section.storageKey === sectionId)
}

/** Returns undefined for unknown sections. Existing empty strings are authoritative. */
export function getFrameworkSectionNotes(frame: FrameInstance, sectionId: string): string | undefined {
  const section = resolveFrameworkSection(frame.type, sectionId, frame.customFramework)
  if (!section) return undefined
  return frame.noteAreas?.[section.storageKey] ?? frame.noteAreas?.[section.id] ?? ''
}

/** Preserve unknown and legacy keys; write supported sections to their historical key. */
export function setFrameworkSectionNotes(frame: FrameInstance, sectionId: string, notes: string): FrameInstance {
  const section = resolveFrameworkSection(frame.type, sectionId, frame.customFramework)
  if (!section) return frame
  return { ...frame, noteAreas: { ...frame.noteAreas, [section.storageKey]: notes } }
}

function framesKey(boardId: string) { return `ideaboard_frames_${boardId}` }
function oldKey(boardId: string)    { return `ideaboard_framework_${boardId}` }

function save(boardId: string, frames: FrameInstance[]) {
  localStorage.setItem(framesKey(boardId), JSON.stringify(frames))
}

export function parseFrameInstances(
  newRaw: string | null,
  oldRaw: string | null,
): FrameInstance[] {
  if (newRaw) {
    try {
      const parsed = JSON.parse(newRaw)
      if (Array.isArray(parsed)) return parsed.flatMap((value): FrameInstance[] => {
        if (!value || typeof value !== 'object') return []
        const frame = value as Record<string, unknown>
        if (typeof frame.id !== 'string' || typeof frame.type !== 'string' ||
            ![frame.x, frame.y, frame.width, frame.height].every(item => typeof item === 'number' && Number.isFinite(item))) return []
        if (VALID_TYPES.includes(frame.type as BuiltinFrameworkType)) return [frame as unknown as FrameInstance]
        const customFramework = validateCustomFrameworkTemplate(frame.customFramework)
        if (!customFramework || frameworkTypeFor(customFramework) !== frame.type) return []
        return [{ ...frame, customFramework } as unknown as FrameInstance]
      })
    } catch { /* fall through */ }
  }
  if (oldRaw) {
    try {
      const old = JSON.parse(oldRaw) as Record<string, unknown>
      const type: BuiltinFrameworkType = VALID_TYPES.includes(old['type'] as BuiltinFrameworkType)
        ? (old['type'] as BuiltinFrameworkType)
        : 'eisenhower'
      if (type === 'blank') return []
      const def = DEFAULTS[type]
      return [{
        id: crypto.randomUUID(),
        type,
        x: 60,
        y: 40,
        width:  typeof old['width']  === 'number' ? old['width']  : def.width,
        height: typeof old['height'] === 'number' ? old['height'] : def.height,
        ...(typeof old['notes'] === 'string' ? { notes: old['notes'] } : {}),
        ...(old['noteAreas'] && typeof old['noteAreas'] === 'object' && !Array.isArray(old['noteAreas'])
          ? { noteAreas: Object.fromEntries(Object.entries(old['noteAreas']).filter(([, value]) => typeof value === 'string')) as Record<string, string> }
          : {}),
      }]
    } catch { /* fall through */ }
  }
  return []
}

export function useFrames(boardId: string) {
  const [frames, setFrames] = useState<FrameInstance[]>(() =>
    parseFrameInstances(
      localStorage.getItem(framesKey(boardId)),
      localStorage.getItem(oldKey(boardId)),
    )
  )

  const addFrame = useCallback((
    type: BuiltinFrameworkType,
    viewportCx: number,
    viewportCy: number,
    zoom: number,
    panX: number,
    panY: number,
  ): FrameInstance => {
    const t = type === 'blank' ? 'eisenhower' : type
    const { width, height } = DEFAULTS[t]
    const x = (viewportCx - panX) / zoom - width / 2
    const y = (viewportCy - panY) / zoom - height / 2
    const frame: FrameInstance = { id: crypto.randomUUID(), type: t, x, y, width, height }
    setFrames(prev => { const next = [...prev, frame]; save(boardId, next); return next })
    return frame
  }, [boardId])

  const addCustomFrame = useCallback((
    customFramework: CustomFrameworkTemplate,
    viewportCx: number,
    viewportCy: number,
    zoom: number,
    panX: number,
    panY: number,
  ): FrameInstance => {
    const validCustom = validateCustomFrameworkTemplate(customFramework)
    if (!validCustom) throw new Error('This saved framework is incomplete.')
    const { width, height } = validCustom.defaultSize
    const frame: FrameInstance = {
      id: crypto.randomUUID(),
      type: frameworkTypeFor(validCustom),
      customFramework: validCustom,
      x: (viewportCx - panX) / zoom - width / 2,
      y: (viewportCy - panY) / zoom - height / 2,
      width,
      height,
    }
    setFrames(prev => { const next = [...prev, frame]; save(boardId, next); return next })
    return frame
  }, [boardId])

  const moveFrame = useCallback((id: string, x: number, y: number) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, x, y } : f))
  }, [])

  const commitFrameMove = useCallback((id: string, x: number, y: number) => {
    setFrames(prev => {
      const next = prev.map(f => f.id === id ? { ...f, x, y } : f)
      save(boardId, next)
      return next
    })
  }, [boardId])

  const setFrameSize = useCallback((id: string, width: number, height: number) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, width, height } : f))
  }, [])

  const commitFrameResize = useCallback((id: string, width: number, height: number) => {
    setFrames(prev => {
      const next = prev.map(f => f.id === id ? { ...f, width, height } : f)
      save(boardId, next)
      return next
    })
  }, [boardId])

  const changeFrameType = useCallback((id: string, type: BuiltinFrameworkType) => {
    const t = type === 'blank' ? 'eisenhower' : type
    setFrames(prev => {
      const { width, height } = DEFAULTS[t]
      const next = prev.map(f => f.id === id ? { ...f, type: t, customFramework: undefined, width, height } : f)
      save(boardId, next)
      return next
    })
  }, [boardId])

  const renameFrame = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    setFrames(prev => {
      const next = prev.map(f =>
        f.id === id ? { ...f, name: trimmed || undefined } : f
      )
      save(boardId, next)
      return next
    })
  }, [boardId])

  const updateFrameNotes = useCallback((id: string, notes: string) => {
    setFrames(prev => {
      const next = prev.map(f => f.id === id ? { ...f, notes } : f)
      save(boardId, next)
      return next
    })
  }, [boardId])

  const updateFrameNoteArea = useCallback((id: string, areaId: string, notes: string) => {
    setFrames(prev => {
      const next = prev.map(f => f.id === id
        ? setFrameworkSectionNotes(f, areaId, notes)
        : f
      )
      save(boardId, next)
      return next
    })
  }, [boardId])

  const deleteFrame = useCallback((id: string) => {
    setFrames(prev => {
      const next = prev.filter(f => f.id !== id)
      save(boardId, next)
      return next
    })
  }, [boardId])

  const importFrames = useCallback((imported: FrameInstance[]) => {
    if (!imported.length) return
    setFrames(prev => {
      const next = [...prev, ...imported]
      save(boardId, next)
      return next
    })
  }, [boardId])

  return { frames, addFrame, addCustomFrame, moveFrame, commitFrameMove, setFrameSize, commitFrameResize, changeFrameType, renameFrame, updateFrameNotes, updateFrameNoteArea, deleteFrame, importFrames }
}
