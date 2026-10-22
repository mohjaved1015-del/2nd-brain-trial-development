// TODO: replace every use of this with the signed-in user's actual
// org_id once Supabase Auth is wired in. Centralized here instead of
// duplicated as a literal string across page.tsx and multiple API
// routes, so there's exactly one place to change when that happens.
export const PLACEHOLDER_ORG_ID = "00000000-0000-0000-0000-000000000000";
