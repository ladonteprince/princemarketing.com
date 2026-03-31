// Branded ID types for compile-time safety
// WHY: Prevents accidentally passing a CampaignId where a UserId is expected

declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type UserId = Brand<string, "UserId">;
export type CampaignId = Brand<string, "CampaignId">;
export type ChatSessionId = Brand<string, "ChatSessionId">;
export type MessageId = Brand<string, "MessageId">;
export type CalendarEntryId = Brand<string, "CalendarEntryId">;
export type PlatformId = Brand<string, "PlatformId">;
export type AnalyticsId = Brand<string, "AnalyticsId">;
export type SessionId = Brand<string, "SessionId">;

// Helper to cast raw strings into branded types
export function asUserId(id: string): UserId {
  return id as UserId;
}

export function asCampaignId(id: string): CampaignId {
  return id as CampaignId;
}

export function asChatSessionId(id: string): ChatSessionId {
  return id as ChatSessionId;
}

export function asCalendarEntryId(id: string): CalendarEntryId {
  return id as CalendarEntryId;
}
