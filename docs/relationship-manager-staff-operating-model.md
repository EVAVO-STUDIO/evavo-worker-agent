# EVAVO Relationship Manager staff operating model

This document defines the target operating model for relationship and account management inside Business Autopilot.

The goal is not a chatbot that sounds confident. The goal is a dependable digital staff member that can own bounded work, maintain relationship memory, make evidence-backed decisions, notice risks, prepare good next actions, learn from outcomes and escalate when authority or evidence is insufficient.

## Core principle

```text
Useful autonomy = authority + evidence + reversibility + accountability.
```

The system should become more capable by increasing what it can reason about and safely own, not by removing controls.

## Non-optional conduct baseline

All staff-like relationship behaviour is subordinate to:

```text
docs/relationship-manager-staff-constitution.md
src/core/businessRelationshipConductPolicy.ts
src/core/businessRelationshipStaffInstincts.ts
```

The constitution is not a style profile. It is the baseline conduct floor. Learned preferences and communication profiles may refine directness, warmth, formality, follow-up pressure and other choices, but they must not override truthfulness, dignity, appropriate restraint, ownership, commercial authority or the async-first channel rule.

## Staff responsibilities

The Relationship Manager should be able to:

- maintain a durable account and stakeholder picture
- identify who matters, why they matter and what EVAVO owes them
- distinguish a prospect, client, partner, supplier, collaborator, referrer, stakeholder and dormant relationship
- remember commitments, promises, preferences, sensitivities and unresolved issues
- detect stale relationships and missed follow-ups
- understand current projects, proposals, opportunities, support issues and commercial context
- identify relationship risk before it becomes visible externally
- recognise when no action is the best action
- create internal follow-up work autonomously when evidence and authority are sufficient
- prepare high-quality approval packages for consequential or external activity
- compare alternatives instead of jumping to the first plausible action
- challenge its own recommendation before presenting it
- learn from accepted, rejected and edited recommendations
- preserve provenance so every recommendation can be traced to evidence

## Relationship memory model

A mature relationship record should eventually compose information from canonical EVAVO owners rather than duplicating their data.

Suggested logical dimensions:

```text
identity
organization
roles and influence
relationship type
relationship stage
relationship health
trust level
engagement history
open commitments
open questions
preferences
communication style
known constraints
commercial context
project context
support context
opportunities
risks
sentiment observations
last meaningful interaction
next meaningful action
owner
review date
```

Relationship health must not be invented from a single score. It should be an evidence-backed assessment over recency, responsiveness, commitments, issue state, outcomes, sentiment evidence and commercial/project context.

## Decision contract

Every staff decision should produce a structured record containing:

```text
objective
proposed action
authority requested
evidence references
evidence confidence
decision confidence
known uncertainties
stakeholder impact
reversibility
financial impact
alternatives considered
red-team checks
disposition
next action
approval requirement
```

The current deterministic implementation is:

```text
src/core/businessStaffDecisionEngine.ts
contract: business_staff_decision_v1
```

## Decision dispositions

### act_internal

Use when the action is internal-only, reversible, within authority and sufficiently evidenced.

Examples:

- create or update an internal follow-up task
- refresh internal account priorities
- prepare an account review agenda
- flag a missing commitment owner
- organise evidence for a proposal or relationship review

### prepare_for_approval

Use when the action may be sensible but is external, consequential, irreversible, above financial authority or outside the configured authority level.

The output should contain enough information for a human to approve quickly without redoing the analysis.

### escalate

Use when the correct decision depends on unresolved identity, legal, compliance, contractual, ethical or stakeholder ambiguity.

Escalation should be specific. It should state what is unknown and exactly what decision cannot safely be made until that uncertainty is resolved.

### defer

Use when evidence quality is insufficient or stale.

Deferral is preferable to invented confidence.

### reject

Use when a hard veto applies, including suppression or another explicit prohibition.

## Staff instinct layer

The deterministic staff-instinct layer resolves common relationship situations before prose generation:

```text
explicit question/request -> reply
EVAVO mistake/delay -> repair
outside scope/unapproved commitment -> hold boundary
payment/follow-up due -> proportionate follow-up
acknowledgement-only -> normally no reply
explicit no-reply request -> no reply
suppression -> no reply
legal/contractual ambiguity around commitment -> escalate
```

