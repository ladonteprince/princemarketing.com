"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  User,
  Building2,
  CreditCard,
  Link2,
  Instagram,
  Facebook,
  Linkedin,
} from "lucide-react";

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    // Simulate save
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
  }

  return (
    <div className="flex flex-col">
      <Header title="Settings" subtitle="Manage your account and connections" />

      <div className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Profile */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <User size={18} strokeWidth={1.5} className="text-royal" />
              <h2 className="text-base font-semibold text-cloud">Profile</h2>
            </div>

            <div className="space-y-4">
              <Input
                label="Full name"
                defaultValue="Marcus Rodriguez"
                placeholder="Your name"
              />
              <Input
                label="Email"
                type="email"
                defaultValue="marcus@rodriguezplumbing.com"
                placeholder="you@business.com"
              />
            </div>
          </Card>

          {/* Business info */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <Building2 size={18} strokeWidth={1.5} className="text-royal" />
              <h2 className="text-base font-semibold text-cloud">Business</h2>
            </div>

            <div className="space-y-4">
              <Input
                label="Business name"
                defaultValue="Rodriguez Plumbing"
                placeholder="Your business name"
              />
              <Input
                label="Industry"
                defaultValue="Home Services"
                placeholder="e.g. Bakery, Fitness, Consulting"
              />
            </div>
          </Card>

          {/* Connected platforms */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <Link2 size={18} strokeWidth={1.5} className="text-royal" />
              <h2 className="text-base font-semibold text-cloud">
                Connected platforms
              </h2>
            </div>

            <div className="space-y-3">
              {[
                {
                  name: "Instagram",
                  icon: Instagram,
                  handle: "@rodriguezplumbing",
                  connected: true,
                },
                {
                  name: "Facebook",
                  icon: Facebook,
                  handle: "Rodriguez Plumbing",
                  connected: true,
                },
                {
                  name: "LinkedIn",
                  icon: Linkedin,
                  handle: "Not connected",
                  connected: false,
                },
              ].map((platform) => {
                const Icon = platform.icon;
                return (
                  <div
                    key={platform.name}
                    className="flex items-center justify-between rounded-lg border border-smoke bg-slate px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} strokeWidth={1.5} className="text-ash" />
                      <div>
                        <p className="text-sm font-medium text-cloud">
                          {platform.name}
                        </p>
                        <p className="text-xs text-ash">{platform.handle}</p>
                      </div>
                    </div>
                    {platform.connected ? (
                      <Badge variant="mint">Connected</Badge>
                    ) : (
                      <Button variant="secondary" size="sm">
                        Connect
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Subscription */}
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard size={18} strokeWidth={1.5} className="text-royal" />
              <h2 className="text-base font-semibold text-cloud">
                Subscription
              </h2>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-royal/30 bg-royal-muted/30 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-cloud">Growth Plan</p>
                  <Badge variant="royal">Current</Badge>
                </div>
                <p className="text-xs text-ash">
                  $79/month &middot; 5 platforms &middot; 60 posts/month
                </p>
              </div>
              <Button variant="secondary" size="sm">
                Manage
              </Button>
            </div>
          </Card>

          {/* Save button */}
          <div className="flex justify-end">
            <Button loading={saving} onClick={handleSave}>
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
