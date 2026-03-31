import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";

// WHY: Creates a Stripe Checkout Session for subscription billing.
// Requires an authenticated user and a valid plan key.

export async function POST(request: Request) {
  try {
    // 1. Verify authentication
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "You must be signed in to subscribe" },
        { status: 401 },
      );
    }

    // 2. Parse and validate plan
    const body = await request.json();
    const { plan } = body as { plan?: string };

    if (!plan || !(plan in PLANS)) {
      return NextResponse.json(
        { error: "Invalid plan. Choose STARTER, GROWTH, or SCALE." },
        { status: 400 },
      );
    }

    const selectedPlan = PLANS[plan as PlanKey];

    // 3. Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: session.user.email,
      metadata: {
        userId: session.user.id ?? "",
        plan,
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `PrinceMarketing ${selectedPlan.name}`,
              description: selectedPlan.description,
            },
            unit_amount: selectedPlan.priceInCents,
            recurring: {
              interval: selectedPlan.interval,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/dashboard?checkout=success`,
      cancel_url: `${process.env.NEXTAUTH_URL}/#pricing`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
