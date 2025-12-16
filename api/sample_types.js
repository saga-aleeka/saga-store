// Serverless endpoint to manage `sample_types` table in Supabase.
// Supports:
// - GET /api/sample_types -> list all sample types
// - POST /api/sample_types -> create new sample type
// - PUT /api/sample_types -> update existing sample type
// - DELETE /api/sample_types?id=xxx -> delete sample type

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

module.exports = async function handler(req, res) {
  const { method } = req

  try {
    if (method === 'GET') {
      // Fetch all sample types
      const { data, error } = await supabase
        .from('sample_types')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name', { ascending: true })

      if (error) throw error
      return res.status(200).json(data)
    }

    if (method === 'POST') {
      // Create new sample type
      const { name, description, color, default_temperature } = req.body

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' })
      }

      if (!color || !color.match(/^#[0-9A-Fa-f]{6}$/)) {
        return res.status(400).json({ error: 'Valid hex color is required' })
      }

      const { data, error } = await supabase
        .from('sample_types')
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          color,
          default_temperature: default_temperature || null,
          is_system: false
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') { // unique violation
          return res.status(409).json({ error: 'Sample type with this name already exists' })
        }
        throw error
      }

      return res.status(201).json(data)
    }

    if (method === 'PUT') {
      // Update existing sample type
      const { id, name, description, color, default_temperature } = req.body

      if (!id) {
        return res.status(400).json({ error: 'ID is required' })
      }

      const updates = {}
      if (name) updates.name = name.trim()
      if (description !== undefined) updates.description = description?.trim() || null
      if (color && color.match(/^#[0-9A-Fa-f]{6}$/)) updates.color = color
      if (default_temperature !== undefined) updates.default_temperature = default_temperature || null
      updates.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('sample_types')
        .update(updates)
        .eq('id', id)
        .eq('is_system', false) // Only allow updating custom types
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Sample type with this name already exists' })
        }
        throw error
      }

      if (!data) {
        return res.status(404).json({ error: 'Sample type not found or is a system type' })
      }

      return res.status(200).json(data)
    }

    if (method === 'DELETE') {
      // Delete sample type
      const { id } = req.query

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID is required' })
      }

      const { data, error } = await supabase
        .from('sample_types')
        .delete()
        .eq('id', id)
        .eq('is_system', false) // Only allow deleting custom types
        .select()
        .single()

      if (error) throw error

      if (!data) {
        return res.status(404).json({ error: 'Sample type not found or is a system type' })
      }

      return res.status(200).json({ message: 'Sample type deleted successfully' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Sample types API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
