import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import type Stripe from "stripe";

// WHY: Stripe webhook handler for subscription lifecycle events.
// Verifies webhook signature, then updates user tier in the database.

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        if (userId && plan) {
          await db.user.update({
            where: { id: userId },
            data: {
              tier: plan as "STARTER" | "GROWTH" | "SCALE",
            },
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        // WHY: In Stripe SDK v21+, subscription is accessed via parent property.
        // The value may be a string ID or an expanded Subscription object.
        const subRef =
          (invoice as unknown as { subscription?: string }).subscription ??
          invoice.parent?.subscription_details?.subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;

        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          const userId = subscription.metadata?.userId;
          const plan = subscription.metadata?.plan;

          if (userId && plan) {
            await db.user.update({
              where: { id: userId },
              data: {
                tier: plan as "STARTER" | "GROWTH" | "SCALE",
              },
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (userId) {
          // WHY: Downgrade to Starter (free tier equivalent) when subscription is cancelled.
          await db.user.update({
            where: { id: userId },
            data: { tier: "STARTER" },
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
