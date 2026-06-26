# Growth engagement action model

The Growth Autonomy Agent must treat every possible action as a typed, scored, policy-governed object.

No action should execute just because a draft exists.

## Action lifecycle

1. `discovered`
2. `scored`
3. `drafted`
4. `queued`
5. `approved`
6. `executed`
7. `outcome_recorded`
8. `learned`

Blocked or rejected actions should keep their reason for future learning.

## Action types

### save_signal

Save the signal and evidence only.

Execution risk: low.

Allowed in observe mode.

### draft_email

Prepare an email draft from a specific business trigger or permitted contact context.

Execution risk: medium.

Execution requires direct-channel policy, compliance checks, and approval unless the relationship is already permissioned.

### draft_contact_form

Prepare contact-form message and field plan.

Execution risk: medium.

Execution requires approval by default. The agent must not bypass CAPTCHA, hidden anti-bot fields, rate limits, or form rules.

### draft_thread_reply

Prepare a Reddit/forum/community reply.

Execution risk: high.

Default draft should be no-link, helpful, context-specific, and not reusable elsewhere.

### draft_video_comment

Prepare a YouTube/video-platform comment or reply.

Execution risk: high.

Default draft should answer the real context and avoid repeated link-first promotion.

### draft_directory_profile

Prepare EVAVO service profile for a provider-expected directory or marketplace.

Execution risk: low to medium.

Can become approved autopilot when channel rules clearly allow provider listings.

### draft_owned_social_post

Prepare EVAVO-owned social post.

Execution risk: low.

Can become owned-channel autopilot under cadence and quality rules.

### draft_blog_outline

Prepare EVAVO blog, teardown, checklist, or landing-page outline.

Execution risk: low.

Can be automated as owned content preparation.

### submit_directory_listing

Submit EVAVO profile to a provider-expected channel.

Execution risk: low to medium.

Requires duplicate check, rules check, submission proof, and action cap.

### submit_contact_form

Submit a contact form.

Execution risk: medium to high.

Requires approval by default, real trigger, EVAVO identity, no CAPTCHA bypass, suppression checks, and low cap.

### send_email

Send an email.

Execution risk: medium to high.

Requires contact policy, consent or permitted basis, sender identity, unsubscribe where required, suppression checks, and audit trail.

### post_owned_channel

Publish or schedule on EVAVO-owned channel.

Execution risk: low.

Requires owned-channel policy, cadence cap, EVAVO voice score, and audit trail.

### post_community_reply

Post a reply/comment in a community channel.

Execution risk: high.

Requires channel rules memory, no repeated templates, link policy pass, disclosure policy pass, approval by default, and strict cooldowns.

### do_not_engage

Explicitly mark that the agent should not engage.

Reasons include:

- bad fit
- channel rules unclear
- self-promo banned
- too generic
- budget paused
- suppression rule
- negative channel history
- low expected value

## Required action fields

Every action record should include:

- signal id
- channel id
- action type
- recommended automation mode
- reason
- context evidence
- EVAVO fit explanation
- channel policy result
- link policy result
- disclosure policy result
- cost estimate
- risk flags
- status
- created at
- updated at

## Required draft fields

Every draft record should include:

- action id
- variant
- subject, when applicable
- body
- specificity score
- EVAVO voice score
- generic-risk score
- usefulness score
- link-risk score
- disclosure status
- banned phrase hits
- can be reused elsewhere: yes/no
- reviewer notes

## Scoring gates

### context fit

Passes only when the action responds to a real page, post, business issue, tender, directory, enquiry path, or owned-channel goal.

Hard fail when the message could be posted anywhere without changing it.

### EVAVO fit

Passes only when the signal maps to EVAVO services, proof points, projects, or active goals.

### channel fit

Passes only when channel class, link policy, disclosure policy, action type, and automation mode align.

### human quality

Passes only when the draft sounds specific, useful, and EVAVO-like.

Hard fail examples:

- fake praise
- generic greeting
- hype language
- template structure
- link-first pitch
- hidden affiliation

### cost fit

Passes only when budget ledger and caps allow the action.

If budget state is unknown, stale, or near hard cap, execution is blocked.

## Execution envelope

Before execution, the Worker must verify:

- action status is approved or autopilot-eligible
- current channel policy still allows the action
- daily and per-channel caps are available
- no suppression rule matches
- no cooldown is active
- draft still passes quality gates
- budget ledger is healthy
- audit record can be written

If any check fails, action status changes to `blocked` or `needs_review` with a reason.

## Outcome model

Outcomes should include:

- accepted/listed/published
- sent/submitted
- replied
- clicked
- meeting booked
- lead created
- ignored
- rejected
- removed
- negative reaction
- unsubscribe/do-not-contact
- error

Outcomes feed strategy learning, channel cooldowns, budget recommendations, and draft-quality tuning.

## Default execution order

Safer actions should be enabled first:

1. save signal
2. draft owned content
3. draft directory profile
4. draft direct contact
5. draft community reply
6. submit provider-expected directory listing
7. post owned channel
8. send permissioned/warm email
9. submit contact form
10. post community reply

Community and cold/direct-contact execution should remain last because they carry the highest reputation risk.
