import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import HeaderBar from '../HeaderBar'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
    },
  },
}))

describe('HeaderBar password setup', () => {
  it('keeps save disabled until the password requirements and confirmation are met', async () => {
    render(
      <HeaderBar
        user={{
          email: 'new.user@example.com',
          initials: 'NU',
          name: 'New User',
          passwordSet: false,
        }}
      />
    )

    const saveButton = await screen.findByRole('button', { name: /save password/i })
    const newPasswordInput = screen.getByLabelText(/new password/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

    expect(saveButton).toBeDisabled()

    fireEvent.change(newPasswordInput, { target: { value: 'short' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'short' } })

    expect(saveButton).toBeDisabled()
    expect(screen.getByText(/need contains an uppercase letter/i)).toBeInTheDocument()

    fireEvent.change(newPasswordInput, { target: { value: 'StrongPass1!' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPass1!' } })

    expect(screen.getByText(/strong/i)).toBeInTheDocument()
    expect(screen.getByText(/ok passwords match/i)).toBeInTheDocument()
    expect(saveButton).toBeEnabled()
  })
})