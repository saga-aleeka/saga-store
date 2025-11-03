import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContainerCreateDrawer from '../ContainerCreateDrawer'

vi.stubGlobal('fetch', vi.fn())

describe('ContainerCreateDrawer', () => {
  afterEach(() => { vi.resetAllMocks(); window.location.hash = '' })

  it('posts create and navigates to new container', async () => {
    // @ts-ignore
    fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ data: { id: 42, name: 'New', location: 'Shelf 1' } }) })

    render(<ContainerCreateDrawer onClose={() => {}} />)

    const nameInput = screen.getByLabelText(/Container name/i)
    const locInput = screen.getByLabelText(/Location/i)
    const createBtn = screen.getByText(/Create container/i)

    fireEvent.change(nameInput, { target: { value: 'New' } })
    fireEvent.change(locInput, { target: { value: 'Shelf 1' } })

    fireEvent.click(createBtn)

    await waitFor(() => {
      // ensure POST called
      // @ts-ignore
      expect(fetch).toHaveBeenCalled()
      // check navigation
      expect(window.location.hash).toBe('#/containers/42')
    })
  })
})
