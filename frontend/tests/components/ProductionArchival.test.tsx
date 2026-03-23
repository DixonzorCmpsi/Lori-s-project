/**
 * Tests for Production Archival UI.
 *
 * Covers:
 * - SPEC-003 Section 6.5: Archive and unarchive
 * - Confirmation dialog text
 * - Read-only mode after archival
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// import { ProductionSettings } from '@/components/production/ProductionSettings'

describe('ProductionArchival', () => {
  it.todo('shows "Archive Production" button for Director')
  it.todo('does not show "Archive" button for Staff or Cast')
  it.todo('shows confirmation dialog with correct text on archive click')
  it.todo('confirmation mentions 90-day PII deletion')
  it.todo('archives production on confirm')
  it.todo('shows "Unarchive" button when archived and within 90 days')
  it.todo('hides "Unarchive" after 90-day window')
  it.todo('shows "PII deleted — cannot be restored" message after 90 days')
  it.todo('read-only mode hides all write controls')
})
