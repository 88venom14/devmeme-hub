import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

// Single source of truth for auth session.
// Avoids multiple useSession() subscriptions across the tree.
const SessionContext = createContext<Session | null>(null);

export const useSessionContext = () => useContext(SessionContext);

export { SessionContext };
