/**
 * Tests for Cast Profile Setup component.
 *
 * Covers:
 * - CAST-03: Profile setup form
 * - CAST-16-18: Headshot upload
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// import { CastProfileForm } from '@/components/profile/CastProfileForm'

describe('CastProfileForm', () => {
  it.todo('renders display name field (required)')
  it.todo('renders phone field (optional)')
  it.todo('renders role/character field (optional)')
  it.todo('renders headshot upload area')
  it.todo('validates display name max 200 chars')
  it.todo('validates phone max 20 chars')
  it.todo('validates role/character max 200 chars')
  it.todo('submits profile on form submit')
  it.todo('shows success and redirects to conflict submission')
})

describe('HeadshotUpload', () => {
  it.todo('accepts JPEG files')
  it.todo('accepts PNG files')
  it.todo('rejects non-JPEG/PNG files with error')
  it.todo('rejects files > 5MB with error')
  it.todo('shows preview of uploaded image')
  it.todo('shows "Remove Photo" button when photo exists')
  it.todo('removes photo on "Remove Photo" click')
})
