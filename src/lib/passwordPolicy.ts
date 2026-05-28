const MIN_PASSWORD_LENGTH = 8

export type PasswordRequirement = {
  key: string
  label: string
  met: boolean
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      key: 'length',
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      met: password.length >= MIN_PASSWORD_LENGTH,
    },
    {
      key: 'lowercase',
      label: 'Contains a lowercase letter',
      met: /[a-z]/.test(password),
    },
    {
      key: 'uppercase',
      label: 'Contains an uppercase letter',
      met: /[A-Z]/.test(password),
    },
    {
      key: 'number',
      label: 'Contains a number',
      met: /\d/.test(password),
    },
    {
      key: 'symbol',
      label: 'Contains a symbol',
      met: /[^A-Za-z0-9]/.test(password),
    },
  ]
}

export function getPasswordStrength(password: string) {
  const score = getPasswordRequirements(password).filter((requirement) => requirement.met).length

  if (score <= 2) {
    return { label: 'Weak', tone: 'weak' as const, score }
  }

  if (score <= 4) {
    return { label: 'Medium', tone: 'medium' as const, score }
  }

  return { label: 'Strong', tone: 'strong' as const, score }
}

export function validateNewPassword(password: string, confirmPassword: string) {
  if (!password || !confirmPassword) {
    return 'Enter and confirm your password'
  }

  if (password !== confirmPassword) {
    return 'Passwords do not match'
  }

  const unmetRequirements = getPasswordRequirements(password).filter((requirement) => !requirement.met)
  if (unmetRequirements.length > 0) {
    return 'Password does not meet the minimum security requirements'
  }

  return null
}

export function isPasswordAccepted(password: string, confirmPassword: string) {
  return validateNewPassword(password, confirmPassword) === null
}