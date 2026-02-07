import React, { useState } from 'react';
import { Lock, X, Loader2 } from 'lucide-react';
import {
  generateAuthToken,
  storeAuthToken,
} from '../lib/adminAuth';
import { verifyTotpCode, isTotpEnabled } from '../lib/totp';

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

  const handleLoginSubmit = async (e: React.FormEvent) => {
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
    <div className="min-h-screen flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Lock size={20} className="text-green-500" />
          </div>
          <h3 className="text-lg font-semibold">
            {showTotpInput ? 'Two-Factor Auth' : 'Admin Access'}
          </h3>
        </div>

        <form onSubmit={handleLoginSubmit}>
          {!showTotpInput ? (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-green-500 outline-none mb-3"
              autoFocus
            />
          ) : (
            <div className="mb-3">
              <p className="text-sm text-zinc-400 mb-2">
                Enter the code from your authenticator app
              </p>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-green-500 outline-none text-center text-xl tracking-widest"
                autoFocus
                pattern="\d{6}"
                inputMode="numeric"
              />
            </div>
          )}
          {passwordError && (
            <p className="text-red-400 text-sm mb-3">{passwordError}</p>
          )}
          <button
            type="submit"
            disabled={verifying || (!showTotpInput && !password) || (showTotpInput && totpCode.length !== 6)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-black font-semibold rounded-lg hover:bg-green-400 transition-colors disabled:opacity-50"
          >
            {verifying ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Verifying...
              </>
            ) : (
              showTotpInput ? 'Verify Code' : 'Unlock'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
