import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContainerCard from '../ContainerCard'

vi.stubGlobal('fetch', vi.fn())

describe('ContainerCard edit drawer', () => {
  afterEach(() => { vi.resetAllMocks() })

  it('opens drawer and saves archived state', async () => {
    const mockContainer = { id: 1, name: 'Freezer A1', type: 'Sample Type', temperature: '-80°C', layout: '9x9', used: 0, total: 81 }
    // mock fetch for PUT
    // @ts-ignore
    fetch.mockResolvedValueOnce({ json: async () => ({ data: { ...mockContainer, archived: true } }) })

    render(<ContainerCard {...mockContainer} />)

    // open menu
    const menu = screen.getByLabelText('open menu')
    fireEvent.click(menu)

    // checkbox for archived should appear
    const archiveCheckbox = await screen.findByLabelText(/Archived/i)
    fireEvent.click(archiveCheckbox)

    // click save
  // fill required location so save is enabled
  const locInput = screen.getByLabelText(/Location/i)
  fireEvent.change(locInput, { target: { value: 'Shelf 1' } })

  const save = screen.getByText(/Save changes/i)
  fireEvent.click(save)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
      // ensure it PUTs to the right endpoint
      // @ts-ignore
      expect(fetch.mock.calls[0][0]).toContain('/api/containers/1')
    })
  })
})
