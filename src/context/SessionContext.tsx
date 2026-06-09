import { createContext, useContext } from 'react';
import type { AppSession } from '../lib/api';

// Single source of truth for auth session.
// Avoids multiple useSession() subscriptions across the tree.
const SessionContext = createContext<AppSession | null>(null);

export const useSessionContext = () => useContext(SessionContext);

export { SessionContext };
