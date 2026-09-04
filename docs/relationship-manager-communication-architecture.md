# EVAVO Relationship Manager communication architecture

This document defines the cross-repository architecture for email and other relationship communications.

The objective is a staff-like system that can understand correspondence, determine what EVAVO should do, prepare excellent communications, verify them rigorously, learn from outcomes and eventually execute narrowly authorised actions without turning one model response into an unchecked business action.

## Core separation

```text
understand -> decide -> write -> verify -> authorise -> execute -> observe outcome -> learn
```

These stages must remain separable.

A language model that drafts a message must not be the only component deciding whether that message is appropriate, factually supported, correctly addressed or authorised to send.

## Canonical owners

### Relationship Manager / Worker Agent

Owns:

- relationship and account judgement
- communication need detection
- reply / no-reply / defer / escalate decision
- obligation and commitment interpretation
- relationship risk interpretation
- evidence selection
- decision confidence
- communication objective
- prohibited claims and commitments
- required response points
- approval requirement
- outcome and relationship-decision learning

Does not own:

- canonical prose style
- voice-profile learning
- provider-specific prompt execution
- final writing quality ranking
- canonical project / proposal / invoice state
- canonical email or calendar records

### Writing Studio

Canonical owner of reusable writing intelligence.

Owns:

- voice and identity profiles
- communication judgement profiles
- fact-pack construction
- source/fact validation for writing
- email planning
- provider-independent candidate generation
- natural-language quality
- candidate ranking
- refinement
- authenticity and anti-generic checks
- approved-edit writing-style learning

Relationship Manager hands Writing Studio a versioned decision/evidence package. Writing Studio must not independently invent business context that the handoff did not authorise.

Canonical handoff receiver contract:

```text
evavo-staff-communication-handoff-v1
schema: evavo-writing/staff-communication-handoff
owner: EVAVO-STUDIO/evavo-writing-studio
```

The Writing Studio compiler converts the handoff into canonical `WritingRequestV1` rather than creating a parallel email-writing runtime.

### Operations Core

Owns canonical business state including:

```text
leads
clients
briefs
proposals
estimates
scopes
work orders
invoices
documents
projects
delivery status
```

Relationship Manager may derive decisions from these records but must not duplicate them as its own source of truth.

### Gmail

Owns actual mail/thread state:

```text
message ids
thread membership
sender / recipients
sent and received timestamps
headers
mail body
attachment metadata
reply history
```

A relationship summary is not authoritative for what an email literally said when the original Gmail thread is available.

### Calendar

Owns confirmed calendar state and availability.

The Relationship Manager must not promise a meeting time from memory if Calendar can verify it.

### Docs Suite

Owns canonical document/project document state where applicable.

A message claiming that a file is attached or current must resolve the intended artifact identity before execution.

### Support Agent

Owns canonical support-specific conversation, ticket, risk and support-event context.

Its provenance-aware context packs and emotion-risk signals should be consumed rather than reimplemented.

## Communication context pack

Before deciding what to do with a meaningful communication, assemble a bounded context pack.

The pack should distinguish facts by canonical owner and freshness.

Suggested sections:

```text
current thread
participant identities
relationship snapshot
open EVAVO commitments
counterparty commitments
project state
proposal / commercial state
invoice state when relevant
document state
calendar state when relevant
support state when relevant
previous promises and constraints
suppression / contact policy
relationship health
recent communication decisions
```

Do not dump every available record into an LLM. Select only evidence relevant to the current decision and keep provenance.

## Mail interpretation

The system should reason about the full conversational act, not just classify sentiment.

For each incoming message identify:

```text
what happened
what changed since the prior message
what the sender explicitly asked
what the sender implicitly needs
what they did not ask
who owes the next action
questions requiring answers
commitments created
commitments changed or satisfied
dates / deadlines / meeting proposals
requested files or deliverables
commercial implications
relationship implications
risk / frustration / confusion
whether a reply is useful
whether a reply now is useful
```

A reply should not be generated just because an email arrived.

## Decision stage

Relationship Manager chooses among at least:

```text
reply
acknowledge
follow_up
do_not_reply
defer
escalate
```

The decision must include evidence, uncertainty and confidence.

Examples where no immediate email may be correct:

- FYI-only update with no action requested
- automated notification
- reply would merely repeat the previous message
- required project evidence is not yet available
- another EVAVO person clearly owns the response
- sensitive disagreement needs internal resolution first
- sender identity or requested action is uncertain

## Obligation ledger

Email understanding should feed a durable obligation model instead of treating every thread as prose.

Each obligation should identify:

```text
owner
statement
created-from evidence
due date if evidenced
status
satisfaction evidence
superseding evidence
relationship / project linkage
```

Examples:

```text
EVAVO owes revised scope
client owes approval
EVAVO owes answer to question 2
shared action: agree meeting time
supplier owes certificate
```

This allows the Relationship Manager to know who owes the next move without rereading all historical prose on every run.

## Writing handoff

Only draftable decisions become a Writing Studio handoff.

The handoff contains:

```text
verified participants
thread summary
relationship summary
decision and objective
obligations
attachment expectations
provenance-backed evidence
must-answer items
must-include items
must-avoid items
prohibited claims
prohibited commitments
unresolved questions
tone guidance
word limit
risk policy
```

Writing Studio remains responsible for turning this into natural language.

## Human-like communication

Human-like does not mean imitating mistakes.

It means:

