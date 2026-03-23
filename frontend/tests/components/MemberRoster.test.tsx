/**
 * Tests for Member Roster component.
 *
 * Covers:
 * - DIR-12: Promote cast to staff
 * - DIR-13: Remove member
 * - DIR-21: Demote staff to cast
 * - Member list display
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// import { MemberRoster } from '@/components/roster/MemberRoster'

describe('MemberRoster', () => {
  describe('Display', () => {
    it.todo('renders list of all production members')
    it.todo('shows name, role, date joined, conflicts status')
    it.todo('shows "Not submitted" for members without conflicts')
    it.todo('shows "Submitted" for members with conflicts')
  })

  describe('Director actions', () => {
    it.todo('shows "Promote to Staff" button for Cast members')
    it.todo('shows "Demote to Cast" button for Staff members')
    it.todo('shows "Remove" button for all non-director members')
    it.todo('shows "Reset Conflicts" button for members with submitted conflicts')
    it.todo('does NOT show "Promote"/"Demote" for Director')
    it.todo('shows confirmation dialog on "Remove"')
    it.todo('confirmation text includes member name')
    it.todo('shows confirmation dialog on "Reset Conflicts"')
    it.todo('reset confirmation: "This will delete all of [name]\'s submitted conflicts..."')
  })

  describe('Non-director view', () => {
    it.todo('Staff does NOT see promote/demote/remove buttons')
    it.todo('Cast does NOT see any action buttons')
  })
})
