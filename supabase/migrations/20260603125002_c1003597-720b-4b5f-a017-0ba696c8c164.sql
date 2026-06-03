CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _account_type public.account_type;
BEGIN
  _account_type := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'account_type','individual') = 'company'
      THEN 'company'::public.account_type
    ELSE 'individual'::public.account_type
  END;

  INSERT INTO public.profiles (id, display_name, avatar_url, account_type, company_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    _account_type,
    NULLIF(NEW.raw_user_meta_data->>'company_name','')
  );
  RETURN NEW;
END;
$function$;