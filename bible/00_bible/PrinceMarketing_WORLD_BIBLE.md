# PRINCEMARKETING.COM -- WORLD BIBLE
### The Single Source of Truth
**Version:** 1.0
**Created:** 2026-03-31
**Owner:** LaDonte Prince
**Archetype:** The Silent Strategist

> This document governs every pixel, word, interaction, and decision in PrinceMarketing.com.
> Nothing ships that contradicts this Bible.

---

## TABLE OF CONTENTS

1. [Brand Identity](#1-brand-identity)
2. [Brand Voice & Tone](#2-brand-voice--tone)
3. [Audience Personas](#3-audience-personas)
4. [Competitive Positioning](#4-competitive-positioning)
5. [Product Principles](#5-product-principles)
6. [Emotional Architecture](#6-emotional-architecture)
7. [Feature Naming Conventions](#7-feature-naming-conventions)
8. [Visual Universe](#8-visual-universe)
9. [Production Pipeline](#9-production-pipeline)
10. [Quality Standards](#10-quality-standards)

---

## 1. BRAND IDENTITY

### 1A: Name Treatment

**Primary mark:** `PrinceMarketing`
- One word. Capital P, capital M. No space. No dot in the wordmark.
- The domain is `princemarketing.com` -- lowercase in URLs, PrinceMarketing in brand contexts.
- Never: "Prince Marketing" (two words), "PRINCEMARKETING" (all caps in body text), "prince marketing" (all lowercase in brand contexts).

**Logomark:** The letter P, constructed from geometric lines. Minimal. Could be mistaken for an architecture firm's mark. No gradients, no illustrations, no mascots. Ever.

**Favicon:** The P mark in white on `#0A0A0A` background.

**Logo Clearspace:** Minimum clearspace equals the height of the "P" on all sides.

**Tagline:** None publicly displayed. Internal positioning line: *"Your marketing, handled."*

**Relationship disclosure:**
- PrinceMarketing.com = the SaaS dashboard customers use
- PrinceMarketing.ai = the API engine generating creative assets behind the scenes
- Customers never see, reference, or interact with .ai directly
- In UI copy, refer to the AI as "your strategist" or "PrinceMarketing" -- never "our AI" or "the algorithm"

---

### 1B: Color System

#### Primary Palette (Dark Mode -- Default)

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Background | Void | `#0A0A0A` | Primary canvas, app background |
| Surface | Graphite | `#141414` | Cards, panels, elevated surfaces |
| Surface Raised | Slate | `#1E1E1E` | Modals, dropdowns, hover states |
| Border | Smoke | `#2A2A2A` | Dividers, input borders, subtle lines |
| Text Primary | Cloud | `#F5F5F5` | Headlines, primary body text |
| Text Secondary | Ash | `#A3A3A3` | Labels, timestamps, secondary info |
| Text Tertiary | Stone | `#6B6B6B` | Placeholders, disabled text |

#### Accent Colors

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| **Signature** | **Royal** | **`#6366F1`** | Primary CTA, active states, brand accent. Indigo -- not blue, not purple. The in-between. |
| Success | Mint | `#10B981` | Published, live, positive metrics |
| Warning | Amber | `#F59E0B` | Needs attention, pending approval |
| Error | Coral | `#EF4444` | Failed, urgent, destructive actions |
| Insight | Cyan | `#06B6D4` | AI recommendations, analytics highlights |

#### Light Mode Palette

| Role | Name | Hex |
|------|------|-----|
| Background | Paper | `#FAFAFA` |
| Surface | White | `#FFFFFF` |
| Surface Raised | Cream | `#F5F5F5` |
| Border | Mist | `#E5E5E5` |
| Text Primary | Ink | `#0A0A0A` |
| Text Secondary | Graphite | `#525252` |
| Signature | Royal | `#6366F1` (unchanged) |

**Color Rules:**
- Royal (`#6366F1`) is the ONLY color that persists identically across dark and light mode. It is the brand's anchor.
- Never use Royal for backgrounds. It is for interactive elements and brand moments only.
- Success/Warning/Error colors are functional, not decorative. They appear only when communicating status.
- No gradients anywhere in the product UI. Gradients are reserved exclusively for marketing site hero sections.
- Color temperature: Cool-neutral. No warm yellows, no earthy tones in the UI. Warmth comes from the AI's conversational tone, not from the palette.

#### Color Temperature by Context
| Context | Temperature | Hex Bias |
|---------|-------------|----------|
| Dashboard | Cool neutral, 6500K | `#0A0A0A` base |
| Onboarding AI chat | Slightly warmer, 5800K | `#141414` with `#6366F1` accents |
| Analytics | Cool, 7000K | Blue-shifted highlights with Cyan |
| Content Calendar | Neutral, 6200K | Green/amber status indicators |
| Settings/Account | Cool neutral, 6500K | Minimal color, functional |

---

### 1C: Typography

**Primary Typeface:** Inter
- Why: Designed for screens. Optimized for UI. Variable font with excellent legibility at small sizes. Used by Linear, Vercel, Raycast. It signals "modern tool, not marketing template."
- Weight range: 400 (body), 500 (emphasis), 600 (headings), 700 (display/hero only)
- Never use weights below 400 or above 700.

**Monospace:** JetBrains Mono
- Usage: Code snippets, API references, metric numbers on dashboards, timestamps
- Weight: 400 only

**Type Scale:**

| Level | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| Display | 48px / 3rem | 700 | 1.1 | -0.02em | Marketing hero headlines only |
| H1 | 32px / 2rem | 600 | 1.2 | -0.015em | Page titles |
| H2 | 24px / 1.5rem | 600 | 1.3 | -0.01em | Section headers |
| H3 | 20px / 1.25rem | 600 | 1.4 | -0.005em | Card titles, subsections |
| Body Large | 16px / 1rem | 400 | 1.6 | 0 | Primary content |
| Body | 14px / 0.875rem | 400 | 1.5 | 0 | Secondary content, form labels |
| Caption | 12px / 0.75rem | 500 | 1.4 | 0.01em | Timestamps, metadata, badges |

**Typography Rules:**
- Maximum 60-70 characters per line in body text. Hard limit.
- No ALL CAPS in the product UI except for badges and status indicators (e.g., `LIVE`, `DRAFT`).
- Marketing site may use ALL CAPS for navigation and section labels only.
- No italic text in the product. Emphasis uses weight 500, not style italic.
- Numbers in metrics/analytics use JetBrains Mono, tabular figures enabled.

---

### 1D: Iconography & Visual Elements

**Icon Style:** Outlined, 1.5px stroke, rounded caps and joins. 24x24 base grid.
- Reference: Lucide icons (the actual icon set to use in development)
- Never filled icons. Never dual-tone. Never illustrated.
- Icon color inherits from text color in context (primary, secondary, or tertiary).

**Illustration:** None. PrinceMarketing does not use illustrations, mascots, or decorative graphics.
- Data visualization is the visual language. Charts, graphs, calendars -- these are the "illustrations."
- If a section needs visual interest, use whitespace and typography, not imagery.

**Photography:** Used only on marketing site for customer stories/testimonials.
- Style: Environmental portraits. Real business owners in their workplaces. Natural light. Shallow depth of field.
- Never: Stock photos. Never staged "person pointing at laptop" shots. Never diverse-group-around-table corporate imagery.

**Motion:**
- Transitions: 200ms ease-out for micro-interactions. 300ms ease-in-out for page transitions.
- No bounce. No spring physics. No playful animations.
- Loading states: Skeleton screens with `#1E1E1E` pulsing to `#2A2A2A`. Never spinners.
- The AI "thinking" state: Three dots with a subtle sequential fade, not a spinner. This is the ONLY animation that's allowed to feel slightly alive.

**Spacing System:** 4px base unit.
- Component padding: 12px, 16px, 20px, 24px
- Section spacing: 32px, 48px, 64px, 96px
- Maximum content width: 1280px
- Sidebar width: 240px collapsed, 280px expanded

---

## 2. BRAND VOICE & TONE

### 2A: Voice Principles

The PrinceMarketing voice is a **calm expert who respects your time.** It is the voice of someone who has managed marketing for hundreds of businesses and knows exactly what works -- but never makes you feel stupid for not knowing.

**The voice is:**
- **Direct** -- Says what needs to be said in the fewest words. No filler. No "In order to..." or "It's important to note that..."
- **Confident** -- States recommendations as recommendations, not suggestions. "Post this Tuesday at 10am" not "You might want to consider posting on Tuesday."
- **Warm but not casual** -- Respects the user without being cold. "Your content is ready" not "Hey! Your content is good to go!"
- **Specific** -- "Your Instagram engagement increased 23% this week" not "Your social media is doing great!"

**The voice is NOT:**
- Playful, punny, or clever (no "Let's get this bread!" or "Marketing magic awaits!")
- Corporate or stiff ("We are pleased to inform you that your content has been successfully generated")
- Apologetic ("Sorry, but we couldn't quite get that right -- maybe try again?")
- Self-referential about AI ("As an AI, I generated this for you" -- never)

### 2B: Tone Spectrum

Tone shifts by context while voice stays constant:

| Context | Tone | Example |
|---------|------|---------|
| **Onboarding** | Warm, curious, attentive | "Tell me about your business. Who are your best customers, and what do they come to you for?" |
| **Content Calendar** | Crisp, operational | "3 posts scheduled for today. 1 awaiting your approval." |
| **AI Recommendations** | Confident, advisory | "Your audience engages most on Wednesdays between 11am-1pm. I've shifted your schedule to match." |
| **Analytics** | Precise, factual | "Instagram: +23% engagement. LinkedIn: -4% reach. Facebook: stable." |
| **Errors / Failures** | Honest, solution-focused | "That post didn't publish -- Instagram's API was down. I've rescheduled it for tomorrow at the same time." |
| **Empty States** | Encouraging, forward-looking | "No content scheduled yet. Let's build your first week." |
| **Upgrade Prompts** | Value-focused, never pushy | "Your current plan covers 3 platforms. Add all 7 for $X/month." |
| **Success Moments** | Understated acknowledgment | "Published." / "Your first month: 47 posts, 12K impressions. Here's what worked." |

### 2C: Writing Rules

1. **No exclamation marks in the product.** Period. The marketing site gets exactly ONE per page, maximum.
2. **Use "I" for the AI, "you" for the user.** The AI is a first-person entity. "I scheduled your posts" not "Your posts have been scheduled."
3. **Button text is a verb.** "Schedule", "Approve", "Connect", "Start". Not "Let's Go" or "Get Started" (exception: the very first CTA on the marketing site).
4. **Numbers over words.** "3 posts" not "three posts." "47% increase" not "a significant increase."
5. **Present tense.** "I'm generating your content" not "I will generate your content."
6. **No jargon unexplained.** If we must use a marketing term (CPC, CTR, ROAS), show the value first, label second: "You spent $0.43 per click (CPC) this week."
7. **Sentence case everywhere.** "Content calendar" not "Content Calendar" in UI labels (exception: the product name PrinceMarketing).
8. **Maximum UI string lengths:**
   - Button labels: 2 words
   - Toast notifications: 1 sentence
   - Empty states: 2 sentences
   - Error messages: 1 sentence + 1 action

### 2D: Forbidden Words & Phrases

Never use in the product or marketing:

| Forbidden | Use Instead |
|-----------|-------------|
| "Supercharge" | (don't replace -- just be specific about the benefit) |
| "Leverage" | "Use" |
| "Utilize" | "Use" |
| "Game-changer" | (never) |
| "Unlock" | "Get access to" or just describe the feature |
| "Revolutionize" | (never) |
| "Cutting-edge" | (never) |
| "Seamless" | (never -- show the experience, don't label it) |
| "Empower" | (never) |
| "Synergy" | (never) |
| "At the end of the day" | (never) |
| "It's important to note" | (just say the thing) |
| "AI-powered" | "Built with AI" or just describe what the AI does |
| "Magic" / "Magical" | (never -- it's strategy, not tricks) |
| "Robust" | (never) |
| "Solution" | "Platform" or "tool" or just the feature name |

---

## 3. AUDIENCE PERSONAS

### Persona 1: Marcus -- The Expert Tradesperson

**Demographics:**
- Age: 38
- Business: Owner of a plumbing company, 6 years in business
- Revenue: $280K/year, 2 employees
- Location: Atlanta suburbs
- Tech comfort: Uses an iPhone daily, can navigate apps, but doesn't seek out new tools

**The Story:**
Marcus is an exceptional plumber. His customers love him -- 4.9 stars on Google, 200+ reviews. His business grows through word of mouth, but it plateaus every winter. He knows he should "do social media" but every time he opens Instagram to post, he freezes. What do you post about plumbing? He tried Canva once, spent 45 minutes on a single graphic, and never went back. He tried hiring a marketing person on Fiverr -- they posted generic content that didn't sound like him. He's not cheap; he'd happily pay $100-200/month for something that actually works. He just hasn't found it.

**What he says:**
- "I know my trade. I don't know marketing."
- "I don't have time to learn another tool."
- "I tried posting on social media but I never know what to say."
- "My competitor's kid does their TikTok and they're getting all the new customers."

**His day with PrinceMarketing:**
- 7:15am: Opens PrinceMarketing on his phone while drinking coffee. Sees today's content calendar: an Instagram post about winter pipe maintenance is scheduled for noon, a Google Business update goes out at 2pm. He taps "Approve" on both.
- 12:00pm: Between jobs, he sees the notification that his post went live. 3 likes already. He smiles and gets back to work.
- Sunday evening: Gets a weekly summary. 12 posts published. 340 profile visits. 2 new Google reviews prompted by the AI's review request campaign. "This is working."

**What PrinceMarketing must do for Marcus:**
- Never ask him to write copy from scratch
- Never show him a blank canvas
- Never require him to understand marketing terminology
- Give him content that sounds like HIM, not like a marketing agency
- Show him results in plain numbers, not marketing dashboards

**What would make Marcus churn:**
- Feeling like the content is generic / could be any plumber
- Having to spend more than 10 minutes a day on it
- Not seeing tangible results within 30 days
- Being upsold constantly

---

### Persona 2: Priya -- The Passionate Creator

**Demographics:**
- Age: 31
- Business: Online bakery and cake design studio, 3 years in business
- Revenue: $95K/year, solo
- Location: Portland, OR
- Tech comfort: High. Uses Instagram daily, has a Shopify store, comfortable with apps

**The Story:**
Priya's cakes are art. Her Instagram has 4,200 followers, and every post gets genuine engagement. But she does EVERYTHING herself -- baking, decorating, photographing, editing photos, writing captions, responding to DMs, managing orders. She posts 2-3 times a week but knows she should post daily. She's looked at Hootsuite and Buffer but they just schedule -- they don't help her figure out WHAT to post. She's tried Jasper for captions but they sound generic. She needs someone to think about her content strategy so she can focus on making cakes.

**What she says:**
- "I know what looks good, but I run out of ideas for what to post."
- "I spend 3 hours every Sunday trying to plan my content for the week."
- "I need a strategy, not just a scheduler."
- "I wish I could afford to hire a social media manager."

**Her day with PrinceMarketing:**
- Sunday 8pm: Opens PrinceMarketing. The AI has generated a full week of content: 2 cake process videos (she just needs to film 30-second clips), 3 photo posts with captions that reference her actual style, 1 customer testimonial reshare, 1 seasonal promotion. She tweaks one caption and approves the rest in 12 minutes.
- Tuesday 10am: Gets a notification: "Your Valentine's Day content series starts next week. I've drafted 5 posts around your custom cake offerings. Review when ready."
- Friday 5pm: Weekly analytics. Best-performing post: the behind-the-scenes cake assembly reel. The AI notes: "Process content outperforms finished-product shots by 3x for your audience. I'm weighting next week's calendar accordingly."

**What PrinceMarketing must do for Priya:**
- Learn her visual style and voice (she has strong opinions about both)
- Handle strategy and scheduling so she focuses on creating
- Suggest content themes based on trends, seasons, and her business patterns
- Show her competitive insights (what other bakeries in Portland are posting)

**What would make Priya churn:**
- Content suggestions that feel off-brand for her aesthetic
- Not being able to edit or customize what the AI generates
- Feeling like the AI doesn't improve over time based on her feedback
- Missing cultural moments relevant to her business (holiday seasons, local events)

---

### Persona 3: David -- The Scaling Consultant

**Demographics:**
- Age: 45
- Business: Business strategy consulting, 8 years independent
- Revenue: $420K/year, solo with occasional subcontractors
- Location: Chicago
- Tech comfort: High. Power user. Has opinions about tools.

**The Story:**
David left McKinsey to go independent. He's brilliant at strategy but treats his own marketing like a side project. He posts on LinkedIn sporadically -- sometimes a post gets 500 likes, sometimes he goes three weeks without posting. He knows thought leadership is his growth engine but can't maintain consistency. He's tried hiring a content writer but they can't capture his analytical voice. He doesn't need to be told what marketing is -- he needs execution discipline and content that matches his intellectual depth.

**What he says:**
- "I know what I should be doing. I just don't do it consistently."
- "My content writer can't think at my level."
- "LinkedIn is my sales funnel but I treat it like an afterthought."
- "I need a system, not a tool."

**His day with PrinceMarketing:**
- Monday 7am: Opens the dashboard. Sees 5 LinkedIn posts scheduled for the week, each one derived from his recent consulting frameworks and client insights (anonymized). One article draft is ready for his review. He spends 15 minutes refining the Tuesday post -- it needs to sound more like him. He teaches the AI by editing, and it adapts.
- Wednesday 2pm: A post from Monday generated 12 new profile views and 3 connection requests from VP-level prospects. The AI flags them: "These 3 profiles match your ideal client profile. Consider connecting with a personalized note."
- End of month: Dashboard shows his LinkedIn impressions are up 340%. The AI recommends: "Your 'frameworks' posts outperform 'opinion' posts 4:1. Next month's calendar is weighted 70% frameworks. Adjusting."

**What PrinceMarketing must do for David:**
- Capture his intellectual voice, not dumb it down
- Provide strategic insight, not just scheduling
- Connect marketing activity to business outcomes (leads, not likes)
- Maintain consistency without requiring daily attention

**What would make David churn:**
- Content that sounds junior or generic
- Inability to deeply customize the AI's understanding of his expertise
- No clear connection between posting and business results
- Platform feeling like it's designed for beginners

---

## 4. COMPETITIVE POSITIONING

### 4A: Market Position

PrinceMarketing occupies a space that currently does not exist cleanly:

**The gap:** Between "DIY tools that give you a blank canvas" (Canva, Buffer, Hootsuite) and "agencies that charge $3K+/month" (traditional marketing firms).

PrinceMarketing is the **AI marketing strategist and executor** -- it doesn't just give you tools, it gives you a strategy, creates the content, and runs the schedule. You approve. It executes.

### 4B: Competitive Matrix

| Capability | PrinceMarketing | Canva | Hootsuite | Buffer | Jasper | Copy.ai |
|------------|----------------|-------|-----------|--------|--------|---------|
| **Marketing strategy generation** | Yes -- AI interviews you, builds personalized strategy | No | No | No | No | No |
| **Content creation** | Full (copy + visuals via .ai APIs) | Visual design only (DIY) | No | No | Copy only | Copy only |
| **Social scheduling** | Yes -- AI-optimized timing | No | Yes | Yes | No | No |
| **Performance analytics** | Yes -- with strategic recommendations | Basic | Yes | Yes | No | No |
| **Personalization depth** | Deep -- learns your business, voice, audience | Templates | None | None | Tone settings | Tone settings |
| **Time required from user** | ~10 min/day (approve & go) | Hours (DIY) | 30+ min (manual) | 30+ min (manual) | Variable (copy only) | Variable (copy only) |
| **Target user** | Solo business owners | Everyone (unfocused) | Social media managers | Small teams | Content marketers | Content marketers |
| **Pricing** | Premium (value-justified) | Freemium | $99+/mo | $6+/mo | $49+/mo | $49+/mo |

### 4C: Positioning Statements

**Against Canva:**
"Canva gives you a blank canvas and says 'create.' PrinceMarketing tells you what to create, creates it, and posts it. You approve."

**Against Hootsuite / Buffer:**
"Schedulers organize what you've already made. PrinceMarketing makes it, schedules it, and tells you what to make next."

**Against Jasper / Copy.ai:**
"AI copywriters generate text in a vacuum. PrinceMarketing generates text from a deep understanding of YOUR business, YOUR audience, and what's actually working."

**Against hiring a freelancer / agency:**
"A freelancer costs $1,500+/month and still needs you to brief them every week. PrinceMarketing costs a fraction, learns faster, and never takes a vacation."

### 4D: The One-Sentence Position
**"PrinceMarketing is the CMO that solo business owners could never afford -- until now."**

### 4E: What We Never Claim
- We never claim to replace human creativity (we amplify it)
- We never claim "set it and forget it" (the user's approval and input makes it better)
- We never claim instant results (we claim consistent strategy that compounds)
- We never disparage competitors by name in marketing (we describe the category gap, not their failures)

---

## 5. PRODUCT PRINCIPLES

### 5A: PrinceMarketing ALWAYS Does

1. **Starts with listening.** The first experience is the AI asking questions, not the user filling forms. Conversation, not configuration.

2. **Shows the next action.** Every screen answers: "What should I do right now?" The content calendar is always one tap away.

3. **Explains its reasoning.** "I scheduled this for Tuesday at 10am because your audience is most active then" -- not just "Scheduled for Tuesday."

4. **Gets better with use.** Every approval, every edit, every rejection teaches the AI. Month 3 should feel dramatically different from Month 1.

5. **Measures what matters to the business owner.** Not impressions for impressions' sake. Connects marketing activity to business outcomes: calls, website visits, reviews, inquiries.

6. **Respects the user's time.** The daily interaction should take less than 10 minutes. If the user is spending more than 15 minutes, the product is failing.

7. **Sounds like the business owner.** Content generated by PrinceMarketing should be indistinguishable from what the owner would write if they had time and skill. Authenticity is non-negotiable.

8. **Works across platforms.** Instagram, Facebook, LinkedIn, Google Business, TikTok, X, Pinterest -- the user picks their platforms during onboarding and PrinceMarketing handles the rest.

9. **Operates transparently.** The user can always see what's scheduled, what's been posted, and what's performing. No black box.

10. **Fails gracefully.** When something goes wrong (API down, post fails, content flagged), PrinceMarketing explains what happened and what it's doing about it. No silent failures.

### 5B: PrinceMarketing NEVER Does

1. **Never shows a blank canvas.** No empty text fields where the user has to figure out what to write. Always provide a draft, a suggestion, a starting point.

2. **Never uses marketing jargon without context.** If CTR appears, it's "4.2% click-through rate" with context: "That's above average for your industry."

3. **Never auto-publishes without approval** (unless the user explicitly enables auto-publish for a specific content type).

4. **Never sends generic content.** Every piece of content must be grounded in the user's business, audience, and voice. If the AI can't personalize it, it shouldn't generate it.

5. **Never nags.** No "You haven't posted in 3 days!" guilt notifications. Instead: "I have 3 posts ready for your approval whenever you're ready."

6. **Never locks essential features behind higher tiers.** AI strategy, content generation, and scheduling are available on all paid plans. Tiers expand volume, platforms, and advanced features -- not core functionality.

7. **Never makes the user feel stupid.** No tooltips that explain what a "post" is. No condescending onboarding. Assume intelligence, not knowledge.

8. **Never surfaces complexity without purpose.** Advanced analytics, A/B testing, and API access exist for users who want them -- but they're never in the way for users who don't.

9. **Never sacrifices quality for quantity.** 3 excellent posts per week beats 7 mediocre ones. The AI's recommendations should reflect this.

10. **Never forgets context.** If the user told the AI during onboarding that they're a vegan bakery, the AI should never suggest a post promoting dairy products. Context persists forever.

---

## 6. EMOTIONAL ARCHITECTURE

### 6A: The Emotional Journey

Every user follows this arc. Each stage has a target emotion, and the product must deliver it:

```
DISCOVERY ── SIGNUP ── ONBOARDING ── FIRST WEEK ── FIRST MONTH ── ONGOING ── EXPANSION
    |           |          |             |             |             |            |
  "Hm."     "Yes."    "Oh wow."     "This is     "I can't go    "It's      "My team
                                     working."     back."       just how    needs
                                                                I work     this too."
                                                                 now."
```

### 6B: Touchpoint Emotions (Detailed)

#### Discovery (Marketing Site)

**Target emotion:** *"This is for someone like me."*
- The marketing site feels premium but not exclusive
- Copy speaks directly to the pain: "You're great at what you do. Marketing shouldn't be the thing that holds you back."
- No feature lists above the fold. Lead with the problem and the feeling of relief.
- Social proof: Real business owners (not logos, not testimonials with stock photos)
- The CTA is singular and clear: "Start your strategy" (not "Sign up" or "Try free")

**Design direction:**
- Dark background (`#0A0A0A`), minimal text, generous whitespace
- One hero animation: the content calendar filling in with personalized content
- No chatbot popup. No cookie banner dominating the viewport. No sticky header on scroll.

#### Signup

**Target emotion:** *"That was fast."*
- Email + password. Or Google OAuth. Nothing else.
- No company size dropdown. No "How did you hear about us?" No plan selection yet.
- Signup should take less than 30 seconds.
- Immediately enters onboarding -- no email verification gate (verify later).

#### Onboarding (The AI Interview)

**Target emotion:** *"This is actually listening to me."*
- The AI asks conversational questions, one at a time:
  1. "What's your business? Tell me in your own words."
  2. "Who are your best customers? Describe them."
  3. "What's working for you right now in marketing, if anything?"
  4. "What platforms are you on? Which ones matter most?"
  5. "What's your biggest frustration with marketing?"
  6. "Show me your website or social profiles -- I'll study them."
- The AI responds with understanding: "Got it -- you're a plumber in Atlanta serving residential customers. Your Google reviews are strong but your social presence is thin. Here's what I'd do..."
- Ends with: "Here's your marketing strategy for the next 30 days. Ready to see your first week of content?"

**Design direction:**
- Full-screen chat interface. No sidebars, no navigation. Just the conversation.
- The AI's responses appear with a subtle typing indicator (the three-dot fade)
- Minimal UI chrome. The content IS the interface.

#### First Week

**Target emotion:** *"Wait, it actually did the work?"*
- The user opens the Content Calendar to find 5-7 days of content already created
- Each post has: visual (generated via .ai), caption (in their voice), platform, scheduled time
- The user's only job: review, tweak if desired, approve
- First notification: "Your first post was published. Here's how it's doing."

**This is the Medusa Effect moment.** The first time they see content that sounds like them, about their business, ready to go. The moment of "wait -- this is actually good" is the moment they're hooked.

#### First Month

**Target emotion:** *"This is working. I can see the numbers."*
- Weekly summary emails with plain-English analytics
- "You published 18 posts across 3 platforms. Your Instagram grew by 47 followers. You received 3 new Google reviews. Your website traffic is up 12%."
- The AI begins to personalize more aggressively based on performance data
- Recommendations get sharper: "Your audience prefers how-to content over promotional posts. Adjusting your mix."

#### Ongoing (Month 2+)

**Target emotion:** *"This is just how I do marketing now."*
- The daily check becomes habit: open app, review today's content, approve, done
- The AI's content is consistently high quality and getting better
- The user starts to trust the AI's recommendations more and edits less
- Performance dashboards show trends over time, not just snapshots

#### Expansion

**Target emotion:** *"My team / my clients need this."*
- By month 3-6, power users want more: team seats, client management, white-label
- The upgrade path feels natural, not forced
- "You've been managing 3 platforms. Add your team member to handle approvals when you're busy."

### 6C: Micro-Emotions (In-Product Moments)

| Moment | Target Feeling | How We Deliver It |
|--------|---------------|-------------------|
| Opening the app | Calm, oriented | Clean dashboard. Today's priorities. No clutter. |
| Reviewing AI-generated content | Impressed, trusting | Content that sounds like them. Not perfect -- but close enough to refine quickly. |
| Approving a post | Satisfying, effortless | One tap. Subtle confirmation. Done. |
| Seeing a post perform well | Proud, validated | "Your post reached 1,200 people -- your best this month." |
| Seeing a post underperform | Curious, not discouraged | "This post didn't resonate. Here's what I'd try differently next time." |
| Receiving a recommendation | Respected, not lectured | "Based on your audience's behavior, I'd suggest..." (not "You should...") |
| Hitting a limit | Clear on value, not frustrated | "You've used 50 of 50 posts this month. Upgrade for unlimited, or I'll prioritize your best-performing content types." |
| Encountering an error | Informed, not abandoned | "Instagram's API is temporarily down. Your post is queued and will publish as soon as it's back." |

---

## 7. FEATURE NAMING CONVENTIONS

### 7A: Naming Philosophy

Feature names must be:
1. **Plain English** -- A non-marketer should understand what it does from the name alone
2. **Short** -- 1-2 words maximum
3. **Concrete** -- Names describe what you see or do, not abstract concepts
4. **Consistent** -- Follow the same grammatical pattern

**Pattern:** Noun (what it is) or Verb + Noun (what you do with it)

### 7B: Core Feature Names

| Feature | Name | NOT This |
|---------|------|----------|
| AI conversational onboarding | **Strategy Session** | "AI Onboarding Wizard" / "Setup Flow" |
| Daily content view | **Calendar** | "Content Hub" / "Publishing Center" |
| AI-generated posts awaiting review | **Drafts** | "AI Content Queue" / "Pending Approvals" |
| Performance metrics | **Results** | "Analytics Dashboard" / "Insights Engine" |
| AI recommendations | **Recommendations** | "AI Insights" / "Smart Suggestions" |
| Social account connections | **Accounts** | "Integrations" / "Connected Platforms" |
| Brand voice settings | **Voice** | "Brand Kit" / "Tone Settings" |
| Content categories/themes | **Topics** | "Content Pillars" / "Themes Engine" |
| Audience information | **Audience** | "Target Personas" / "Customer Profiles" |
| Billing and subscription | **Plan** | "Subscription Management" / "Billing Center" |
| Team/collaborator access | **Team** | "Workspace" / "Collaborators" |

### 7C: Naming Rules

1. **Never name a feature after the technology behind it.** "Drafts" not "AI-Generated Content." The user doesn't care that AI made it; they care that it's ready for their review.

2. **Never use compound nouns.** "Calendar" not "Content Calendar" in the navigation. The context makes it clear.

3. **Navigation items are one word.** Calendar. Drafts. Results. Accounts. Voice. Plan.

4. **Section headers can be two words.** "Weekly summary." "Top posts." "Recent activity."

5. **Action labels are verbs.** Approve. Edit. Schedule. Connect. Remove. Not "Approval" or "Connection."

6. **Status labels are adjectives or past participles.** Published. Scheduled. Draft. Failed. Pending.

7. **Never version feature names.** No "Calendar 2.0" or "New Results." If the feature improves, it improves silently.

### 7D: AI Personification Rules

The AI within PrinceMarketing is not named. It is not "Prince" or "Marky" or any character. It is simply the platform speaking in first person.

- "I generated 5 posts for this week" -- correct
- "Prince has generated 5 posts" -- incorrect
- "Your AI assistant generated 5 posts" -- incorrect

The AI is the product. The product is the AI. There is no separation.

If we ever introduce a name (TBD), it must:
- Be a real name, not a portmanteau or acronym
- Have no pun or cleverness
- Sound like someone you'd hire, not a cartoon character

---

## 8. VISUAL UNIVERSE

### 8A: Layout Principles

**The Dashboard Grid:**
```
+--sidebar--+--------------------main---------------------+
|            |                                              |
| Navigation |  [Page Title]                                |
|            |                                              |
| Calendar   |  +--card--+  +--card--+  +--card--+        |
| Drafts     |  |        |  |        |  |        |        |
| Results    |  |        |  |        |  |        |        |
| Accounts   |  +--------+  +--------+  +--------+        |
| Voice      |                                              |
| Topics     |  +--card (full width)--------------------+  |
| Audience   |  |                                        |  |
|            |  +----------------------------------------+  |
| ---        |                                              |
| Plan       |                                              |
| Settings   |                                              |
+------------+----------------------------------------------+
```

**Rules:**
- Sidebar is always visible on desktop. Collapsible on tablet. Bottom nav on mobile.
- Main content area never exceeds 1280px width. Centered with equal margins on ultrawide.
- Cards have 1px border (`#2A2A2A`), 16px padding, 8px border-radius. No shadows.
- Maximum 3 columns on desktop. 2 on tablet. 1 on mobile. Never 4.

### 8B: Component Signatures

**Buttons:**
- Primary: Royal (`#6366F1`) background, white text, 8px radius, 40px height, 600 weight
- Secondary: Transparent background, `#F5F5F5` text, 1px `#2A2A2A` border, 8px radius
- Destructive: Transparent background, Coral (`#EF4444`) text, 1px Coral border
- Disabled: `#1E1E1E` background, `#6B6B6B` text
- No gradients. No shadows. No icons-only buttons (except close/X).

**Inputs:**
- Height: 40px
- Background: `#141414`
- Border: 1px `#2A2A2A`, on focus: 1px Royal (`#6366F1`)
- Text: `#F5F5F5`
- Placeholder: `#6B6B6B`
- Label above, never inside (no floating labels)
- Border-radius: 8px

**Cards:**
- Background: `#141414`
- Border: 1px `#2A2A2A`
- Border-radius: 12px
- Padding: 20px
- No shadow. Elevation is communicated through background color stepping, not shadows.

**The AI Chat Interface (Onboarding + Strategy Sessions):**
- Full-width layout, no sidebar
- AI messages: left-aligned, `#141414` background bubble, 12px radius
- User messages: right-aligned, Royal (`#6366F1`) background bubble, white text
- Typing indicator: three dots (`#6B6B6B`) with sequential opacity animation (0.3 -> 1.0, 200ms stagger)
- Input at bottom: full-width, 48px height, auto-grow to max 120px

### 8C: Data Visualization

**Chart palette (in order of use):**
1. Royal `#6366F1`
2. Cyan `#06B6D4`
3. Mint `#10B981`
4. Amber `#F59E0B`
5. Coral `#EF4444`
6. `#8B5CF6` (violet, for 6th series)

**Rules:**
- Line charts for trends over time. Area fill at 10% opacity.
- Bar charts for comparisons. Rounded top corners (4px).
- No pie charts. Ever. Use horizontal bar charts for proportions.
- No 3D. No decorative gridlines. Minimal axis labels.
- All charts use JetBrains Mono for numbers.
- Tooltips on hover: `#1E1E1E` background, `#F5F5F5` text, 8px radius, 8px padding.

### 8D: Content Calendar Visual Design

The Calendar is the product's centerpiece. It gets extra design attention:

**Weekly view (default):**
```
Mon        Tue        Wed        Thu        Fri        Sat        Sun
+--------+ +--------+ +--------+ +--------+ +--------+ +--------+ +--------+
|  IG    | | IG     | |        | | IG     | |        | | IG     | |        |
| [img]  | | [img]  | |        | | [img]  | |        | | [img]  | |        |
| 10:00a | | 11:00a | |        | | 10:00a | |        | | 9:00a  | |        |
| Draft  | | Sched. | |        | | Sched. | |        | | Publd. | |        |
+--------+ +--------+ +--------+ +--------+ +--------+ +--------+ +--------+
|  LI    | |        | | LI     | |        | | LI     | |        | |        |
| [img]  | |        | | [img]  | |        | | [img]  | |        | |        |
| 8:00a  | |        | | 8:00a  | |        | | 8:00a  | |        | |        |
| Sched. | |        | | Sched. | |        | | Draft  | |        | |        |
+--------+ +--------+ +--------+ +--------+ +--------+ +--------+ +--------+
```

**Status indicators:**
- Draft: Amber left border (4px)
- Scheduled: Royal left border
- Published: Mint left border
- Failed: Coral left border

**Each content card shows:** Platform icon, thumbnail, time, status badge. Tap to expand full preview.

---

## 9. PRODUCTION PIPELINE

### 9A: Architecture Overview

```
User <──> PrinceMarketing.com (Next.js 15 + Hono)
                    |
                    ├── PostgreSQL + Prisma (data)
                    ├── Claude API (strategy, content generation, recommendations)
                    └── PrinceMarketing.ai APIs (creative asset generation)
                              |
                              ├── Image generation
                              ├── Video generation
                              ├── Ad copy optimization
                              └── Brand asset creation
```

### 9B: Content Generation Pipeline

```
1. STRATEGY  ─── Claude AI analyzes business, audience, competitors
                  Output: Content strategy + topic calendar
                  
2. CREATION  ─── Claude generates copy + .ai generates visuals
                  Output: Complete post drafts with media
                  
3. REVIEW    ─── User approves, edits, or rejects
                  Output: Approved content queue
                  
4. PUBLISH   ─── Platform APIs post at optimal times
                  Output: Live content across platforms
                  
5. MEASURE   ─── Platform APIs pull performance data
                  Output: Analytics + AI recommendations
                  
6. REFINE    ─── AI adjusts strategy based on performance
                  Output: Improved next-cycle strategy
                  
(Loop back to Step 1)
```

### 9C: Marketing Site Production

For marketing site visuals, landing pages, and promotional content:

| Element | Tool |
|---------|------|
| Product screenshots | Figma exports from live app |
| Customer photography | Real photos, professionally shot |
| Hero animations | CSS/Framer Motion -- no video backgrounds |
| Social proof | Live data from customer accounts (with permission) |
| Blog/content | Claude API for drafts, human editing |

### 9D: Video Engine (Marketing/Promotional Content)

All video assets for PrinceMarketing's own marketing use **Veo 3.1** exclusively:
- `veo_text_to_video` -- product demo clips, testimonial b-roll
- `veo_image_to_video` -- animate product screenshots
- `veo_interpolate` -- smooth transitions for launch videos
- `veo_reference_images` -- consistent brand presence across clips

---

## 10. QUALITY STANDARDS

### 10A: Product Quality Scoring

Every feature, screen, and interaction is evaluated on these criteria:

| # | Category | What It Measures | Min Score |
|---|----------|------------------|-----------|
| 1 | **Clarity** | Can the user understand what to do in under 3 seconds? | 8/10 |
| 2 | **Speed** | Does the interface respond in under 200ms? Does the AI respond in under 5s? | 8/10 |
| 3 | **Accuracy** | Is the AI-generated content relevant, on-brand, and factually correct? | 9/10 |
| 4 | **Visual Polish** | Does it match the Bible's design specs exactly? | 9/10 |
| 5 | **Voice Consistency** | Does all copy follow the voice and tone guidelines? | 9/10 |
| 6 | **Accessibility** | WCAG 2.1 AA compliance. Keyboard navigation. Screen reader support. | 8/10 |
| 7 | **Mobile Experience** | Full functionality on mobile, not a degraded desktop layout. | 8/10 |
| 8 | **Error Handling** | Every error state has a clear message and recovery path. | 9/10 |
| 9 | **Onboarding Effectiveness** | Does a new user reach their first approved content within 15 minutes? | 8/10 |
| 10 | **Brand Alignment** | Does this feel like PrinceMarketing? Premium, minimal, powerful? | 9/10 |
| 11 | **Personalization Depth** | Does the AI output feel specific to THIS user's business? | 9/10 |
| 12 | **Time Efficiency** | Can the user complete their daily marketing tasks in under 10 minutes? | 8/10 |

### 10B: Content Quality Standards

Every piece of AI-generated content must pass:

1. **Relevance check:** Is this about the user's actual business?
2. **Voice check:** Would the user plausibly have written this?
3. **Platform check:** Is this formatted correctly for the target platform (character limits, hashtag conventions, image ratios)?
4. **Timing check:** Is this appropriate for the current season, day, and cultural moment?
5. **Originality check:** Is this substantially different from the user's last 10 posts?

Content that fails any check is regenerated before reaching the user's Drafts.

### 10C: Performance Benchmarks

| Metric | Target |
|--------|--------|
| Time to first value (signup to first approved post) | Under 15 minutes |
| Daily active time in app | Under 10 minutes |
| Content approval rate (approved vs. rejected) | Above 80% by Month 2 |
| User-edited content rate | Below 30% by Month 3 (AI should be learning) |
| Churn rate | Below 5% monthly |
| NPS | Above 50 |

---

## APPENDIX A: ARCHETYPE REFERENCE

**The Silent Strategist**
*"The one who sees the whole board and moves your pieces for you."*

| Attribute | Detail |
|-----------|--------|
| Archetype | The Silent Strategist (Sage-King hybrid) |
| Mode 1 | The Strategist -- analytical, listening, planning |
| Mode 2 | The Commander -- decisive, executing, delivering |
| Medusa Effect | The first time AI-generated content sounds exactly like the user's business |
| Limerence Trigger | The Content Calendar -- the daily ritual of checking what's been handled |
| Emotional promise | "You have a marketing department now." |
| Cultural refs | Stripe, Linear, Apple, the CMO you can't afford |

---

## APPENDIX B: TIER STRUCTURE (Framework -- Pricing TBD)

| Tier | Name | Target User | Key Differentiators |
|------|------|-------------|---------------------|
| 1 | **Starter** | Marcus (tradesperson) | 3 platforms, 30 posts/month, core AI strategy |
| 2 | **Growth** | Priya (creator) | 5 platforms, unlimited posts, advanced analytics, A/B testing |
| 3 | **Pro** | David (consultant) | All platforms, team seats, white-label reports, API access, priority AI |

**No free tier.** The product's value proposition is the AI strategy -- giving that away for free devalues the entire positioning. A free trial (14 days) replaces the free tier.

---

## APPENDIX C: TECHNICAL SPECIFICATIONS

### Stack
- **Frontend:** Next.js 15 (App Router, SSR for SEO on marketing pages, CSR for dashboard)
- **Backend API:** Hono (lightweight, edge-compatible)
- **Database:** PostgreSQL + Prisma ORM
- **AI Engine:** Claude API (primary), PrinceMarketing.ai APIs (creative assets)
- **Deployment:** Hostinger VPS, Ubuntu 24.04, Nginx reverse proxy
- **Auth:** NextAuth.js (email + Google OAuth)
- **Payments:** Stripe (naturally)

### Key Technical Principles
1. **SSR for marketing pages** -- SEO is critical for organic acquisition
2. **CSR for the dashboard** -- performance and interactivity matter more than SEO behind the login
3. **API-first design** -- every feature works through the Hono API, enabling future mobile apps and integrations
4. **Edge-compatible** -- Hono's edge runtime support allows future CDN-level API caching
5. **AI responses stream** -- all Claude API calls use streaming for perceived speed

---

## APPENDIX D: HUMAN-CENTRIC DESIGN CHECKLIST

Every feature must pass this checklist before shipping:

- [ ] **Empathy validated:** Have we talked to real users who match our personas about this feature?
- [ ] **Pain point addressed:** Does this solve a problem users articulated, or are we building for ourselves?
- [ ] **Cognitive load minimized:** Does this add decisions to the user's day, or remove them?
- [ ] **Time respected:** Does this save the user time compared to their current process?
- [ ] **Dignity preserved:** Does this make the user feel capable, not inadequate?
- [ ] **Feedback incorporated:** Is there a mechanism for the user to tell us this isn't working?
- [ ] **Graceful degradation:** If the AI fails, what does the user see? Is it acceptable?
- [ ] **Accessibility included:** Can someone with a screen reader use this? Keyboard only?
- [ ] **Mobile considered:** Was this designed mobile-first, or is mobile an afterthought?
- [ ] **Voice consistent:** Does every string in this feature match Section 2 of this Bible?

---

*This Bible is the source of truth. Every design decision, every line of copy, every feature scope, and every pixel must trace back to this document. If it contradicts the Bible, the Bible wins -- or the Bible gets updated with team consensus.*

*Last updated: 2026-03-31*
*Author: LaDonte Prince + Claude (The Silent Strategist)*
