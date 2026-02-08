import React, { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import {
  generateAuthToken,
  storeAuthToken,
} from '../lib/adminAuth';
import { verifyTotpCode, isTotpEnabled } from '../lib/totp';
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

// SHA-256 hash function
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showTotpInput, setShowTotpInput] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const completeLogin = async () => {
    const expectedHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH || '';
    const token = await generateAuthToken(expectedHash);
    storeAuthToken(token);
    setPassword('');
    setTotpCode('');
    setShowTotpInput(false);
    onLoginSuccess();
  };

  const handleLoginSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setVerifying(true);
    setPasswordError('');

    try {
      if (!showTotpInput) {
        const hashedPassword = await sha256(password);
        const expectedHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH || '';

        if (hashedPassword === expectedHash.toLowerCase()) {
          if (isTotpEnabled()) {
            setShowTotpInput(true);
            setVerifying(false);
            return;
          }
          await completeLogin();
        } else {
          setPasswordError('Incorrect password');
        }
      } else {
        if (await verifyTotpCode(totpCode)) {
          await completeLogin();
        } else {
          setPasswordError('Invalid authentication code');
        }
      }
    } catch (err) {
      setPasswordError('Verification failed');
    } finally {
      if (!showTotpInput || (showTotpInput && passwordError)) {
        setVerifying(false);
      }
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          {/* Logo/Brand */}
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">
              {showTotpInput
                ? 'Enter your two-factor authentication code'
                : 'Enter your password to continue'
              }
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            {!showTotpInput ? (
              <div className="grid gap-2">
                <Label htmlFor="password" className="sr-only">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoFocus
                  required
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="totp" className="sr-only">Authentication Code</Label>
                <Input
                  id="totp"
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Code"
                  autoFocus
                  pattern="\d{6}"
                  inputMode="numeric"
                  maxLength={6}
                  className="text-center text-lg tracking-widest font-mono"
                  required
                />
                <p className="text-[0.8rem] text-muted-foreground text-center">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
            )}

            {passwordError && (
              <div className="text-sm text-destructive text-center">
                {passwordError}
              </div>
            )}

            <Button
              type="submit"
              disabled={verifying || (!showTotpInput && !password) || (showTotpInput && totpCode.length !== 6)}
              className="w-full"
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                showTotpInput ? 'Verify' : 'Sign in'
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Secure
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Lock className="size-3" />
            <span>Powered by Contentful</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
