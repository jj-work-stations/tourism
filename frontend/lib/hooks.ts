"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, ApiError } from "./api";
import { useAuth } from "./auth-store";

type Query = Record<string, string | number | boolean | null | undefined>;

/** Authenticated query that only runs once the persisted session is hydrated. */
export function useApiQuery<T>(
  key: readonly unknown[],
  path: string,
  query?: Query,
  options: { enabled?: boolean; retry?: boolean } = {},
) {
  const hydrated = useAuth((state) => state.hydrated);
  const hasToken = useAuth((state) => Boolean(state.tokens?.access_token));
  return useQuery<T>({
    queryKey: key,
    queryFn: () => api.get<T>(path, query, true),
    enabled: hydrated && hasToken && (options.enabled ?? true),
    retry: options.retry ?? false,
  });
}

export function useApiMutation<TBody, TResult>(
  mutation: (body: TBody) => Promise<TResult>,
  options: {
    successMessage?: string;
    onSuccess?: (result: TResult) => void;
    invalidate?: readonly unknown[][];
  } = {},
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TBody>({
    mutationFn: mutation,
    onSuccess: async (result) => {
      if (options.successMessage) toast.success(options.successMessage);
      for (const key of options.invalidate ?? []) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
      options.onSuccess?.(result);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "انجام درخواست ممکن نشد.");
    },
  });
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "خطای غیرمنتظره رخ داد.";
}
