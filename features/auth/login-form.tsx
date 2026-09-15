"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginAction } from "@/features/auth/actions";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    // On success this throws Next's internal redirect signal and never
    // returns here — only the failure path reaches the lines below.
    const result = await loginAction(values, redirectTo);
    if (!result.ok) {
      setFormError(result.error ?? "Something went wrong. Try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="text-body-sm text-ink-soft">
          Email
        </label>
        <Input
          id="email"
          type="email"
          className="mt-1.5"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email && <p className="mt-1.5 text-meta text-signal-error">{errors.email.message}</p>}
      </div>
      <div>
        <label htmlFor="password" className="text-body-sm text-ink-soft">
          Password
        </label>
        <Input
          id="password"
          type="password"
          className="mt-1.5"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="mt-1.5 text-meta text-signal-error">{errors.password.message}</p>
        )}
      </div>
      {formError && <p className="text-body-sm text-signal-error">{formError}</p>}
      <Button type="submit" variant="accent" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
