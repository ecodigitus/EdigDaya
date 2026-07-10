import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/** Thin react-query wrapper over the fetch helper. */
export function useApi<T>(key: (string | number | null | undefined)[], path: string, enabled = true) {
  return useQuery<T>({
    queryKey: key,
    queryFn: ({ signal }) => api<T>(path, { signal }),
    enabled,
  });
}
