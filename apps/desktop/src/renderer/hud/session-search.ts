import type { SessionSummary } from "@iris/contracts";

import { MAX_LOCAL_SEARCH_QUERY_LENGTH, normalizeLocalSearchText } from "../local-search.js";

const DEFAULT_SESSION_RESULT_LIMIT = 5;
const MAX_SESSION_RESULT_LIMIT = 12;

function matchesPublicFields(session: SessionSummary, query: string): boolean {
  const searchable = [session.title, session.engine ?? "", session.model ?? ""]
    .map((value) => normalizeLocalSearchText(value));
  const terms = query.split(" ").filter(Boolean);
  return terms.every((term) => searchable.some((value) => value.includes(term)));
}

export function searchPublicSessions(
  sessions: readonly SessionSummary[],
  rawQuery: string,
  resultLimit = DEFAULT_SESSION_RESULT_LIMIT,
): readonly SessionSummary[] {
  const query = normalizeLocalSearchText(rawQuery, MAX_LOCAL_SEARCH_QUERY_LENGTH);
  if (!query) return [];
  const limit = Math.max(1, Math.min(MAX_SESSION_RESULT_LIMIT, resultLimit));
  return sessions.filter((session) => matchesPublicFields(session, query)).slice(0, limit);
}