- responding to what the person actually said
- understanding the relationship
- knowing what has already been said
- remembering prior commitments
- matching the level of warmth and formality to the situation
- using concise language when the task is simple
- giving enough detail when the situation genuinely needs it
- varying openings and closings naturally
- avoiding generic filler
- not overexplaining obvious things
- not pretending certainty
- not using sales language in operational conversations
- not sounding like a template
- understanding when silence is appropriate

Writing Studio is the canonical place for these language behaviours.

## Independent pre-send verification

Before any future send, verification must occur after drafting.

At minimum verify:

### Identity

- correct sender identity
- correct To recipients
- correct Cc recipients
- no accidental Bcc
- reply belongs to the intended thread
- no similarly named wrong person

### Factual integrity

- dates match authoritative sources
- amounts match commercial records
- project status is current
- file/version references are current
- claims have usable evidence
- uncertainty has not become a confident assertion

### Commitment integrity

- no unapproved scope promise
- no unapproved delivery date
- no unapproved pricing or discount
- no legal / contractual promise outside authority
- no invented meeting availability

### Completeness

- every material question is answered or consciously deferred
- requested actions are acknowledged
- required attachments are present
- actual attachment identities match the text

### Relationship quality

- tone fits the relationship and situation
- unresolved complaint/risk has not been ignored
- reply does not reopen a resolved issue unnecessarily
- no inappropriate sales push
- no needless response

### Writing quality

- natural rather than generic
- no placeholders
- no contradictory sentences
- no unnecessary repetition
- appropriate length
- no fake urgency
- no unsupported absolutes or guarantees

## Execution authority

Communication authority should not be one global send toggle.

Suggested eventual classes:

### C0 - observe

Read and analyse only.

### C1 - prepare

May create internal communication decisions, handoffs and drafts.

### C2 - operator-approved send

May execute an exact reviewed message after explicit approval. It may not regenerate or change the approved message at send time.

### C3 - narrow autonomous communication

Future only. Low-risk, repetitive and explicitly authorised categories may send without per-message approval if all independent verification gates pass.

Examples might eventually include narrowly defined acknowledgements or status notices, but only after real outcome evidence demonstrates reliable performance.

### C4 - consequential communication

Binding commitments, complaints with material exposure, legal/commercial negotiations, pricing changes, scope changes, sensitive personnel matters and other high-impact communications remain governed even if lower classes become autonomous.

## Exact-send rule

When a message is approved, execution should use the exact approved subject, body, recipients and attachment identities.

Do not allow the model to "improve" or regenerate approved copy during the send operation.

The approval should bind hashes/identities for:

```text
subject
body
To
Cc
Bcc
thread / reply target
attachments
sender identity
```

Any material change invalidates the approval and sends the message back through verification.

## Outcome learning

Separate two types of learning.

### Writing learning

Canonical owner: Writing Studio.

Examples:

```text
too formal
too long
bad opening
voice mismatch
phrase preference
sentence rhythm
closing preference
```

These may affect approved writing/voice profiles only through Writing Studio's governed learning system.

### Relationship-decision learning

Canonical owner: Relationship Manager.

Examples:

```text
reply was unnecessary
wrong person should have owned response
missed business question
follow-up timing was poor
relationship risk was underestimated
escalation was unnecessary
chosen next action worked / failed
commitment interpretation was incorrect
```

`business_communication_learning_v1` in Worker Agent is explicitly relationship-decision feedback only and may not mutate a Writing Studio voice profile.

## Evaluation

Do not evaluate the system primarily on whether a draft sounds good.

Use scenario tests that grade the whole decision.

Examples:

### Routine client reply

Did it answer all questions, use current project state, avoid unnecessary fluff and attach the correct file?

### Angry client

Did it identify the issue, avoid defensiveness, avoid invented promises and escalate when appropriate?

### Commercial negotiation

Did it detect a requested commitment outside authority rather than drafting acceptance?

### Scheduling

Did it verify actual availability rather than infer it from thread text?

### Ambiguous sender

Did it stop before addressing or sending to an unverified identity?

### Attachment request

Did it bind the exact current artifact rather than merely write "attached"?

### FYI email

Did it correctly choose no reply when a reply would add no value?

### Multi-question thread

Did it answer each still-open question while avoiding repetition of already answered points?

## Metrics worth tracking

```text
wrong-recipient rate
missed-question rate
unsupported-claim rate
incorrect-commitment rate
wrong-attachment rate
unnecessary-reply rate
human edit distance by reason
approval rejection rate
escalation precision
follow-up timing quality
relationship outcome after action
confidence calibration
```

Message volume is not a success metric.

## Next implementation sequence

1. Use `evavo-staff-communication-handoff-v1` as the canonical Worker -> Writing Studio drafting boundary.
2. Make Worker communication-learning metadata non-authoritative for prose/voice learning.
3. Add a durable obligation ledger with evidence references.
4. Add canonical Gmail thread context adapter.
5. Add Operations Core project/commercial context adapter.
6. Add Calendar verification adapter for scheduling claims.
7. Add Docs Suite attachment/document resolver.
8. Consume Support Agent context packs for relevant support relationships.
9. Build exact pre-send approval envelope with subject/body/recipient/attachment hashes.
10. Add cross-system scenario evaluation fixtures before enabling any new external execution tier.

## Current posture

External mail sending remains disabled in the active Worker runtime.

This is intentional while judgement, context assembly, handoff quality and independent verification are being made reliable. The architecture is designed so execution can later become more capable without allowing the writing model itself to become the authority for business decisions or sending.
