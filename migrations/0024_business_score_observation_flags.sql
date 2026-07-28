-- Business score observation provenance v1.
-- Adds explicit evidence flags for every Account 360 score column so a deliberate
-- score of zero can be distinguished from the legacy NOT NULL DEFAULT 0 sentinel.
-- Existing valid nonzero scores are conservatively marked observed. Existing zero,
-- invalid and out-of-range values remain unobserved. This migration does not enable
-- sending, posting, forms, browser automation, AI calls or external execution.

ALTER TABLE business_organizations
  ADD COLUMN fit_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(fit_score_observed IN (0, 1));
ALTER TABLE business_organizations
  ADD COLUMN priority_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(priority_score_observed IN (0, 1));
ALTER TABLE business_organizations
  ADD COLUMN risk_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(risk_score_observed IN (0, 1));
ALTER TABLE business_organizations
  ADD COLUMN confidence_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(confidence_score_observed IN (0, 1));

ALTER TABLE business_people
  ADD COLUMN confidence_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(confidence_score_observed IN (0, 1));

ALTER TABLE business_signals
  ADD COLUMN signal_strength_observed INTEGER NOT NULL DEFAULT 0
  CHECK(signal_strength_observed IN (0, 1));
ALTER TABLE business_signals
  ADD COLUMN confidence_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(confidence_score_observed IN (0, 1));

ALTER TABLE business_opportunities
  ADD COLUMN fit_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(fit_score_observed IN (0, 1));
ALTER TABLE business_opportunities
  ADD COLUMN need_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(need_score_observed IN (0, 1));
ALTER TABLE business_opportunities
  ADD COLUMN urgency_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(urgency_score_observed IN (0, 1));
ALTER TABLE business_opportunities
  ADD COLUMN budget_likelihood_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(budget_likelihood_score_observed IN (0, 1));
ALTER TABLE business_opportunities
  ADD COLUMN contactability_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(contactability_score_observed IN (0, 1));
ALTER TABLE business_opportunities
  ADD COLUMN evidence_quality_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(evidence_quality_score_observed IN (0, 1));
ALTER TABLE business_opportunities
  ADD COLUMN risk_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(risk_score_observed IN (0, 1));
ALTER TABLE business_opportunities
  ADD COLUMN confidence_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(confidence_score_observed IN (0, 1));

ALTER TABLE business_service_matches
  ADD COLUMN match_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(match_score_observed IN (0, 1));

ALTER TABLE business_audit_packs
  ADD COLUMN confidence_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(confidence_score_observed IN (0, 1));

ALTER TABLE business_website_audit_runs
  ADD COLUMN readiness_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(readiness_score_observed IN (0, 1));
ALTER TABLE business_website_audit_runs
  ADD COLUMN risk_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(risk_score_observed IN (0, 1));
ALTER TABLE business_website_audit_runs
  ADD COLUMN confidence_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(confidence_score_observed IN (0, 1));

ALTER TABLE business_audit_observations
  ADD COLUMN confidence_score_observed INTEGER NOT NULL DEFAULT 0
  CHECK(confidence_score_observed IN (0, 1));

UPDATE business_organizations SET
  fit_score_observed = CASE WHEN fit_score > 0 AND fit_score <= 100 THEN 1 ELSE 0 END,
  priority_score_observed = CASE WHEN priority_score > 0 AND priority_score <= 100 THEN 1 ELSE 0 END,
  risk_score_observed = CASE WHEN risk_score > 0 AND risk_score <= 100 THEN 1 ELSE 0 END,
  confidence_score_observed = CASE WHEN confidence_score > 0 AND confidence_score <= 100 THEN 1 ELSE 0 END;

UPDATE business_people SET
  confidence_score_observed = CASE WHEN confidence_score > 0 AND confidence_score <= 100 THEN 1 ELSE 0 END;

UPDATE business_signals SET
  signal_strength_observed = CASE WHEN signal_strength > 0 AND signal_strength <= 100 THEN 1 ELSE 0 END,
  confidence_score_observed = CASE WHEN confidence_score > 0 AND confidence_score <= 100 THEN 1 ELSE 0 END;

UPDATE business_opportunities SET
  fit_score_observed = CASE WHEN fit_score > 0 AND fit_score <= 100 THEN 1 ELSE 0 END,
  need_score_observed = CASE WHEN need_score > 0 AND need_score <= 100 THEN 1 ELSE 0 END,
  urgency_score_observed = CASE WHEN urgency_score > 0 AND urgency_score <= 100 THEN 1 ELSE 0 END,
  budget_likelihood_score_observed = CASE WHEN budget_likelihood_score > 0 AND budget_likelihood_score <= 100 THEN 1 ELSE 0 END,
  contactability_score_observed = CASE WHEN contactability_score > 0 AND contactability_score <= 100 THEN 1 ELSE 0 END,
  evidence_quality_score_observed = CASE WHEN evidence_quality_score > 0 AND evidence_quality_score <= 100 THEN 1 ELSE 0 END,
  risk_score_observed = CASE WHEN risk_score > 0 AND risk_score <= 100 THEN 1 ELSE 0 END,
  confidence_score_observed = CASE WHEN confidence_score > 0 AND confidence_score <= 100 THEN 1 ELSE 0 END;

UPDATE business_service_matches SET
  match_score_observed = CASE WHEN match_score > 0 AND match_score <= 100 THEN 1 ELSE 0 END;

UPDATE business_audit_packs SET
  confidence_score_observed = CASE WHEN confidence_score > 0 AND confidence_score <= 100 THEN 1 ELSE 0 END;

UPDATE business_website_audit_runs SET
  readiness_score_observed = CASE WHEN readiness_score > 0 AND readiness_score <= 100 THEN 1 ELSE 0 END,
  risk_score_observed = CASE WHEN risk_score > 0 AND risk_score <= 100 THEN 1 ELSE 0 END,
  confidence_score_observed = CASE WHEN confidence_score > 0 AND confidence_score <= 100 THEN 1 ELSE 0 END;

UPDATE business_audit_observations SET
  confidence_score_observed = CASE WHEN confidence_score > 0 AND confidence_score <= 100 THEN 1 ELSE 0 END;
