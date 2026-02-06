export const CONTAINER_LOCATION_RELATIONS = `
  cold_storage_units: cold_storage_units!containers_cold_storage_id_fkey(
    id,
    name,
    type,
    temperature,
    location
  ),
  racks: racks!containers_rack_id_fkey(
    id,
    name,
    position,
    cold_storage_units: cold_storage_units!racks_cold_storage_id_fkey(
      id,
      name,
      type,
      temperature,
      location
    )
  )
`

export const CONTAINER_LOCATION_SELECT = `
  id,
  name,
  used,
  total,
  location,
  type,
  temperature,
  is_rnd,
  rack_id,
  rack_position,
  cold_storage_id,
  ${CONTAINER_LOCATION_RELATIONS}
`

export function formatContainerLocation(container?: any): string {
  if (!container) return ''
  const rack = container.racks
  const coldStorage = rack?.cold_storage_units || container.cold_storage_units

  const parts: string[] = []
  if (coldStorage?.name) parts.push(coldStorage.name)
  if (rack?.name) parts.push(rack.name)
  if (container.rack_position) parts.push(container.rack_position)

  const mapped = parts.filter(Boolean).join(' / ')

  // Storage mapping replaces manual container location.
  if (mapped) return mapped

  return container.location || ''
}

export function getContainerLocationSearchText(container?: any): string {
  if (!container) return ''
  const rack = container.racks
  const coldStorage = rack?.cold_storage_units || container.cold_storage_units

  return [
    container.location,
    container.rack_position,
    rack?.name,
    rack?.position,
    coldStorage?.name,
    coldStorage?.location,
    coldStorage?.type,
    coldStorage?.temperature
  ]
    .filter(Boolean)
    .join(' ')
}
