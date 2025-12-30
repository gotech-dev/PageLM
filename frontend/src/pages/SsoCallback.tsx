import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * SSO Callback Page
 * Nhận JWT token từ PageLM backend và lưu vào localStorage
 * Sau đó redirect đến target page
 */
export default function SsoCallback() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [status, setStatus] = useState('Đang xử lý đăng nhập...')

    useEffect(() => {
        const token = searchParams.get('token')
        const redirect = searchParams.get('redirect') || '/'

        if (!token) {
            setStatus('Lỗi: Không tìm thấy token')
            setTimeout(() => navigate('/login'), 2000)
            return
        }

        try {
            // Lưu token vào localStorage (key phải là 'auth_token' để khớp với App.tsx)
            localStorage.setItem('auth_token', token)

            // Decode token để lấy user info (không verify, chỉ display)
            const payload = JSON.parse(atob(token.split('.')[1]))
            console.log('[SSO] Logged in as:', payload.email)

            setStatus(`Đăng nhập thành công! Đang chuyển hướng...`)

            // Redirect sau 500ms để user thấy success message
            setTimeout(() => {
                // Xóa query params và chuyển đến target
                navigate(redirect, { replace: true })
            }, 500)

        } catch (error) {
            console.error('[SSO] Error processing token:', error)
            setStatus('Lỗi xử lý token. Đang chuyển về trang đăng nhập...')
            setTimeout(() => navigate('/login'), 2000)
        }
    }, [searchParams, navigate])

    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="text-center p-8 rounded-2xl bg-stone-900/50 border border-zinc-800">
                <div className="w-12 h-12 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-white text-lg font-medium">{status}</p>
                <p className="text-stone-400 text-sm mt-2">Vui lòng đợi...</p>
            </div>
        </div>
    )
}
