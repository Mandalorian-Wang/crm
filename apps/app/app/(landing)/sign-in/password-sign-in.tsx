"use client";

import { authClient } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { type FormEvent, useState } from "react";

export function PasswordSignIn({ emailDomain }: { emailDomain: string }) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			const name = username.trim().toLowerCase();
			const result = await authClient.signIn.email({
				email: name.includes("@") ? name : `${name}@${emailDomain}`,
				password,
			});
			if (result.error) {
				setError("Username or password is incorrect.");
				return;
			}
			window.location.assign("/");
		} catch {
			setError("Sign-in is unavailable. Please try again.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<form onSubmit={submit}>
			<FieldGroup>
				<Field data-disabled={busy} data-invalid={Boolean(error)}>
					<FieldLabel htmlFor="username">Username</FieldLabel>
					<Input
						id="username"
						autoComplete="username"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						required
						disabled={busy}
						aria-invalid={Boolean(error)}
					/>
				</Field>
				<Field data-disabled={busy} data-invalid={Boolean(error)}>
					<FieldLabel htmlFor="password">Password</FieldLabel>
					<Input
						id="password"
						type="password"
						autoComplete="current-password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						disabled={busy}
						aria-invalid={Boolean(error)}
					/>
				</Field>
				{error ? <FieldError>{error}</FieldError> : null}
				<Button type="submit" disabled={busy}>
					{busy ? "Signing in…" : "Sign in"}
				</Button>
			</FieldGroup>
		</form>
	);
}