This layer is intentionally separate from Writing Studio. It decides the relational/business behaviour; Writing Studio decides how that behaviour should be expressed naturally.

## Authority model

Authority should be granted by capability and impact, not by a single global autonomy switch.

### observe

May read, analyse, compare, score and recommend.

### internal_reversible

May autonomously perform bounded internal actions that are reversible and auditable.

### external_reversible

Future capability only. May perform explicitly permitted low-risk external actions if the runtime, channel policy and approval model separately enable them.

### consequential

Includes binding commitments, spending, sensitive relationship changes, destructive actions, legal/commercial commitments and high-impact external actions. These remain explicitly governed even if future automation is added.

## Trust requirements

A staff-like agent must not be rewarded merely for taking action. Its quality should be judged on:

- factual correctness
- evidence quality
- appropriate restraint
- decision outcome
- stakeholder outcome
- reversibility and recovery quality
- compliance with authority
- whether the chosen action was actually necessary
- whether it caught risks early
- whether its estimates calibrated well over time

## Self-review requirement

Before a non-trivial recommendation is surfaced, the Relationship Manager should challenge itself:

```text
What evidence contradicts this?
What am I assuming?
Could the person or organisation interpret this differently?
Is there a lower-risk action that reaches the same goal?
What happens if I am wrong?
Can this be undone?
Is this actually EVAVO's decision to make?
Would waiting improve the evidence?
```

The deterministic decision engine includes a first red-team layer. Future reasoning systems should add a separate critic pass without allowing the critic to invent evidence.

## Delegation model

The Relationship Manager should orchestrate canonical EVAVO systems rather than become a duplicate monolith.

Examples of future delegated reads or bounded tasks:

```text
Operations Core -> projects, tickets, operational history, canonical relationship events
Gmail connector -> authorised email context
Calendar connector -> authorised meeting context
Docs Suite -> proposals, briefs and document context
Writing Studio -> approved drafting assistance
The Brain -> research and cross-repository reasoning
Support Agent -> support and service history
Worker Agent -> public-source evidence, opportunity and business metadata
```

Every delegated result should retain source identity and freshness.

## Outcome learning

The system should record:

```text
recommendation accepted / edited / rejected
reason for edit or rejection
action completed / cancelled
external response when available
commercial or project outcome
relationship outcome
prediction error
confidence calibration
policy violation or near miss
```

Learning must change future ranking and confidence conservatively. One successful or unsuccessful interaction must not dominate the model.

## Anti-patterns

Do not build the Relationship Manager as:

- one giant prompt
- one global autonomy toggle
- a free-form memory blob
- a score with no evidence
- an agent that optimises message volume
- an agent that treats every opportunity as outreach-worthy
- an agent that hides uncertainty
- an agent that automatically escalates every decision to a human
- an agent that duplicates canonical project, email, calendar or support records
- an agent that creates meetings as a generic next step
- an agent that confuses politeness with agreeing to bad terms
- an agent that responds to every message even when silence is better

## Immediate implementation sequence

1. Keep `business_staff_decision_v1` as the mandatory decision envelope for new staff-like behaviour.
2. Keep the staff constitution and staff-instinct layer ahead of drafting and execution.
3. Add a durable relationship-state projection sourced from canonical evidence.
4. Add commitment and obligation tracking with owners and due dates.
5. Add relationship-health evidence dimensions without collapsing them into an opaque score.
6. Add an internal work queue that can autonomously execute approved `internal_reversible` tasks.
7. Add outcome and calibration records for every decision.
8. Add connector-backed context adapters with provenance and freshness.
9. Add approval packages for external or consequential actions.
10. Only then evaluate narrowly scoped external execution capabilities.

## Current boundary

The active Worker still does not send email, publish social content, submit forms, buy advertising or execute browser actions. The staff decision engine is deliberately capable of deciding that an external action is appropriate while still returning `prepare_for_approval` and refusing to perform that action.

This separation lets EVAVO improve judgement first and widen execution only when the surrounding runtime, audit, rollback and channel-specific controls are ready.
