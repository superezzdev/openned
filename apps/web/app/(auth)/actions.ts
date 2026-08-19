'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth } from '@/lib/firebase/server'
import { supabaseDb } from '@/lib/supabase/database'

export async function createSession(idToken: string) {
  const expiresIn = 60 * 60 * 24 * 5 * 1000 // 5 days

  try {
    // 1. Verify token to get user info
    const decodedToken = await adminAuth.verifyIdToken(idToken)
    
    // 2. Sync user to Supabase Database
    const { error: dbError } = await supabaseDb.from('users').upsert({
      id: decodedToken.uid,
      email: decodedToken.email,
    })

    if (dbError) {
      console.error('Failed to sync user to Supabase:', dbError)
      // We don't fail the login if the sync fails, but we log it
    }

    // 3. Create Firebase Session Cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })
    const cookieStore = await cookies()
    cookieStore.set('session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    })
  } catch (error) {
    console.error('Error creating session:', error)
    return { error: 'Failed to create session' }
  }

  redirect('/dashboard')
}

export async function removeSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value

  if (session) {
    try {
      const decodedClaims = await adminAuth.verifySessionCookie(session)
      await adminAuth.revokeRefreshTokens(decodedClaims.sub)
    } catch (error) {
      console.error('Error revoking session:', error)
    }
    cookieStore.delete('session')
  }

  redirect('/login')
}
