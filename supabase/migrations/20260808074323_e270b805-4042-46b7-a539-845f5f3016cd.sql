-- 1) Integrity: no duplicate welcome bonus, no duplicate trade reward per offer
CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_welcome_once
  ON public.wallet_ledger (user_id) WHERE entry_type = 'welcome_bonus';

CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_trade_once
  ON public.wallet_ledger (user_id, reference_offer) WHERE entry_type = 'trade_completed';

-- 2) Append-only ledger
CREATE OR REPLACE FUNCTION public.wallet_ledger_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'wallet_ledger_is_append_only';
END $$;

DROP TRIGGER IF EXISTS wallet_ledger_no_update ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_no_update BEFORE UPDATE ON public.wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.wallet_ledger_immutable();

DROP TRIGGER IF EXISTS wallet_ledger_no_delete ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_no_delete BEFORE DELETE ON public.wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.wallet_ledger_immutable();

-- 3) Welcome bonus written into the ledger on signup
CREATE OR REPLACE FUNCTION public.grant_welcome_bonus(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallet_ledger (user_id, entry_type, amount_di, note)
  VALUES (_user_id, 'welcome_bonus', 100, 'مكافأة ترحيب عند إنشاء الحساب')
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _account_type public.account_type;
  _kyc public.kyc_status;
BEGIN
  _account_type := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'account_type','individual') = 'company'
      THEN 'company'::public.account_type
    ELSE 'individual'::public.account_type
  END;
  _kyc := CASE WHEN _account_type = 'company' THEN 'pending'::public.kyc_status ELSE 'none'::public.kyc_status END;

  INSERT INTO public.profiles (id, display_name, avatar_url, account_type, company_name, company_kyc_status, terms_accepted_at, terms_version)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    _account_type,
    NULLIF(NEW.raw_user_meta_data->>'company_name',''),
    _kyc,
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted') = 'true' THEN now() ELSE NULL END,
    NULLIF(NEW.raw_user_meta_data->>'terms_version','')
  );

  INSERT INTO public.profiles_private (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM public.grant_welcome_bonus(NEW.id);

  RETURN NEW;
END;
$$;

-- 4) Statement with running balance (accounting proof per entry)
CREATE OR REPLACE FUNCTION public.di_statement(_user_id uuid, _limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid,
  entry_type ledger_entry_type,
  amount_di numeric,
  balance_after numeric,
  reference_offer uuid,
  note text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM (
    SELECT l.id, l.entry_type, l.amount_di,
           SUM(l.amount_di) OVER (PARTITION BY l.user_id ORDER BY l.created_at, l.id) AS balance_after,
           l.reference_offer, l.note, l.created_at
    FROM public.wallet_ledger l
    WHERE l.user_id = _user_id
      AND (_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT LEAST(COALESCE(_limit,100), 500)
  ) s
  ORDER BY s.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.di_statement(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.di_balance(uuid) TO authenticated;