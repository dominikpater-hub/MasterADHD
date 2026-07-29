// MasterADHD — Stripe Webhook (Supabase Edge Function, Deno)
// JEDYNE miejsce, które nadaje plan 'paid'/'free'. Używa roli serwisowej
// (service_role) i omija RLS, więc klient nie może sam sobie zmienić planu.
// Deploy: supabase functions deploy webhook --no-verify-jwt
// Sekrety: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY
import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,   // omija RLS — trzymaj w sekrecie
);

async function setPlan(userId: string, plan: 'paid' | 'free') {
  if (!userId) return;
  // upsert, żeby zadziałało nawet zanim klient utworzy swój wiersz
  await admin.from('user_state').upsert({ user_id: userId, plan }, { onConflict: 'user_id' });
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature') || '';
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );
  } catch (e) {
    return new Response(`bad_signature: ${e.message}`, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      await setPlan(s.client_reference_id ?? '', 'paid');
      break;
    }
    case 'customer.subscription.deleted':
    case 'invoice.payment_failed': {
      // W produkcji: zmapuj customer → user_id (np. osobna tabela) i zdejmij plan.
      // Tu zostawiamy jako jawny punkt do uzupełnienia przy wdrożeniu.
      break;
    }
  }
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
