import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LoginPage from '../LoginPage'

const { resetPasswordForEmail } = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn() }))

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      resetPasswordForEmail,
    },
  },
}))

describe('LoginPage', () => {
  beforeEach(() => {
    resetPasswordForEmail.mockReset()
  })

  it('sends a password setup email', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null })

    render(<LoginPage onSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'established.user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /set or reset password/i }))

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        'established.user@example.com',
        { redirectTo: window.location.origin }
      )
    })

    expect(screen.getByRole('status')).toHaveTextContent(/password setup email sent/i)
  })
})