import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * SSO Callback Page
 * Nhận encrypted token từ BGTT và gọi backend để decrypt
 * Backend sẽ tạo user và trả về JWT token
 */
export default function SsoCallback() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [status, setStatus] = useState('Đang xử lý đăng nhập...')

    useEffect(() => {
        const processSSO = async () => {
            console.log('[SSO Callback] Starting SSO process...')
            
            // Get token from query parameters (JWT token from backend after SSO processing)
            let token = searchParams.get('token')
            const redirect = searchParams.get('redirect') || '/'

            console.log('[SSO Callback] Raw token from URL:', token ? 'YES' : 'NO')
            console.log('[SSO Callback] Raw token length:', token?.length || 0)
            console.log('[SSO Callback] Redirect target:', redirect)
            
            // Decode URL-encoded token if needed
            if (token) {
                try {
                    const decodedToken = decodeURIComponent(token)
                    if (decodedToken !== token) {
                        console.log('[SSO Callback] Token was URL-encoded, decoded')
                        token = decodedToken
                        console.log('[SSO Callback] Decoded token length:', token.length)
                    }
                } catch {
                    console.log('[SSO Callback] Token is not URL-encoded or decoding failed')
                }
            }

            if (!token) {
                console.log('[SSO Callback] ERROR: No token found')
                setStatus('Lỗi: Không tìm thấy token')
                setTimeout(() => navigate('/login'), 2000)
                return
            }

            try {
                setStatus('Đang xác thực token...')
                console.log('[SSO Callback] Processing token...')
                
                // Check if this is a JWT token (from backend) or BGTT token
                // JWT tokens have 3 parts (header.payload.signature)
                // BGTT tokens have 2 parts (payload.signature) or sometimes 1 part if URL encoded
                let tokenParts
                try {
                    // First try with the token as-is
                    tokenParts = token.split('.')
                } catch (e) {
                    console.error('[SSO Callback] Error splitting token:', e)
                    throw new Error('Invalid token format')
                }
                
                console.log('[SSO Callback] Token parts count:', tokenParts.length)
                console.log('[SSO Callback] First part length:', tokenParts[0]?.length)
                console.log('[SSO Callback] Second part length:', tokenParts[1]?.length)
                console.log('[SSO Callback] Third part length:', tokenParts[2]?.length)
                console.log('[SSO Callback] First part preview:', tokenParts[0]?.substring(0, 20) + '...')
                
                // JWT tokens have 3 parts and each part should be base64-encoded
                const isJWT = tokenParts.length === 3 && 
                             tokenParts[0].length > 0 && 
                             tokenParts[1].length > 0 && 
                             tokenParts[2].length > 0
                
                // BGTT tokens have 2 parts (payload.signature) or 1 part if malformed
                const isBGTT = tokenParts.length === 2 || (tokenParts.length === 1 && tokenParts[0].length > 100)
                
                console.log('[SSO Callback] Is JWT token:', isJWT)
                console.log('[SSO Callback] Is BGTT token:', isBGTT)
                
                if (isJWT) {
                    console.log('[SSO Callback] JWT token detected, storing and redirecting...')
                    // This is a JWT token from backend - store it and redirect
                    let payload
                    try {
                        payload = JSON.parse(atob(tokenParts[1]))
                    } catch (decodeError) {
                        console.error('[SSO Callback] Error decoding JWT payload:', decodeError)
                        console.log('[SSO Callback] Payload part:', tokenParts[1])
                        throw new Error('Invalid JWT token format')
                    }
                    
                    console.log('[SSO Callback] User email:', payload.email)
                    console.log('[SSO Callback] Credits:', payload.credits || 0)
                    console.log('[SSO Callback] Source:', payload.source)
                    
                    // Store JWT token
                    localStorage.setItem('auth_token', token)
                    console.log('[SSO Callback] Token stored in localStorage')
                    
                    // Verify it was stored
                    const storedToken = localStorage.getItem('auth_token')
                    console.log('[SSO Callback] Token verification:', storedToken ? 'STORED' : 'FAILED')
                    
                    setStatus('Đăng nhập thành công! Đang chuyển hướng...')
                    
                    // Use the redirect path as provided - don't force /app
                    const finalRedirect = redirect
                    console.log('[SSO Callback] Redirect target:', redirect, '-> Final redirect:', finalRedirect)
                    
                    setTimeout(() => {
                        console.log('[SSO Callback] Executing redirect to:', finalRedirect)
                        navigate(finalRedirect, { replace: true })
                    }, 500)
                    return
                } else if (isBGTT) {
                    console.log('[SSO Callback] BGTT token detected, calling backend for processing...')
                    // This is an encrypted token from BGTT - call backend
                    const functionCode = searchParams.get('function_code') || '1'
                    const sourcePlatform = searchParams.get('source_platform') || searchParams.get('platform_code') || 'bgtt'
                    const targetPlatform = searchParams.get('target_platform') || 'study_with_ai'
                    
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'
                    const ssoUrl = `${backendUrl}/auth/sso`

                    const fullUrl = `${ssoUrl}?token=${encodeURIComponent(token)}&function_code=${functionCode}&source_platform=${encodeURIComponent(sourcePlatform)}&target_platform=${encodeURIComponent(targetPlatform)}&redirect=${encodeURIComponent(redirect)}`
                    console.log('[SSO Callback] Redirecting browser to backend SSO URL:', fullUrl)
                    setStatus('Đang chuyển đến máy chủ để xác thực...')
                    window.location.replace(fullUrl)
                    return
                } else {
                    console.log('[SSO Callback] Unknown token format, cannot process')
                    throw new Error('Unknown token format')
                }

            } catch (error) {
                console.error('[SSO] Error processing token:', error)
                setStatus('Lỗi xử lý token. Đang chuyển về trang đăng nhập...')
                setTimeout(() => navigate('/login'), 2000)
            }
        }

        processSSO()
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
