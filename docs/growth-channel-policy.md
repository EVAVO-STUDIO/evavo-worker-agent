# Growth channel policy

Growth Autonomy actions are governed by channel class. The same draft may be acceptable on one channel and blocked on another.

## Shared policy

All channels inherit these rules:

- no hidden-human mode
- no fake neutral recommendations
- no repeated templates
- no hidden promotional links
- no CAPTCHA or access-control bypass
- no public execution without audit logging
- if rules are unclear, save intelligence and do not execute
- if budget state is unknown, pause execution

## Channel classes

### owned

EVAVO-controlled channels such as EVAVO blog, EVAVO site pages, EVAVO-owned social accounts, and opted-in EVAVO newsletters.

Default mode: `owned_channel_autopilot`

Allowed:

- blog drafts
- social post drafts
- scheduled EVAVO posts under configured cadence
- landing-page ideas
- case-study snippets
- service pages

Rules:

- EVAVO identity is inherent.
- Links are allowed.
- Draft quality and cadence still matter.
- Track traffic and engagement outcomes.

Risk: low.

### provider_expected

Directories, marketplaces, vendor databases, agency lists, supplier directories, or threads/pages where provider listings are expected.

Default mode: `approved_autopilot`

Allowed:

- directory profile drafts
- provider listing submissions
- service category selection
- EVAVO profile updates

Rules:

- EVAVO identity must be explicit.
- Duplicates must be prevented.
- Submission proof must be stored.
- Channel terms and listing rules must be checked where available.

Risk: low to medium.

### direct

Business email, contact forms, public procurement contacts, warm contacts, and inbound/permissioned follow-ups.

Default mode: `assist`

Allowed:

- contact-path discovery
- contact-form drafts
- email drafts
- approved low-volume sends/submissions

Rules:

- Use a real trigger or observation.
- Identify EVAVO clearly.
- Respect consent, unsubscribe, and do-not-contact rules.
- No harvested-email blasts.
- No CAPTCHA bypass.
- No repeated form submissions.

Risk: medium.

### community

Reddit, forums, YouTube comments, niche groups, product/startup communities, and similar public discussion spaces.

Default mode: `assist`

Allowed:

- read-only discovery
- channel rules memory
- no-link helpful reply drafts
- transparent-affiliation drafts when EVAVO is relevant
- approval-gated posting when allowed

Rules:

- Reply only to real context, questions, requests for help, or provider-welcome threads.
- No mass posting.
- No repeated templates.
- No fake neutral recommendations.
- No link by default.
- Links require channel permission and a clear reason.
- If the reply is promotional or EVAVO-linked, affiliation must be clear enough for the context.

Risk: high.

### procurement

Tenders, grants, supplier panels, government procurement, private procurement portals, and formal proposal pathways.

Default mode: `draft`

Allowed:

- opportunity extraction
- eligibility checks
- required-document extraction
- response angle drafts
- clarification-question drafts
- proposal outline drafts

Rules:

- No formal submission without review.
- Do not fabricate eligibility, experience, pricing, or credentials.
- Track deadlines and required documents.
- Store source evidence.

Risk: medium.

### blocked

Any channel where rules are unclear, hostile to provider engagement, private/gated, rate-limit sensitive, or reputationally risky.

Default mode: `blocked`

Allowed:

- save public intelligence if useful
- mark blocked reason
- revisit after manual review

Blocked:

- drafting
- sending
- posting
- form submission

Risk: blocked.

## Link policy

### allowed

Links can be used when accurate and useful.

### contextual

Links are allowed only when the user/channel context makes them useful.

### approval_required

Links must be reviewed before execution.

### blocked

No links.

## Disclosure policy

### not_required

EVAVO identity is already clear or not relevant.

### recommended

Use light EVAVO context when it helps credibility.

### required_when_promotional

If EVAVO, EVAVO services, or an EVAVO link is included, the relationship must be clear.

### always_required

EVAVO identity must be explicit.

## Execution policy

### auto_allowed

Action can execute autonomously only if all gates pass and caps allow it.

### confirm_required

Action must be approved before execution.

### owned_only

Action can execute only on EVAVO-owned channels.

### blocked

Action cannot execute.

## Channel memory

Each channel record should eventually store:

- platform
- URL
- name
- channel class
- link policy
- self-promo policy
- disclosure policy
- allowed action types
- automation mode
- max actions per day/week
- last action time
- cooldown until
- positive outcome count
- negative outcome count
- removal count
- notes and rule evidence

## Cooldowns

The agent must rest a channel when:

- a post is removed
- a reply is negative
- a moderation warning appears
- action volume approaches cap
- repeated drafts are rejected
- outcomes are poor over several runs

Cooldowns should reduce budget before they increase it.
