import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../lib/LanguageContext'

export default function Login() {
    const { t } = useLanguage()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await fetch('http://localhost:5001/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || t.auth.loginFailed)
            }

            // Save token to localStorage
            localStorage.setItem('auth_token', data.token)
            localStorage.setItem('user', JSON.stringify(data.user))

            // Redirect to chat
            navigate('/chat')
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t.auth.loginFailed;
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
                        PolyPi
                    </h1>
                    <p className="text-stone-400 mt-2">{t.auth.subtitle}</p>
                </div>

                {/* Login Card */}
                <div className="bg-stone-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-bold text-white mb-6">{t.auth.loginTitle}</h2>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-stone-300 text-sm font-medium mb-2">
                                {t.auth.emailLabel}
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                                placeholder={t.auth.emailPlaceholder}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-stone-300 text-sm font-medium mb-2">
                                {t.auth.passwordLabel}
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                                placeholder={t.auth.passwordPlaceholder}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-sky-500 to-emerald-500 text-white font-semibold py-3 rounded-lg hover:from-sky-600 hover:to-emerald-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20"
                        >
                            {loading ? t.auth.loggingIn : t.auth.loginButton}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-stone-500 text-sm mt-6">
                    {t.auth.copyright}
                </p>
            </div>
        </div>
    )
}
