import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { WeekView } from "@/components/calendar/WeekView";

export const metadata: Metadata = {
  title: "Content Calendar",
};

export default function CalendarPage() {
  return (
    <div className="flex flex-col">
      <Header
        title="Content calendar"
        subtitle="Your week at a glance. Approve, edit, or reschedule."
      />
      <div className="flex-1 px-6 py-6">
        <WeekView />
      </div>
    </div>
  );
}
