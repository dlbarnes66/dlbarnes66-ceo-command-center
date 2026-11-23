-- CEO Command Center: snapshot contract for your own Supabase apps
-- ------------------------------------------------------------------
-- Install this in each app you want to connect (FundOS, NonprofitOS,
-- Grant Scout Pro, CRM OS, …). The command center calls it with the
-- project's anon key plus a secret token, so no service-role key ever
-- leaves the app. Edit the two marked sections to return real numbers.
--
-- 1. Run this file in the app's SQL editor.
-- 2. Store a token (32+ random characters):
--      insert into command_center.settings (token_hash)
--      values (extensions.crypt('PASTE-A-LONG-RANDOM-TOKEN', extensions.gen_salt('bf')));
-- 3. In the command center: Connections → My Supabase app → paste the
--    project URL, anon key and the same token.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists command_center;
revoke all on schema command_center from public, anon, authenticated;

create table if not exists command_center.settings (
  id int primary key default 1 check (id = 1),
  token_hash text not null
);

create or replace function public.command_center_snapshot(p_token text, p_entity text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_metrics jsonb := '[]'::jsonb;
  v_obligations jsonb := '[]'::jsonb;
begin
  select token_hash into v_hash from command_center.settings where id = 1;
  if v_hash is null or p_token is null or crypt(p_token, v_hash) <> v_hash then
    raise exception 'invalid token' using errcode = '28000';
  end if;

  -- ── EDIT: metrics ─────────────────────────────────────────────────
  -- Each metric: { key, label, value, unit }  unit ∈ usd | count | percent | months
  -- Standard keys the portfolio understands: cash, monthly_burn,
  -- runway_months, mrr, active_customers. Any other key shows on the
  -- entity page. p_entity is the "Entity reference" set on the
  -- connection; use it if one app holds several entities.
  --
  -- Example (replace with your tables):
  -- select jsonb_agg(m) into v_metrics from (
  --   select 'cash' as key, 'Cash on hand' as label,
  --          coalesce(sum(balance), 0) as value, 'usd' as unit
  --     from bank_accounts where fund_slug = coalesce(p_entity, fund_slug)
  --   union all
  --   select 'committed_capital', 'Committed capital', coalesce(sum(amount), 0), 'usd'
  --     from investor_commitments where status = 'signed'
  --   union all
  --   select 'monthly_burn', 'Monthly burn', coalesce(sum(amount), 0), 'usd'
  --     from expenses where paid_at >= now() - interval '30 days'
  -- ) m;

  -- ── EDIT: obligations ─────────────────────────────────────────────
  -- Each: { id, title, category, due_date (YYYY-MM-DD), status, owner }
  -- category ∈ compliance | tax | investor | grant | legal | finance | operations | other
  -- status   ∈ open | done
  --
  -- Example:
  -- select jsonb_agg(o) into v_obligations from (
  --   select id::text as id, title, 'grant' as category,
  --          to_char(due_date, 'YYYY-MM-DD') as due_date,
  --          case when submitted then 'done' else 'open' end as status,
  --          owner_name as owner
  --     from grant_reports where due_date <= current_date + 90
  -- ) o;

  return jsonb_build_object(
    'metrics', coalesce(v_metrics, '[]'::jsonb),
    'obligations', coalesce(v_obligations, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.command_center_snapshot(text, text) from public;
grant execute on function public.command_center_snapshot(text, text) to anon;
