"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpInput } from "@/lib/validation/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signUpAction } from "@/features/auth/actions";

export function SignUpForm() {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema) });

  const onSubmit = async (values: SignUpInput) => {
    setFormError(null);
    // On success without email confirmation this redirects server-side
    // and never returns here.
    const result = await signUpAction(values);
    if (!result.ok) {
      setFormError(result.error ?? "Something went wrong. Try again.");
      return;
    }
    if (result.needsEmailConfirmation) {
      setNeedsEmailConfirmation(true);
    }
  };

  if (needsEmailConfirmation) {
    return (
      <div className="mt-8 rounded-md border border-line bg-stone-panel px-5 py-5">
        <p className="text-body-sm text-ink">Check your email to confirm your account.</p>
        <p className="mt-1.5 text-body-sm text-ink-muted">
          We&rsquo;ve sent a confirmation link — once you click it you can log in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="name" className="text-body-sm text-ink-soft">
          Name
        </label>
        <Input id="name" className="mt-1.5" autoComplete="name" {...register("name")} />
        {errors.name && <p className="mt-1.5 text-meta text-signal-error">{errors.name.message}</p>}
      </div>
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
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="mt-1.5 text-meta text-signal-error">{errors.password.message}</p>
        )}
      </div>
      {formError && <p className="text-body-sm text-signal-error">{formError}</p>}
      <Button type="submit" variant="accent" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
