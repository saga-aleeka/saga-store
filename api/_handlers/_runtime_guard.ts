function getSupabaseProjectRef(url: string | undefined | null): string {
  if (!url) return ''
  try {
    const host = new URL(String(url)).hostname || ''
    return (host.split('.')[0] || '').trim().toLowerCase()
  } catch (_err) {
    return ''
  }
}

function checkSupabaseProjectRefLock() {
  const expected = String(process.env.EXPECTED_SUPABASE_PROJECT_REF || '').trim().toLowerCase()
  const actual = getSupabaseProjectRef(process.env.SUPABASE_URL)

  if (!expected) {
    return {
      ok: true,
      enforced: false,
      expected: '',
      actual,
      reason: 'expected_ref_not_set',
    }
  }

  if (!actual) {
    return {
      ok: false,
      enforced: true,
      expected,
      actual,
      reason: 'invalid_or_missing_supabase_url',
    }
  }

  if (actual !== expected) {
    return {
      ok: false,
      enforced: true,
      expected,
      actual,
      reason: 'supabase_ref_mismatch',
    }
  }

  return {
    ok: true,
    enforced: true,
    expected,
    actual,
    reason: 'ok',
  }
}

module.exports = {
  checkSupabaseProjectRefLock,
  getSupabaseProjectRef,
}
