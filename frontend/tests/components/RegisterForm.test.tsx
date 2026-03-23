/**
 * Tests for Registration Form component.
 *
 * Covers:
 * - AUTH-01: Register with email/password (form)
 * - AUTH-20: Breached password message
 * - AUTH-26: Under-13 age gate UI
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// import { RegisterForm } from '@/components/auth/RegisterForm'

describe('RegisterForm', () => {
  it.todo('renders name, email, password, and date of birth fields')
  it.todo('submits registration data on form submit')
  it.todo('shows success message after registration')
  it.todo('shows "too common" error for breached passwords')
  it.todo('shows age gate error for under-13 DOB')
  it.todo('validates minimum password length (8 chars)')
  it.todo('validates email format')
  it.todo('shows privacy policy link')
  it.todo('date of birth field prevents future dates')
  it.todo('does not show password in plaintext')
  it.todo('shows validation errors per field')
})
