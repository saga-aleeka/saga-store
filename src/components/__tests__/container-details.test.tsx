import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import ContainerDetails from '../ContainerDetails'

vi.stubGlobal('fetch', vi.fn())

describe('ContainerDetails actions', () => {
  afterEach(() => { vi.resetAllMocks() })

  it('moves a sample when Move is clicked', async () => {
    const container = { id: 1, name: 'Freezer A1', type: 'Sample Type', temperature: '-80°C', layout: '9x9', used: 0, total: 81, samples: [{ id: 'S-001', container_id:1, position:'A1', status:'active', updated_at:'2025-10-31T19:00:00Z' }] }

    // mock initial GET /api/containers/1
    // @ts-ignore
    fetch.mockImplementation((url:string, opts?:any) => {
      if (url.endsWith('/api/containers/1')) return Promise.resolve({ ok:true, json: async () => ({ data: container }) })
      if (url.includes('/api/samples/S-001/move')) return Promise.resolve({ ok:true, json: async () => ({ data: { ...container.samples[0], container_id: 2 } }) })
      return Promise.resolve({ ok:true, json: async () => ({}) })
    })

    // stub prompt to enter target container id
    vi.stubGlobal('prompt', () => '2')

    render(<ContainerDetails id={1} />)

    // wait for sample to be shown
    const sampleLabel = await screen.findByText(/S-001 • A1/i)
    expect(sampleLabel).toBeTruthy()

    // click move
    const moveBtn = screen.getByText(/Move/i)
    fireEvent.click(moveBtn)

    await waitFor(() => {
      // @ts-ignore
      expect(fetch.mock.calls.find(c => c[0].includes('/api/samples/S-001/move'))).toBeTruthy()
    })
  })

  it('archives a sample when Archive is clicked', async () => {
    const container = { id: 1, name: 'Freezer A1', type: 'Sample Type', temperature: '-80°C', layout: '9x9', used: 0, total: 81, samples: [{ id: 'S-002', container_id:1, position:'B1', status:'active', updated_at:'2025-10-31T19:00:00Z' }] }

    // mock initial GET and PUT
    // @ts-ignore
    fetch.mockImplementation((url:string, opts?:any) => {
      if (url.endsWith('/api/containers/1')) return Promise.resolve({ ok:true, json: async () => ({ data: container }) })
      if (url.includes('/api/samples/S-002')) return Promise.resolve({ ok:true, json: async () => ({ data: { ...container.samples[0], status: 'archived' } }) })
      return Promise.resolve({ ok:true, json: async () => ({}) })
    })

    render(<ContainerDetails id={1} />)

  const sampleLabelNode = await screen.findByText(/S-002 • B1/i)
  const sampleRow = sampleLabelNode.closest('.sample-row') as HTMLElement
  const archiveBtn = within(sampleRow).getByText(/Archive/i)
  fireEvent.click(archiveBtn)

    await waitFor(() => {
      // ensure PUT called for sample
      // @ts-ignore
      expect(fetch.mock.calls.find(c => c[0].includes('/api/samples/S-002'))).toBeTruthy()
      // check method was PUT
      // @ts-ignore
      const call = fetch.mock.calls.find(c => c[0].includes('/api/samples/S-002'))
      expect(call[1].method).toBe('PUT')
    })
  })
})
