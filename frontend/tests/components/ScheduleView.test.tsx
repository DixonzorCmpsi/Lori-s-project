/**
 * Tests for Schedule View components.
 *
 * Covers:
 * - CAST-07: Cast views schedule with own conflicts overlaid
 * - CAST-08: Cast has no edit controls
 * - SCHED-10: Cast views personal schedule
 * - Director calendar with conflict overlay
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// import { ScheduleView } from '@/components/schedule/ScheduleView'
// import { DirectorSchedule } from '@/components/schedule/DirectorSchedule'

describe('ScheduleView (Cast)', () => {
  it.todo('renders calendar with rehearsal dates')
  it.todo('color-codes dates by type (regular=amber, tech=blue, dress=purple, performance=red)')
  it.todo('highlights own conflict dates with red background')
  it.todo('shows "You\'re unavailable" label on conflict dates')
  it.todo('shows cancelled dates with strikethrough')
  it.todo('shows "Cancelled" badge on cancelled dates')
  it.todo('shows Director notes on each date')
  it.todo('does NOT show soft-deleted dates')
  it.todo('has NO edit controls, buttons, or forms')
  it.todo('does NOT show other cast members conflict data')
})

describe('DirectorSchedule', () => {
  it.todo('renders calendar with all rehearsal dates including soft-deleted')
  it.todo('shows conflict count badge per date')
  it.todo('badge color: green=0, amber=1-2, orange=3-4, red=5+')
  it.todo('clicking badge expands conflict details panel')
  it.todo('conflict panel shows cast name + reason')
  it.todo('shows edit controls for each date')
  it.todo('shows cancel button for each date')
  it.todo('shows delete button for each date')
  it.todo('shows add note option')
})

describe('ScheduleWizard', () => {
  it.todo('renders all 7 questions in sequence')
  it.todo('Q1: multi-select day picker (Mon-Sun)')
  it.todo('Q2: time picker for start time')
  it.todo('Q3: time picker for end time')
  it.todo('Q4: date multi-picker for blocked dates')
  it.todo('Q5: yes/no toggle for tech week')
  it.todo('Q6: number input for tech days (shown only if Q5=yes)')
  it.todo('Q7: yes/no toggle for dress rehearsal')
  it.todo('validates start time < end time')
  it.todo('submits wizard data on completion')
  it.todo('shows preview of generated schedule')
})

describe('ConflictSummaryTable', () => {
  it.todo('renders sortable table with date, type, conflicts, names')
  it.todo('sorts by date by default')
  it.todo('can sort by conflict count')
  it.todo('shows reason text or "No reason given" for blank')
})
