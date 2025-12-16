// Serverless endpoint to manage `container_types` table in Supabase.
// Supports:
// - GET /api/container_types -> list all container types
// - POST /api/container_types -> create new container type
// - PUT /api/container_types -> update existing container type
// - DELETE /api/container_types?id=xxx -> delete container type

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

module.exports = async function handler(req: any, res: any) {
  const { method } = req

  try {
    if (method === 'GET') {
      // Fetch all container types
      const { data, error } = await supabase
        .from('container_types')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name', { ascending: true })

      if (error) throw error
      return res.status(200).json(data)
    }

    if (method === 'POST') {
      // Create new container type
      const { name, description, rows, columns, default_temperature } = req.body

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' })
      }

      if (!rows || !Number.isInteger(rows) || rows <= 0 || rows > 50) {
        return res.status(400).json({ error: 'Rows must be an integer between 1 and 50' })
      }

      if (!columns || !Number.isInteger(columns) || columns <= 0 || columns > 50) {
        return res.status(400).json({ error: 'Columns must be an integer between 1 and 50' })
      }

      const { data, error } = await supabase
        .from('container_types')
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          rows,
          columns,
          default_temperature: default_temperature || null,
          is_system: false
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') { // unique violation
          return res.status(409).json({ error: 'Container type with this name already exists' })
        }
        throw error
      }

      return res.status(201).json(data)
    }

    if (method === 'PUT') {
      // Update existing container type
      const { id, name, description, rows, columns, default_temperature } = req.body

      if (!id) {
        return res.status(400).json({ error: 'ID is required' })
      }

      const updates: any = {}
      if (name) updates.name = name.trim()
      if (description !== undefined) updates.description = description?.trim() || null
      if (rows && Number.isInteger(rows) && rows > 0 && rows <= 50) updates.rows = rows
      if (columns && Number.isInteger(columns) && columns > 0 && columns <= 50) updates.columns = columns
      if (default_temperature !== undefined) updates.default_temperature = default_temperature || null
      updates.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('container_types')
        .update(updates)
        .eq('id', id)
        .eq('is_system', false) // Only allow updating custom types
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Container type with this name already exists' })
        }
        throw error
      }

      if (!data) {
        return res.status(404).json({ error: 'Container type not found or is a system type' })
      }

      return res.status(200).json(data)
    }

    if (method === 'DELETE') {
      // Delete container type
      const { id } = req.query

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID is required' })
      }

      const { data, error } = await supabase
        .from('container_types')
        .delete()
        .eq('id', id)
        .eq('is_system', false) // Only allow deleting custom types
        .select()
        .single()

      if (error) throw error

      if (!data) {
        return res.status(404).json({ error: 'Container type not found or is a system type' })
      }

      return res.status(200).json({ message: 'Container type deleted successfully' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Container types API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
