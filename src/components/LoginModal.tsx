import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AUTH_KEY = "lc_auth";
const VALID_USER = "admin";
const VALID_PASS = "admin@123";

export function isLoggedIn() {
  return localStorage.getItem(AUTH_KEY) === "1";
}

export function LoginModal({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === VALID_USER && password === VALID_PASS) {
      localStorage.setItem(AUTH_KEY, "1");
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="bg-card border rounded-xl shadow-xl p-8 w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-xl font-semibold">Lucky Communities</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access the upload tool
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lc-username">Username</Label>
            <Input
              id="lc-username"
              type="text"
              value={username}
              autoComplete="username"
              autoFocus
              onChange={(e) => {
                setUsername(e.target.value);
                setError(false);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lc-password">Password</Label>
            <Input
              id="lc-password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">
              Invalid username or password.
            </p>
          )}

          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
