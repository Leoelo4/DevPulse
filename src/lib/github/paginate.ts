/**
 * Bounded pagination. GitHub lists can be arbitrarily long and every page costs rate limit, so each
 * dataset has an explicit cap. The result says whether the cap cut the list short, which the UI
 * surfaces as a "partial view" notice instead of silently under-counting.
 */

/** The minimal Octokit shape needed here, so tests can supply a fake. */
export interface PaginatingClient {
  paginate: {
    iterator(
      route: string,
      parameters?: Record<string, unknown>,
    ): AsyncIterable<{ data: unknown; headers: Record<string, string | number | undefined> }>;
  };
}

export interface PaginatedResult {
  items: unknown[];
  /** `false` when more pages existed than the cap allowed. */
  complete: boolean;
  pagesFetched: number;
}

/** Whether a response's `Link` header advertises a next page. */
export function hasNextPage(linkHeader: string | number | undefined): boolean {
  return typeof linkHeader === "string" && /<[^>]+>;\s*rel="next"/.test(linkHeader);
}

export async function fetchPaginated(
  client: PaginatingClient,
  route: string,
  parameters: Record<string, unknown>,
  limits: { maxPages: number },
): Promise<PaginatedResult> {
  const items: unknown[] = [];
  let pagesFetched = 0;
  let complete = true;

  for await (const response of client.paginate.iterator(route, { per_page: 100, ...parameters })) {
    pagesFetched += 1;
    if (Array.isArray(response.data)) items.push(...response.data);
    else if (response.data !== undefined && response.data !== null) {
      throw new TypeError(`Expected a list response from ${route}`);
    }

    if (pagesFetched >= limits.maxPages) {
      complete = !hasNextPage(response.headers.link);
      break;
    }
  }

  return { items, complete, pagesFetched };
}
