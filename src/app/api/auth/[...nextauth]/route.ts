import { handlers } from "@/lib/auth";

// WHY: NextAuth v5 route handler. Exports GET and POST for the /api/auth/* routes.
export const { GET, POST } = handlers;
