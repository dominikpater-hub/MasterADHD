// MasterADHD — Stripe Checkout (Supabase Edge Function, Deno)
// Tworzy sesję subskrypcji dla ZALOGOWANEGO użytkownika i zwraca URL.
// Deploy: supabase functions deploy checkout
// Sekrety: STRIPE_SECRET_KEY, STRIPE_PRICE_ID
import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405, headers: cors });

  // Tożsamość użytkownika z jego JWT (nagłówek Authorization).
  const authHeader = req.headers.get('Authorization') || '';
  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors });

  const origin = req.headers.get('Origin') || '';
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: Deno.env.get('STRIPE_PRICE_ID')!, quantity: 1 }],
    client_reference_id: user.id,           // tak webhook rozpozna, komu nadać plan
    customer_email: user.email ?? undefined,
    success_url: `${origin}/?paid=1`,
    cancel_url: `${origin}/`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
