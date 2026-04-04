import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { WeekView } from "@/components/calendar/WeekView";

export const metadata: Metadata = {
  title: "Content Calendar",
};

export default function CalendarPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header
        title="Content calendar"
        subtitle="Your week at a glance — approve, edit, or reschedule with a tap."
      />
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <WeekView />
      </div>
    </div>
  );
}
