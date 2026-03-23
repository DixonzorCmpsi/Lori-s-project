/**
 * Tests for Conflict Submission component.
 *
 * Covers:
 * - CAST-04: Submit conflicts UI
 * - CAST-05: Already submitted state
 * - CAST-19: Reason max length
 * - Confirmation dialog
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// import { ConflictSubmission } from '@/components/conflicts/ConflictSubmission'

describe('ConflictSubmission', () => {
  describe('State 1: Not yet submitted', () => {
    it.todo('renders calendar with all rehearsal dates')
    it.todo('clicking a date toggles it as conflict (red + checkmark)')
    it.todo('shows optional reason text field for each selected date')
    it.todo('reason field enforces max 500 chars')
    it.todo('shows "Submit Conflicts" button')
    it.todo('shows confirmation dialog on submit')
    it.todo('confirmation text: "Once submitted, your conflicts cannot be changed. Are you sure?"')
    it.todo('submitting sends POST to API')
    it.todo('allows submitting zero conflicts (no dates selected)')
  })

  describe('State 2: Already submitted (read-only)', () => {
    it.todo('does NOT render form or submit button')
    it.todo('shows submitted conflicts as read-only list')
    it.todo('shows "Conflicts submitted" status message')
  })

  describe('State 3: After Director reset', () => {
    it.todo('re-renders State 1 (submission form)')
    it.todo('shows notification that conflicts were reset')
  })

  describe('Error handling', () => {
    it.todo('shows error on 409 (already submitted)')
    it.todo('shows validation errors for invalid date IDs')
    it.todo('shows network error message')
  })
})
