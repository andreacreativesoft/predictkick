-- 012_rls_policies.sql

ALTER TABLE bankroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bankroll_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bankroll_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_breakdown ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bankroll" ON bankroll FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own bankroll" ON bankroll FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bankroll" ON bankroll FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own bets" ON bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bets" ON bets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bets" ON bets FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON bankroll_transactions FOR SELECT USING (bankroll_id IN (SELECT id FROM bankroll WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own transactions" ON bankroll_transactions FOR INSERT WITH CHECK (bankroll_id IN (SELECT id FROM bankroll WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own daily snapshots" ON bankroll_daily FOR SELECT USING (bankroll_id IN (SELECT id FROM bankroll WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own performance" ON performance_breakdown FOR SELECT USING (bankroll_id IN (SELECT id FROM bankroll WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own live tracking" ON live_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own live tracking" ON live_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own live tracking" ON live_tracking FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own manual inputs" ON manual_inputs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own manual inputs" ON manual_inputs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own manual inputs" ON manual_inputs FOR UPDATE USING (auth.uid() = user_id);
