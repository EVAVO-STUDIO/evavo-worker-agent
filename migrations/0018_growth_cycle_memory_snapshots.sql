ALTER TABLE growth_operator_cycle_events ADD COLUMN strategy_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE growth_operator_cycle_events ADD COLUMN blackboard_json TEXT NOT NULL DEFAULT '{}';
